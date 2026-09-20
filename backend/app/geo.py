"""Turning a typed address into coordinates. No API key, no billing account.

Three providers, tried in order, each with a different strength:

    photon.komoot.io          built for autocomplete: handles partial and
                              misspelled input, street level, OSM data
    geocoding.geo.census.gov  US Census Bureau. Authoritative for US street
                              addresses, and a .gov endpoint is about as
                              unlikely to rate-limit a demo as it gets
    geocoding-api.open-meteo  place and neighbourhood names only, but it is the
                              same API family we already use for weather

Nominatim was the obvious first choice and it returns HTTP 403 to us: its
public instance blocks by IP reputation and user-agent, and arguing with it an
hour before a demo is a bad trade. Photon runs on the same OSM data.

Google's Geocoding API does this too, but needs a key tied to a billing
account. None of these do.

WHY THIS MATTERS BEYOND CONVENIENCE: the lat/lon we return is exactly what we
then send to Open-Meteo for weather, and that call appears in `requested_urls`
on every compare response. The address on screen and the coordinates we pulled
weather for are provably the same place.

Results are filtered to New York City AFTER the fact rather than by asking the
provider to hard-restrict the search -- a bounded search makes partial queries
return nothing at all. The restriction exists because canopy_shade comes from
the NYC Street Tree Census and the resources list is NYC-specific: an address
in Chicago would get real weather attached to invented tree cover.

Every attempt is reported back, successes and failures both. A geocoder that is
down must not look like a place that does not exist.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

import httpx

PHOTON_URL = "https://photon.komoot.io/api/"
CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
OPEN_METEO_URL = "https://geocoding-api.open-meteo.com/v1/search"

HEADERS = {
    "User-Agent": "ClimapNYC/0.1 (Health in Climate AI hackathon prototype)",
    "Accept-Language": "en",
}

# The five boroughs: south, north, west, east.
NYC_BOUNDS = (40.4774, 40.9176, -74.2591, -73.7002)


def in_nyc(lat: float, lon: float) -> bool:
    south, north, west, east = NYC_BOUNDS
    return south <= lat <= north and west <= lon <= east


def _dedupe(rows: list[dict]) -> list[dict]:
    """A long street comes back once per segment -- five identical-looking rows
    a few hundred metres apart. Keep one per (label, ZIP): the coordinates
    differ by less than the weather grid resolves anyway, so the extras are
    noise in a dropdown someone has to read on a projector."""
    seen: set[tuple[str, str]] = set()
    out = []
    for row in rows:
        key = (row["label"], row["zip_code"])
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def search(query: str, limit: int = 5) -> dict[str, Any]:
    """Address -> candidate places, plus a full account of what was tried."""
    attempts: list[dict[str, Any]] = []
    providers: list[tuple[str, Callable]] = [
        ("photon", _photon), ("census", _census), ("open-meteo", _open_meteo),
    ]

    for name, fetch in providers:
        matches, called, problem = fetch(query, limit)
        matches = _dedupe(matches)[:limit]
        attempts.append({"provider": name, "url": called,
                         "found": len(matches), "problem": problem})
        if matches:
            return {"matches": matches, "requested_url": called,
                    "provider": name, "problem": None, "attempts": attempts}

    # Nothing found anywhere. Say whether that is because the providers failed
    # or because the query genuinely matches nothing in New York City.
    failures = [a for a in attempts if a["problem"]]
    problem = "; ".join(f"{a['provider']}: {a['problem']}" for a in failures) or None
    return {"matches": [], "requested_url": attempts[0]["url"] if attempts else None,
            "provider": None, "problem": problem, "attempts": attempts}


def _get(url: str, params: dict) -> tuple[Optional[Any], Optional[str], Optional[str]]:
    """Shared plumbing. Returns (json, called_url, problem)."""
    called = None
    try:
        with httpx.Client(timeout=8.0, headers=HEADERS, follow_redirects=True) as client:
            response = client.get(url, params=params)
            called = str(response.request.url)
            if response.status_code != 200:
                return None, called, f"HTTP {response.status_code}"
            return response.json(), called, None
    except Exception as error:
        return None, called, f"unreachable ({type(error).__name__})"


def _photon(query: str, limit: int):
    data, called, problem = _get(PHOTON_URL, {
        "q": query, "limit": limit * 6, "lang": "en",
        # Bias towards NYC without excluding anything outright.
        "lat": 40.7831, "lon": -73.9712,
    })
    if data is None:
        return [], called, problem

    out = []
    for feature in data.get("features", []):
        lon, lat = feature["geometry"]["coordinates"][:2]
        if not in_nyc(lat, lon):
            continue
        p = feature.get("properties", {})
        street = " ".join(str(x) for x in (p.get("housenumber"), p.get("street")) if x)
        head = street or p.get("name") or ""
        area = p.get("district") or p.get("city") or p.get("county") or ""
        out.append({
            "label": ", ".join(dict.fromkeys(x for x in (head, area) if x)) or head,
            "full_label": ", ".join(str(x) for x in (head, area, p.get("state")) if x),
            "lat": float(lat), "lon": float(lon),
            "zip_code": p.get("postcode", "") or "",
        })
    return out, called, None


def _census(query: str, limit: int):
    """Needs a reasonably complete address, so we nudge it towards New York."""
    address = query if "new york" in query.lower() or ", ny" in query.lower() \
        else f"{query}, New York, NY"
    data, called, problem = _get(CENSUS_URL, {
        "address": address, "benchmark": "Public_AR_Current", "format": "json"})
    if data is None:
        return [], called, problem

    out = []
    for row in (data.get("result", {}).get("addressMatches") or []):
        lat, lon = float(row["coordinates"]["y"]), float(row["coordinates"]["x"])
        if not in_nyc(lat, lon):
            continue
        matched = row.get("matchedAddress", "")
        out.append({
            "label": matched.split(",")[0] or matched,
            "full_label": matched,
            "lat": lat, "lon": lon,
            "zip_code": row.get("addressComponents", {}).get("zip", "") or "",
        })
    return out, called, None


def _open_meteo(query: str, limit: int):
    """Last resort: place and neighbourhood names, no house numbers. Same API
    family as our weather source, so if this is down the demo is down anyway."""
    data, called, problem = _get(OPEN_METEO_URL, {
        "name": query, "count": limit * 4, "language": "en", "format": "json"})
    if data is None:
        return [], called, problem

    out = []
    for row in (data.get("results") or []):
        lat, lon = float(row["latitude"]), float(row["longitude"])
        if not in_nyc(lat, lon):
            continue
        area = row.get("admin2") or row.get("admin1") or ""
        out.append({
            "label": ", ".join(str(x) for x in (row.get("name"), area) if x),
            "full_label": ", ".join(str(x) for x in (
                row.get("name"), row.get("admin2"), row.get("admin1")) if x),
            "lat": lat, "lon": lon,
            "zip_code": (row.get("postcodes") or [""])[0] or "",
        })
    return out, called, None
