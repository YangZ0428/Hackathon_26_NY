"""The response shape. FROZEN -- the frontend is already built against this.

Everything else in this project can be rewritten freely. This file cannot,
without telling B and C first. Field names and nesting are the contract.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

# The six fields the problem statement names for a person, and nothing more.
RiskCategory = Literal[
    "none", "older_adult", "heat_sensitive_medication",
    "cardiovascular", "respiratory",
]
ActivityKey = Literal["rest", "walk_easy", "walk_brisk", "run", "cycle", "manual_work"]
ClothingKey = Literal["minimal", "light", "standard", "athletic", "covered"]
Acclimatization = Literal["low", "typical", "high"]
Band = Literal["low", "moderate", "high", "extreme"]


class Profile(BaseModel):
    id: str
    display_name: str
    zip_code: str
    age: int
    risk_categories: list[RiskCategory] = ["none"]
    acclimatization: Acclimatization = "typical"
    activity: ActivityKey
    activity_minutes: int
    clothing: ClothingKey
    note: str = ""
    synthetic: bool = True


class PlanOption(BaseModel):
    """One version of the same plan: a time and a place."""
    id: str
    when_label: str
    when_iso: str
    where_label: str
    lat: float
    lon: float
    canopy_shade: float = Field(ge=0.0, le=1.0)


class Conditions(BaseModel):
    air_temp_c: float
    relative_humidity_pct: float
    wind_ms: float
    solar_wm2: float
    mean_radiant_temp_c: float
    operative_temp_c: float
    pm25_aqi: Optional[int] = None
    ozone_aqi: Optional[int] = None
    nws_alert: Optional[str] = None
    source_ids: list[str] = []


class Strain(BaseModel):
    score: int = Field(ge=0, le=100)
    band: Band
    band_label: str
    scale: str = "0-100 modeled heat strain for this person doing this activity"
    guidance_id: str


class Verdict(BaseModel):
    text: str
    guidance_id: str


class OptionResult(BaseModel):
    id: str
    when_label: str
    where_label: str
    strain: Strain
    delta_vs_baseline_pct: Optional[int] = None  # None on the baseline itself
    verdict: Verdict
    conditions: Conditions


class FactorContribution(BaseModel):
    key: Literal["air", "sun", "canopy", "wind", "humidity"]
    label: str
    share_pct: int
    lever: str  # what the user can actually do about this factor


class Attribution(BaseModel):
    from_option_id: str
    to_option_id: str
    total_drop: int
    factors: list[FactorContribution]
    method: str = (
        "One-at-a-time ablation: each factor is held at the baseline option's value "
        "and the model re-run. Shares are normalized because the model is non-linear, "
        "so they are approximate."
    )


class Tradeoff(BaseModel):
    text: str
    guidance_id: Optional[str] = None


class Resource(BaseModel):
    name: str
    kind: Literal["water", "cooling_site", "shade", "guidance"]
    distance_label: str
    url: Optional[str] = None


class Citation(BaseModel):
    id: str
    title: str
    publisher: str
    url: str
    verified: str


class Location(BaseModel):
    """A real, geocoded place. Overrides the coordinates in places.json.

    The lat/lon here is what actually gets sent to Open-Meteo, so the address on
    screen and the coordinates in `requested_urls` are the same place. That is
    the point: the address is verifiable, not decorative.
    """
    label: str          # what to show, e.g. "E 110th St & 2nd Ave"
    lat: float
    lon: float
    zip_code: str = ""


class CompareRequest(BaseModel):
    # Either a preset id or a profile built live in the UI. The inline one wins.
    profile_id: Optional[str] = None
    profile: Optional[Profile] = None
    # When present, every option is evaluated at THIS place instead of the
    # coordinates baked into places.json. Canopy still comes from the place --
    # a street and a shaded path a block apart sit in the same weather grid
    # cell, so tree cover is genuinely the thing that differs between them.
    location: Optional[Location] = None
    # Normally ids into places.json. When `options` is supplied the caller is
    # building its own -- times taken from the user's calendar rather than the
    # fixed slots in the data file -- and these are just the ids within it.
    option_ids: list[str] = Field(min_length=2, max_length=5)
    options: Optional[list[PlanOption]] = None
    baseline_option_id: str
    focus_option_id: Optional[str] = None  # defaults to the lowest-strain option

    @model_validator(mode="after")
    def _one_of(self):
        if not self.profile_id and not self.profile:
            raise ValueError("Pass either profile_id or profile")
        return self


class CompareResponse(BaseModel):
    generated_at: str
    profile: Profile
    baseline_option_id: str
    options: list[OptionResult]
    attribution: Optional[Attribution]
    tradeoff: Optional[Tradeoff]
    resources: list[Resource]
    assumptions: list[str]
    citations: list[Citation]
    data_mode: Literal["live", "cached", "offline_fixture"]
    # Additive, safe for the frontend. None = live forecast. A date string means
    # the numbers are real observations from that past day, and the UI should
    # say so rather than implying they are today's.
    date_context: Optional[str] = None
    # The exact public endpoints hit while building this response. Nothing is
    # proxied or pre-baked; paste one into a browser and you get the same data.
    requested_urls: list[str] = []
