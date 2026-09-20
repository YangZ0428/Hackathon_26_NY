/**
 * Climap NYC backend client.
 *
 * Start the API first:
 *   cd backend && source .venv/bin/activate
 *   export CLIMAP_DEMO_DATE=2026-07-03
 *   python3 -m uvicorn app.api:app --reload --port 8000
 *
 * The backend allows any origin, so no Vite proxy is needed.
 * Interactive contract: http://localhost:8000/docs
 */

const BASE = import.meta.env["VITE_API_BASE"] ?? "http://localhost:8000";

// ---------------------------------------------------------------- types
export type Band = "low" | "moderate" | "high" | "extreme";

export type Profile = {
  id: string;
  display_name: string;
  note: string;
  zip_code: string;
  age: number;
  risk_categories: string[];
  acclimatization: "low" | "typical" | "high";
  activity: string;
  activity_minutes: number;
  clothing: string;
  synthetic: boolean;
};

export type PlanOption = {
  id: string;
  when_label: string;
  when_iso: string;
  where_label: string;
  lat: number;
  lon: number;
  canopy_shade: number;
};

export type GeoLocation = {
  label: string;
  lat: number;
  lon: number;
  zip_code: string;
};

export type GeocodeResult = {
  matches: Array<GeoLocation & { full_label: string }>;
  requested_url: string | null;
  /** Which geocoder answered: "photon" or "census" (both street level), or
   *  "open-meteo" (neighbourhood level last resort). */
  provider: string | null;
  /** Every provider tried, in order, with what it returned. For debugging a
   *  lookup that came back empty. */
  attempts?: Array<{ provider: string; url: string | null; found: number; problem: string | null }>;
  /** Non-null when BOTH geocoders failed. Surfaced in the UI rather than
   *  swallowed, so "no results" is never confused with "provider is down". */
  problem: string | null;
  coverage_note: string;
};

export type Conditions = {
  air_temp_c: number;
  relative_humidity_pct: number;
  wind_ms: number;
  solar_wm2: number;
  mean_radiant_temp_c: number;
  operative_temp_c: number;
  pm25_aqi: number | null;
  ozone_aqi: number | null;
  nws_alert: string | null;
  source_ids: string[];
};

export type OptionResult = {
  id: string;
  when_label: string;
  where_label: string;
  strain: {
    score: number;
    band: Band;
    band_label: string;
    scale: string;
    guidance_id: string;
  };
  delta_vs_baseline_pct: number | null; // null on the baseline option itself
  verdict: { text: string; guidance_id: string };
  conditions: Conditions;
};

export type Attribution = {
  from_option_id: string;
  to_option_id: string;
  total_drop: number;
  factors: Array<{
    key: "air" | "sun" | "canopy" | "wind" | "humidity";
    label: string;
    share_pct: number;
    lever: string;
  }>;
  method: string;
};

export type Citation = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  verified: string;
};

export type CompareResponse = {
  generated_at: string;
  data_mode: "live" | "cached" | "offline_fixture";
  date_context: string | null; // non-null => historical data, label it on screen
  requested_urls: string[];
  baseline_option_id: string;
  profile: Profile;
  options: OptionResult[];
  attribution: Attribution | null;
  tradeoff: { text: string; guidance_id: string | null } | null;
  resources: Array<{
    name: string;
    kind: "water" | "cooling_site" | "shade" | "guidance";
    distance_label: string;
    url: string | null;
  }>;
  assumptions: string[];
  citations: Citation[];
};

// ---------------------------------------------------------------- calls
async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  return response.json() as Promise<T>;
}

export const fetchProfiles = () => get<Profile[]>("/api/profiles");
export const fetchOptions = () => get<PlanOption[]>("/api/options");
export const fetchCitation = (id: string) => get<Citation>(`/api/citations/${id}`);

/** Address -> coordinates. Keyless (Nominatim), and New York City only:
 *  canopy cover comes from the NYC Street Tree Census, so an address outside
 *  the city would get real weather attached to invented tree data. */
export const fetchGeocode = (q: string) =>
  get<GeocodeResult>(`/api/geocode?q=${encodeURIComponent(q)}`);

export async function fetchCompare(args: {
  /** A preset persona. Ignored when `profile` is given. */
  profileId?: string | undefined;
  /** A persona built in the form. Wins over profileId. */
  profile?: Profile | undefined;
  /** A geocoded address. Every option is then evaluated at these coordinates,
   *  which is what makes the address on screen match `requested_urls`. */
  location?: GeoLocation | undefined;
  optionIds: string[];
  /** Plan options built by the caller -- times taken from the user's free
   *  windows rather than the fixed slots in the backend's places.json. */
  options?: PlanOption[] | undefined;
  baselineOptionId: string;
  focusOptionId?: string | undefined;
}): Promise<CompareResponse> {
  const response = await fetch(`${BASE}/api/compare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profile_id: args.profileId,
      profile: args.profile,
      location: args.location,
      option_ids: args.optionIds,
      options: args.options,
      baseline_option_id: args.baselineOptionId,
      focus_option_id: args.focusOptionId,
    }),
  });
  if (!response.ok) {
    // The backend returns 503 rather than inventing numbers when upstream is
    // unreachable. Surface that message instead of a blank screen.
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `compare → ${response.status}`);
  }
  return response.json();
}

// ---------------------------------------------------------------- helpers
/** Maps a strain band to the design system's two tones. */
export function toneFor(band: Band): "good" | "warm" {
  return band === "low" || band === "moderate" ? "good" : "warm";
}
