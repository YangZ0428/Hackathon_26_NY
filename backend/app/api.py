"""The endpoints. This file only assembles -- no maths lives here.

    GET  /api/profiles        the synthetic people
    GET  /api/options         the plan options, with real timestamps
    POST /api/compare         the one that matters
    GET  /api/citations/{id}  one source, for the "why believe this" tap
    GET  /api/health          includes data_mode, useful when debugging

Run:  uvicorn app.api:app --reload --port 8000
Docs: http://localhost:8000/docs   <- this page IS the contract for B and C
"""

from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import content, geo, weather
from .explain import decompose
from .heat import StrainInputs, band_for, mean_radiant_temp, operative_temp, score
from .schemas import (
    Attribution, Citation, CompareRequest, CompareResponse, Conditions,
    OptionResult, PlanOption, Profile, Resource, Strain, Tradeoff, Verdict,
)

app = FastAPI(title="Climap NYC API", version="0.1.0")

# Wide open on purpose: hackathon, and Vite picks whatever port it likes.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# --- small helpers ----------------------------------------------------------
def _strain_inputs(profile: dict, option: PlanOption, env: dict) -> StrainInputs:
    """Merge the three input sources into the one flat object heat.py wants."""
    return StrainInputs(
        air_temp_c=env["air_temp_c"],
        relative_humidity_pct=env["relative_humidity_pct"],
        wind_ms=env["wind_ms"],
        solar_wm2=env.get("solar_wm2", 0.0),
        canopy_shade=option.canopy_shade,
        age=profile["age"],
        risk_categories=tuple(profile["risk_categories"]),
        acclimatization=profile["acclimatization"],
        activity=profile["activity"],
        clothing=profile["clothing"],
    )


def _tradeoff(baseline: OptionResult, best: OptionResult, profile: dict) -> Tradeoff | None:
    """Name the cost of the recommendation.

    A recommendation that only lists upsides reads as a sales pitch. The early
    morning usually has better heat but worse PM2.5 under the inversion layer,
    so say so. Returns None when there is genuinely no cost.
    """
    before, after = baseline.conditions.pm25_aqi, best.conditions.pm25_aqi
    if before is None or after is None or after <= before:
        return None

    label, guidance_id = content.aqi_category(after)
    sensitive = any(
        r in ("respiratory", "cardiovascular") for r in profile["risk_categories"]
    )
    closing = (
        "Given your breathing condition, this is the line where the answer could "
        "flip -- worth raising with your clinician."
        if sensitive
        else "For you that stays inside EPA's guidance for general activity."
    )
    return Tradeoff(
        text=(f"The honest trade: PM2.5 runs higher at the better heat window "
              f"(AQI {after} vs {before}). That is {label.lower()} on EPA's scale. {closing}"),
        guidance_id=guidance_id,
    )


def _resources(option: PlanOption, custom_location: bool = False) -> list[Resource]:
    """TODO: replace with a live Cool It NYC lookup near option.lat/lon.

    The named places below are hand-picked around the default East Harlem demo
    location. If the user geocoded their own address we do not know what is near
    it, so we drop the distances rather than quote a walk time to a library that
    may be five miles away. Citywide guidance still applies.
    """
    if custom_location:
        return [
            Resource(name="NYC cooling centers — find the nearest open site",
                     kind="cooling_site", distance_label="citywide finder",
                     url="https://www.nyc.gov/site/coolingcenters"),
            Resource(name="NYC Health: extreme heat and your health",
                     kind="guidance", distance_label="read",
                     url="https://www.nyc.gov/site/doh/health/emergency-preparedness/"
                         "emergencies-extreme-weather-heat.page"),
        ]
    if option.canopy_shade > 0.4:
        return [
            Resource(name="Drinking fountain — park entrance at E 110th St",
                     kind="water", distance_label="220 m"),
            Resource(name="Cooling site — Aguilar Library branch",
                     kind="cooling_site", distance_label="480 m",
                     url="https://www.nyc.gov/site/coolingcenters"),
            Resource(name="Shaded benches — north loop, continuous canopy",
                     kind="shade", distance_label="on route"),
        ]
    return [
        Resource(name="Cooling site — Aguilar Library branch",
                 kind="cooling_site", distance_label="650 m",
                 url="https://www.nyc.gov/site/coolingcenters"),
        Resource(name="NYC Health: extreme heat and your health",
                 kind="guidance", distance_label="read",
                 url="https://www.nyc.gov/site/doh/health/emergency-preparedness/"
                     "emergencies-extreme-weather-heat.page"),
    ]


@app.on_event("startup")
def _announce():
    """Say out loud which day we are pinned to.

    Forgetting to export the demo date means the API quietly serves today's
    real forecast. In September that is a mild day, every option lands in the
    Low band, and it looks like the model is broken rather than the weather
    being pleasant. One line in the terminal removes that whole class of panic.
    """
    pinned = weather.demo_date()
    print(f"  Climap NYC: {'pinned to real observations for ' + pinned if pinned else 'LIVE FORECAST (no demo date set -- export CLIMAP_DEMO_DATE=2026-07-03 for the hot day)'}")


# --- endpoints --------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "data_mode": weather.mode()}


@app.get("/api/profiles", response_model=list[Profile])
def profiles():
    return [Profile(**p) for p in content.PROFILES.values()]


