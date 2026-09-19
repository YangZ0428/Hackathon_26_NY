"""Loads the three JSON files and turns them into things the API can use.

This is the seam between CODE and CONTENT. Everything D edits lives in
data/*.json; nothing D edits lives in a .py file. That separation is what lets
D work without touching anyone's code.

  profiles.json   the synthetic people
  places.json     places and time slots, and which combinations we offer
  guidance.json   band labels, verdict wording, assumptions, citations
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

from . import weather
from .schemas import PlanOption

DATA = Path(__file__).resolve().parent.parent / "data"

PROFILES = {p["id"]: p for p in json.loads((DATA / "profiles.json").read_text())}
_PLACES_DOC = json.loads((DATA / "places.json").read_text())
GUIDANCE = json.loads((DATA / "guidance.json").read_text())

PLACES = {p["id"]: p for p in _PLACES_DOC["places"]}
SLOTS = {s["id"]: s for s in _PLACES_DOC["slots"]}


def plan_options() -> list[PlanOption]:
    """Turn abstract options (place id x slot id) into real timestamps.

    Done at request time, not at import, so "today" and "tomorrow" stay correct
    if the server has been running since yesterday.
    """
    pinned = weather.demo_date()
    if pinned:
        # Day 0 becomes the pinned date, so "today" and "tomorrow" in the slot
        # table point at that real past day and the one after it.
        hour_now = datetime.fromisoformat(pinned).replace(
            hour=0, minute=0, second=0, microsecond=0)
    else:
        hour_now = datetime.now().replace(minute=0, second=0, microsecond=0)
    out: list[PlanOption] = []
    for option in _PLACES_DOC["options"]:
        place = PLACES[option["place"]]
        slot = SLOTS[option["slot"]]
        when = (hour_now + timedelta(days=slot["day_offset"])).replace(hour=slot["hour"])
        out.append(PlanOption(
            id=option["id"],
            when_label=slot["when_label"],
            when_iso=when.isoformat(),
            where_label=place["where_label"],
            lat=place["lat"],
            lon=place["lon"],
            canopy_shade=place["canopy_shade"],
        ))
    return out


def band_info(band_key: str) -> dict:
    """Label, verdict wording and the guidance id that backs this band."""
    return GUIDANCE["bands"][band_key]


def aqi_category(value) -> tuple[str, str]:
    """AQI number -> EPA category name and the citation for it."""
    if value is None:
        return "unknown", "epa-aqi-activity"
    for category in GUIDANCE["aqi_categories"]:
        if value <= category["max"]:
            return category["label"], category["guidance_id"]
    return "Unhealthy", "epa-aqi-activity"


def citation(citation_id: str) -> dict | None:
    for c in GUIDANCE["citations"]:
        if c["id"] == citation_id:
            return c
    return None
