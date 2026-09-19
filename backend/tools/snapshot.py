"""Warm the offline fixture. RUN THIS BEFORE YOU PRESENT.

    python tools/snapshot.py

Fetches every option's point series once and writes it to
fixtures/conditions_snapshot.json. With STILLGO_OFFLINE=1 the API then serves
entirely from that file -- no network, no surprises on stage.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import weather as cond
from app.content import plan_options as build_options

def main():
    out = {}
    for o in build_options():
        key = f"{o.lat:.3f},{o.lon:.3f}"
        if key in out:
            continue
        print(f"fetching {o.where_label} ({key}) ...")
        out[key] = cond.series_for(o.lat, o.lon)
    cond.FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    cond.FIXTURE.write_text(json.dumps(out))
    kb = cond.FIXTURE.stat().st_size / 1024
    print(f"wrote {cond.FIXTURE} ({kb:.0f} KB, {len(out)} points)")

if __name__ == "__main__":
    main()
