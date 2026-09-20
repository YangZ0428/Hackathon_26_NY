"""Find the real heat-wave days to demo on.

Today's weather may be mild, and a mild day makes the whole comparison flat.
Open-Meteo's archive API serves REAL past observations -- same public endpoint
family, still no API key -- so we can demo on a day that actually was hot.

    python tools/find_hot_day.py

Then set the date you pick and restart:

    export CLIMAP_DEMO_DATE=2026-07-15
    python3 -m uvicorn app.api:app --reload --port 8000

Say it out loud when presenting: "this is real observed data from July, because
September isn't hot enough to show the comparison." That is honest and it shows
you know what you are demonstrating.
"""

import sys

import httpx

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"

LAT, LON = 40.7914, -73.9440          # East Harlem, same point as places.json
START, END = "2026-06-01", "2026-09-10"


def main() -> None:
    try:
        response = httpx.get(ARCHIVE, timeout=30, params={
            "latitude": LAT, "longitude": LON,
            "start_date": START, "end_date": END,
            "daily": "temperature_2m_max,temperature_2m_min",
            "timezone": "America/New_York",
        })
        payload = response.json()
    except Exception as exc:
        sys.exit(f"Could not reach the archive API: {type(exc).__name__}: {exc}")

    daily = payload.get("daily")
    if not daily:
        sys.exit(f"Unexpected response: {str(payload)[:300]}")

    rows = [
        (date, high, low)
        for date, high, low in zip(
            daily["time"], daily["temperature_2m_max"], daily["temperature_2m_min"]
        )
        if high is not None
    ]
    rows.sort(key=lambda r: -r[1])

    print(f"Hottest days at {LAT}, {LON} between {START} and {END}")
    print("(real observations from Open-Meteo's archive, no API key)\n")
    for date, high, low in rows[:12]:
        print(f"  {date}   high {high:5.1f} C ({high * 9 / 5 + 32:.0f} F)"
              f"   low {low:5.1f} C")

    if rows:
        best = rows[0][0]
        print(f"\nPick one, then:\n\n    export CLIMAP_DEMO_DATE={best}\n"
              f"    python3 -m uvicorn app.api:app --reload --port 8000\n")
        print("The day AFTER the one you pick supplies the 'tomorrow morning'\n"
              "option, so prefer a hot day followed by a cooler one -- that is\n"
              "the contrast the demo is built on.")


if __name__ == "__main__":
    main()
