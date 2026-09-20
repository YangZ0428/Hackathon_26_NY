"""The heat strain model. Read this file first -- it is the heart of the project.

Question it answers: how hard will this person's body have to work to stay at a
safe temperature, doing THIS activity, at THIS time and place?

Five steps, each one a named function you can test and explain on its own:

    1. sun + canopy          -> mean radiant temperature   (how hot the surroundings radiate)
    2. that + air + wind     -> operative temperature      (what the body actually feels)
    3. + humidity            -> sweat gets less effective
    4. + activity + clothing -> your own heat, and how much escapes
    5. -> 0..100, x person vulnerability

This is a simplified member of the UTCI / operative-temperature family. Being
able to name the family matters: a judge can look it up.

WHAT IT IS NOT: a prediction of anyone's health outcome. It estimates and
compares EXPOSURE. The score describes the PLAN, given the person -- same
person, three plans, three scores. Do not let that drift.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Every tunable number lives here. Never inline a constant in a function body:
# at 8pm nobody will remember why a score is what it is.
# ---------------------------------------------------------------------------
CAL = {
    "MRT_GAIN": 2.6,        # degC of radiant heating per 100 W/m2 of sun on you
    "H_RADIATIVE": 4.7,     # radiative heat transfer coefficient, W/m2K
    "HUM_GAIN": 0.30,       # degC added per hPa of vapour pressure above the pivot
    "HUM_PIVOT": 12.0,      # hPa; below this, humidity is not making things worse
    "MET_GAIN": 1.2,        # degC-equivalent per MET of effort above resting
    "MET_CAP": 12.0,        # effort cannot add more than this
    "CLO_GAIN": 2.5,        # degC-equivalent per clo above the pivot
    "CLO_PIVOT": 0.40,      # clo; light summer clothing
    "SCALE_MIN": 18.0,      # effective degC that maps to a score of 0
    # 64, not 55: the vulnerability multiplier is applied AFTER this
    # normalization and reaches 1.40 (VULN_CAP), so the pre-multiplier score
    # must top out near 71 or the most vulnerable profiles clamp at 100 and
    # every option looks identical to them. 55 hid the canopy effect entirely.
    "SCALE_MAX": 64.0,      # effective degC that maps to a score of 100
    "AGE_PIVOT": 60,        # vulnerability starts rising above this age
    "AGE_PER_YEAR": 0.008,
    "VULN_CAP": 0.40,       # vulnerability multiplier tops out at 1.40
}

# Metabolic equivalents. Resting is 1.2; a brisk walk is roughly 4x that.
MET = {
    "rest": 1.2, "walk_easy": 2.8, "walk_brisk": 4.3,
    "run": 9.0, "cycle": 6.8, "manual_work": 5.5,
}

# Clothing insulation in clo. More insulation = less heat escapes.
CLO = {
    "minimal": 0.25, "athletic": 0.35, "light": 0.40,
    "standard": 0.60, "covered": 0.90,
}

# How much each risk category raises heat vulnerability.
# Keep in sync with the sources named in data/guidance.json.
RISK_WEIGHT = {
    "none": 0.00,
    "older_adult": 0.06,
    "heat_sensitive_medication": 0.15,  # diuretics, beta blockers, antipsychotics...
    "cardiovascular": 0.12,
    "respiratory": 0.04,                # matters more for air quality than heat
}

# Someone used to the heat handles it better. Someone who has been indoors does not.
ACCLIM_WEIGHT = {"low": 0.05, "typical": 0.0, "high": -0.06}

# Band ceilings. TODO before the pitch: anchor these to NWS HeatRisk levels and
# the EPA AirNow activity-guidance table instead of round numbers.
BANDS = [(34, "low", "Low"), (64, "moderate", "Moderate"),
         (84, "high", "High"), (100, "extreme", "Extreme")]


@dataclass
class StrainInputs:
    """Flat on purpose: explain.py swaps single fields to measure their effect.

    Nested structures would make that ugly. Keep it flat.
    """
    # from the weather API
    air_temp_c: float
    relative_humidity_pct: float
    wind_ms: float
    solar_wm2: float
    # from the place
    canopy_shade: float
    # from the person -- exactly the six fields the brief names
    age: int
    risk_categories: tuple[str, ...]
    acclimatization: str
    activity: str
    clothing: str


# --- step 1 -----------------------------------------------------------------
def mean_radiant_temp(air_temp_c: float, solar_wm2: float, canopy_shade: float) -> float:
    """How hot the surroundings radiate at you.

    Standing in full sun, this runs 15-25 degC above air temperature. Under a
    tree it collapses back toward air temperature -- which is the entire reason
    the park route scores better at the same hour.

    Canopy is the only shade data that exists city-wide, so it stands in for all
    shade. That assumption is stated on the page.
    """
    solar_reaching_you = max(0.0, solar_wm2) * (1.0 - min(max(canopy_shade, 0.0), 1.0))
    return air_temp_c + CAL["MRT_GAIN"] * solar_reaching_you / 100.0


# --- step 2 -----------------------------------------------------------------
def operative_temp(air_temp_c: float, tmrt_c: float, wind_ms: float) -> float:
    """What the body actually feels: air and radiation, weighted by wind.

        To = (hc * Ta + hr * Tmrt) / (hc + hr)

    hc is convective transfer and rises with wind, so more wind pulls the felt
    temperature back toward plain air temperature. hr is radiative and roughly
    constant for a clothed person.

    Use this standard form rather than an ad-hoc weighting: you can name it, and
    a reviewer can look it up.
    """
    hc = 8.3 * max(wind_ms, 0.15) ** 0.6
    hr = CAL["H_RADIATIVE"]
    return (hc * air_temp_c + hr * tmrt_c) / (hc + hr)


# --- step 3 -----------------------------------------------------------------
def vapour_pressure_hpa(air_temp_c: float, rh_pct: float) -> float:
    """Magnus formula. Humid air carries more water, so sweat evaporates less,
    so the same temperature is harder on you. This converts humidity into a
    number we can add to a temperature."""
    saturation = 6.105 * math.exp(17.27 * air_temp_c / (237.7 + air_temp_c))
    return (rh_pct / 100.0) * saturation


# --- step 5 (the person) ----------------------------------------------------
def vulnerability(age: int, risk_categories, acclimatization: str) -> float:
    """The 'understanding the person' layer. Returns a multiplier >= 0.90.

    This is what makes the same weather give Mei and Jordan different answers.
    It is the single most important function for the demo.
    """
    extra = 0.0
    if age > CAL["AGE_PIVOT"]:
        extra += (age - CAL["AGE_PIVOT"]) * CAL["AGE_PER_YEAR"]
    for risk in risk_categories:
        extra += RISK_WEIGHT.get(risk, 0.0)
    extra += ACCLIM_WEIGHT.get(acclimatization, 0.0)
    extra = max(-0.10, min(extra, CAL["VULN_CAP"]))
    return 1.0 + extra


# --- steps 1-4 chained ------------------------------------------------------
def effective_temp_c(i: StrainInputs) -> float:
    """Everything except the person, as one degC-equivalent number."""
    tmrt = mean_radiant_temp(i.air_temp_c, i.solar_wm2, i.canopy_shade)
    felt = operative_temp(i.air_temp_c, tmrt, i.wind_ms)

    humidity = vapour_pressure_hpa(i.air_temp_c, i.relative_humidity_pct)
    felt += max(0.0, CAL["HUM_GAIN"] * (humidity - CAL["HUM_PIVOT"]))

    effort = MET.get(i.activity, 2.8)
    felt += min(CAL["MET_CAP"], CAL["MET_GAIN"] * max(0.0, effort - MET["rest"]))

    insulation = CLO.get(i.clothing, 0.40)
    felt += CAL["CLO_GAIN"] * (insulation - CAL["CLO_PIVOT"])

    return felt


# --- the number the UI shows ------------------------------------------------
def score(i: StrainInputs) -> int:
    """0-100 for this plan, given this person."""
    raw = (effective_temp_c(i) - CAL["SCALE_MIN"]) / (CAL["SCALE_MAX"] - CAL["SCALE_MIN"])
    raw = max(0.0, min(raw * 100.0, 100.0))
    adjusted = raw * vulnerability(i.age, i.risk_categories, i.acclimatization)
    return int(round(max(0.0, min(adjusted, 100.0))))


def band_for(s: int) -> tuple[str, str]:
    """Score -> ('high', 'High'). Returns key and display label."""
    for ceiling, key, label in BANDS:
        if s <= ceiling:
            return key, label
    return "extreme", "Extreme"
