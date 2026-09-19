"""Why is option C better than option A?

Method: one-at-a-time ablation.

    Take the better option. Put ONE factor back to the worse option's value.
    Re-run the model. However much of the improvement disappears, that is how
    much that factor was worth.

Repeat for each factor, normalize to 100%, done.

Two things to say out loud when presenting this:

  * The model is non-linear, so the contributions do NOT sum exactly to the
    total. We normalize, and we say so in the response.
  * Every factor carries a "lever" -- what the user can actually do about it.
    That line is the difference between a chart and a piece of advice.
"""

from __future__ import annotations

from dataclasses import replace

from .heat import StrainInputs, score

FACTORS = [
    {
        "key": "air", "label": "Air temperature",
        "fields": ("air_temp_c",),
        "lever": "This is why changing the time matters most.",
    },
    {
        "key": "sun", "label": "Sun on your body",
        "fields": ("solar_wm2",),
        "lever": "Shade or cloud cover eats into this one.",
    },
    {
        "key": "canopy", "label": "Tree canopy shade",
        "fields": ("canopy_shade",),
        "lever": "This is what the park route earns you.",
    },
    {
        "key": "wind", "label": "Wind",
        "fields": ("wind_ms",),
        "lever": "Not something you can plan around.",
    },
    {
        "key": "humidity", "label": "Humidity",
        "fields": ("relative_humidity_pct",),
        "lever": "Moves with the time of day, not with where you go.",
    },
]


def decompose(base: StrainInputs, better: StrainInputs) -> tuple[int, list[dict]]:
    """Return (total_drop, factor rows sorted high to low).

    total_drop is positive when `better` really is better than `base`.
    An empty factor list means there was nothing to explain.
    """
    total_drop = score(base) - score(better)
    if total_drop <= 0:
        return total_drop, []

    # Measure each factor by taking it away.
    measured: list[tuple[dict, float]] = []
    for factor in FACTORS:
        pinned_back = replace(
            better, **{name: getattr(base, name) for name in factor["fields"]}
        )
        improvement_lost = score(pinned_back) - score(better)
        measured.append((factor, max(0.0, float(improvement_lost))))

    total_measured = sum(value for _, value in measured)
    if total_measured <= 0:
        return total_drop, []

    rows = [
        {
            "key": f["key"],
            "label": f["label"],
            "share_pct": int(round(value / total_measured * 100)),
            "lever": f["lever"],
        }
        for f, value in measured
        if round(value / total_measured * 100) > 0
    ]
    rows.sort(key=lambda r: r["share_pct"], reverse=True)

    # Rounding can leave the shares a point or two off 100. Absorb it in the
    # largest factor so the stacked bar on the page always fills.
    drift = 100 - sum(r["share_pct"] for r in rows)
    if rows and drift:
        rows[0]["share_pct"] += drift

    return total_drop, rows