@app.get("/api/options", response_model=list[PlanOption])
def options():
    return content.plan_options()


@app.get("/api/citations/{citation_id}", response_model=Citation)
def citation(citation_id: str):
    found = content.citation(citation_id)
    if not found:
        raise HTTPException(404, f"No citation with id {citation_id!r}")
    return Citation(**found)


@app.get("/api/geocode")
def geocode(q: str):
    """Address -> coordinates, keyless, New York City only.

    `requested_url` is returned for the same reason compare returns one: so the
    claim "we really called their public API" is checkable rather than asserted.
    """
    note = content.GUIDANCE.get("coverage_note", "")
    if len(q.strip()) < 3:
        return {"matches": [], "requested_url": None, "provider": None,
                "problem": None, "coverage_note": note}
    result = geo.search(q.strip())
    return {**result, "coverage_note": note}


@app.post("/api/compare", response_model=CompareResponse)
def compare(request: CompareRequest):
    weather.reset_call_log()

    # A profile built in the UI wins over a preset id. Both are synthetic: the
    # form is a persona builder for the demo, not an intake form.
    if request.profile:
        profile = request.profile.model_dump()
    else:
        profile = content.PROFILES.get(request.profile_id)
        if not profile:
            raise HTTPException(404, f"No profile with id {request.profile_id!r}")

    # Caller-supplied options win: the frontend derives them from free windows
    # in the user's day, which places.json cannot know about. It has already
    # applied the geocoded location to them, so no override is needed here.
    catalogue = {o.id: o for o in (request.options or content.plan_options(request.location))}
    unknown = [i for i in request.option_ids if i not in catalogue]
    if unknown:
        raise HTTPException(404, f"Unknown option ids: {unknown}")
    if request.baseline_option_id not in request.option_ids:
        raise HTTPException(400, "baseline_option_id must be one of option_ids")

    # 1. Score every option.
    results: list[OptionResult] = []
    inputs_by_id: dict[str, StrainInputs] = {}

    for option_id in request.option_ids:
        option = catalogue[option_id]
        env = weather.at_hour(option.lat, option.lon, option.when_iso)
        if not env:
            raise HTTPException(503, (
                f"No real weather data for option {option_id!r} at "
                f"{option.when_iso}. The upstream API was unreachable and no "
                f"snapshot covers this hour. Run tools/snapshot.py while online. "
                f"This project never substitutes invented numbers."))
        inputs = _strain_inputs(profile, option, env)
        inputs_by_id[option_id] = inputs

        value = score(inputs)
        band_key, band_label = band_for(value)
        band = content.band_info(band_key)
        tmrt = mean_radiant_temp(inputs.air_temp_c, inputs.solar_wm2, inputs.canopy_shade)

        results.append(OptionResult(
            id=option_id,
            when_label=option.when_label,
            where_label=option.where_label,
            strain=Strain(score=value, band=band_key, band_label=band_label,
                          guidance_id=band["guidance_id"]),
            verdict=Verdict(text=band["verdict_default"], guidance_id=band["guidance_id"]),
            conditions=Conditions(
                air_temp_c=round(inputs.air_temp_c, 1),
                relative_humidity_pct=round(inputs.relative_humidity_pct),
                wind_ms=round(inputs.wind_ms, 1),
                solar_wm2=round(inputs.solar_wm2),
                mean_radiant_temp_c=round(tmrt, 1),
                operative_temp_c=round(operative_temp(inputs.air_temp_c, tmrt, inputs.wind_ms), 1),
                pm25_aqi=env.get("pm25_aqi"),
                ozone_aqi=env.get("ozone_aqi"),
                nws_alert=weather.alert_for(option.lat, option.lon),
                source_ids=env.get("source_ids", []),
            ),
        ))

    # 2. Percentages, relative to the plan the user came in with.
    baseline = next(r for r in results if r.id == request.baseline_option_id)
    reference = baseline.strain.score or 1
    for result in results:
        if result.id != baseline.id:
            result.delta_vs_baseline_pct = int(
                round((result.strain.score - reference) / reference * 100)
            )

    # 3. The best option gets the "go" verdict instead of its band default.
    best = min(results, key=lambda r: r.strain.score)
    if best.id != baseline.id:
        best.verdict = Verdict(text=content.GUIDANCE["best_option_verdict"],
                               guidance_id=best.strain.guidance_id)

    # 4. Explain one comparison: baseline -> whichever option the user tapped.
    focus_id = request.focus_option_id or best.id
    attribution = None
    if focus_id != baseline.id:
        total_drop, factors = decompose(inputs_by_id[baseline.id], inputs_by_id[focus_id])
        if factors:
            attribution = Attribution(from_option_id=baseline.id, to_option_id=focus_id,
                                      total_drop=total_drop, factors=factors)

    return CompareResponse(
        generated_at=datetime.now().isoformat(timespec="seconds"),
        profile=Profile(**profile),
        baseline_option_id=baseline.id,
        options=results,
        attribution=attribution,
        tradeoff=_tradeoff(baseline, best, profile),
        resources=_resources(catalogue[focus_id], custom_location=request.location is not None),
        assumptions=content.GUIDANCE["assumptions"],
        citations=[Citation(**c) for c in content.GUIDANCE["citations"]],
        data_mode=weather.mode(),
        date_context=weather.demo_date(),
        requested_urls=weather.called_urls(),
    )
