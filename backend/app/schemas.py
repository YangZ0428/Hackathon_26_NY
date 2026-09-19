"""The response shape. FROZEN -- the frontend is already built against this.

Everything else in this project can be rewritten freely. This file cannot,
without telling B and C first. Field names and nesting are the contract.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

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


class CompareRequest(BaseModel):
    profile_id: str
    option_ids: list[str] = Field(min_length=2, max_length=5)
    baseline_option_id: str
    focus_option_id: Optional[str] = None  # defaults to the lowest-strain option


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
