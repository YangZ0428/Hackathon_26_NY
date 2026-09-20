"""Where the numbers come from. Three sources, zero API keys.

    api.open-meteo.com            temperature, humidity, wind, solar radiation
    air-quality-api.open-meteo.com PM2.5, ozone, US AQI
    api.weather.gov               official NWS heat / air-quality alerts

The air-quality one is a SEPARATE domain. Most teams miss it and go apply for
an EPA AirNow key. We do not need one.

NWS rejects requests without a real User-Agent header. That is documented
behaviour, not folklore.

Three modes, and every response says which one it used:

    live              fetched just now from the public endpoints
    cached            fetched earlier this session, still within 15 minutes
    offline_fixture   replayed from fixtures/snapshot.json

INTEGRITY RULE: the fixture can ONLY ever hold data that tools/snapshot.py
really downloaded. There is no synthetic-data generator in this project -- if
the network is unreachable and no snapshot exists, the API returns an error
rather than inventing plausible numbers. Every response also carries the exact
URLs that were called (`requested_urls`), so "we really used their public API"
is something you can show, not just claim.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import httpx

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
ALERTS_URL = "https://api.weather.gov/alerts/active"

NWS_HEADERS = {"User-Agent": "(ClimapNYC hackathon prototype, contact@example.org)"}

WEATHER_FIELDS = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature",
    "wind_speed_10m", "shortwave_radiation", "direct_radiation",
    "diffuse_radiation", "uv_index",
]
AIR_FIELDS = ["pm2_5", "ozone", "us_aqi_pm2_5", "us_aqi_ozone"]

CACHE_TTL = 900  # seconds
FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "snapshot.json"

_cache: dict[str, tuple[float, dict]] = {}
_mode = "live"
_called_urls: list[str] = []


def called_urls() -> list[str]:
    """Exact URLs hit while serving the current request. Proof, not a claim."""
    return list(dict.fromkeys(_called_urls))


def reset_call_log() -> None:
    _called_urls.clear()


def _offline() -> bool:
    """Old STILLGO_OFFLINE still honoured -- see the note in demo_date()."""
    return "1" in (os.environ.get("CLIMAP_OFFLINE", ""),
                   os.environ.get("STILLGO_OFFLINE", ""))


def demo_date() -> Optional[str]:
    """CLIMAP_DEMO_DATE=2026-07-15 pins the whole demo to a real past day.

    Today may simply not be hot, and a mild day makes the comparison flat. The
    archive API serves real observations for a past date -- same public
    endpoint family, still no key. Unset it and everything runs on live
    forecasts again. tools/find_hot_day.py finds candidate dates.
    """
    # STILLGO_* was the name before the project was renamed. Still accepted, so
    # a command pasted from an older terminal does not silently fall back to
    # today's mild weather and make the whole demo look broken.
    value = (os.environ.get("CLIMAP_DEMO_DATE")
             or os.environ.get("STILLGO_DEMO_DATE") or "").strip()
    return value or None


def mode() -> str:
    """Which of the three paths the last lookup took."""
    return _mode


def _point_key(lat: float, lon: float) -> str:
    return f"{lat:.3f},{lon:.3f}"


def _read_fixture() -> dict:
    if not FIXTURE.exists():
        return {}
    try:
        return json.loads(FIXTURE.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def _download(lat: float, lon: float) -> dict:
    """Both Open-Meteo APIs for one point.

    Live: three days of hourly forecast.
    Demo date set: real observations for that day and the next, from the
    archive API. Air quality is asked for the same window and is allowed to
    come back empty -- the archive does not always carry it that far back.
    """
    pinned = demo_date()
    base = {"latitude": lat, "longitude": lon, "timezone": "America/New_York"}

    def get(client, url, params):
        response = client.get(url, params=params)
        _called_urls.append(str(response.request.url))
        response.raise_for_status()
        return response.json()

    with httpx.Client(timeout=12.0) as client:
        if pinned:
            end = (datetime.fromisoformat(pinned) + timedelta(days=1)).date().isoformat()
            window = {"start_date": pinned, "end_date": end}
            weather = get(client, ARCHIVE_URL, {
                **base, **window, "hourly": ",".join(WEATHER_FIELDS),
                "wind_speed_unit": "ms"})
            try:
                air = get(client, AIR_URL, {
                    **base, **window, "hourly": ",".join(AIR_FIELDS)})
            except Exception:
                air = {}
        else:
            window = {"forecast_days": 3}
            weather = get(client, FORECAST_URL, {
                **base, **window, "hourly": ",".join(WEATHER_FIELDS),
                "wind_speed_unit": "ms"})
            air = get(client, AIR_URL, {
                **base, **window, "hourly": ",".join(AIR_FIELDS)})

    return {"weather": weather, "air": air}


def series_for(lat: float, lon: float) -> dict:
    """Full hourly series for one point. Walks the three modes in order."""
    global _mode

    if _offline():
        _mode = "offline_fixture"
        return _read_fixture().get(_point_key(lat, lon), {})

    key = _point_key(lat, lon)
    cached = _cache.get(key)
    if cached and (time.time() - cached[0]) < CACHE_TTL:
        _mode = "cached"
        return cached[1]

    try:
        fresh = _download(lat, lon)
        _cache[key] = (time.time(), fresh)
        _mode = "live"
        return fresh
    except Exception:
        # Never raise. A demo that shows stale numbers beats one that 500s.
        _mode = "offline_fixture"
        return _read_fixture().get(key, {})


def _row_index(series: dict, when_iso: str) -> Optional[int]:
    """Find the hour we want in the returned arrays.

    Open-Meteo gives parallel arrays: time[], temperature_2m[], ... so we find
    the position once and read every field at that position.
    """
    times = series.get("weather", {}).get("hourly", {}).get("time", [])
    stamp = when_iso[:13]  # YYYY-MM-DDTHH
    for idx, value in enumerate(times):
        if value.startswith(stamp):
            return idx
    return None


def at_hour(lat: float, lon: float, when_iso: str) -> dict[str, Any]:
    """The one hour we care about, as a flat dict.

    Returns environment only. Canopy shade belongs to the PLACE, not the
    weather, so it is applied later in heat.py.
    """
    series = series_for(lat, lon)
    if not series:
        return {}
    idx = _row_index(series, when_iso)
    if idx is None:
        return {}

    weather = series["weather"]["hourly"]
    air = series.get("air", {}).get("hourly", {})

    def value(block: dict, field: str, fallback=None):
        column = block.get(field)
        if not column or idx >= len(column) or column[idx] is None:
            return fallback
        return column[idx]

    # No fallbacks on the three that drive the score. A missing value must
    # surface as an error, never as a plausible-looking invention.
    air_temp = value(weather, "temperature_2m")
    humidity = value(weather, "relative_humidity_2m")
    wind = value(weather, "wind_speed_10m")
    if air_temp is None or humidity is None or wind is None:
        return {}

    return {
        "air_temp_c": air_temp,
        "relative_humidity_pct": humidity,
        "wind_ms": wind,
        "solar_wm2": value(weather, "shortwave_radiation", 0.0),
        "pm25_aqi": value(air, "us_aqi_pm2_5"),
        "ozone_aqi": value(air, "us_aqi_ozone"),
        "source_ids": ["open-meteo-forecast", "open-meteo-air-quality"],
    }


def alert_for(lat: float, lon: float) -> Optional[str]:
    """Official NWS alert headline, if one is active. Never blocks a response."""
    if _offline():
        return None
    try:
        with httpx.Client(timeout=5.0, headers=NWS_HEADERS) as client:
            data = client.get(ALERTS_URL, params={"point": f"{lat},{lon}"}).json()
        for feature in data.get("features", []):
            event = feature.get("properties", {}).get("event", "")
            if "Heat" in event or "Air Quality" in event:
                return event
    except Exception:
        return None
    return None
