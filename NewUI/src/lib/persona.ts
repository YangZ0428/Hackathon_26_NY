/**
 * The form <-> model seam.
 *
 * The profile form lets you tick eleven conditions. The heat model understands
 * four risk categories. Pretending otherwise is the fastest way to lose a
 * judge: they tick "Diabetes", the score does not move, and everything else on
 * screen becomes suspect.
 *
 * So the mapping is explicit and it is visible in the UI. `modelled: false`
 * conditions are shown with a quiet "not yet in the model" marker. They are
 * real heat-risk factors -- diabetes impairs thermoregulation and pregnancy
 * raises baseline core temperature, both are in CDC heat guidance -- we just
 * have not built them in yet. Saying so is more credible than hiding them.
 *
 * Everything here produces a SYNTHETIC persona. The problem statement rules out
 * real patient data, and the form is a persona builder, not an intake form.
 */
import type { Profile } from "./api";

export type RiskCategory =
  | "none" | "older_adult" | "heat_sensitive_medication"
  | "cardiovascular" | "respiratory";

export type ConditionOption = {
  id: string;
  label: string;
  /** Which model risk category it feeds, or null if the model ignores it. */
  maps_to: RiskCategory | null;
  /** Shown on the "not yet modelled" ones, so the gap is documented not hidden. */
  note?: string;
};

export const CONDITIONS: ConditionOption[] = [
  { id: "asthma", label: "Asthma", maps_to: "respiratory" },
  { id: "allergies", label: "Allergies", maps_to: null,
    note: "Needs a pollen feed we have not wired up." },
  { id: "hypertension", label: "High blood pressure", maps_to: "cardiovascular" },
  { id: "diabetes", label: "Diabetes", maps_to: null,
    note: "A real heat risk factor (impaired sweating). Not yet in the model." },
  { id: "heart_disease", label: "Heart disease", maps_to: "cardiovascular" },
  { id: "arthritis", label: "Arthritis", maps_to: null,
    note: "Affects mobility, not heat strain directly." },
  { id: "eczema", label: "Eczema / skin sensitivity", maps_to: null,
    note: "Not yet in the model." },
  { id: "migraine", label: "Migraine", maps_to: null,
    note: "Heat is a common trigger. Not yet in the model." },
  { id: "copd", label: "COPD", maps_to: "respiratory" },
  { id: "pregnancy", label: "Pregnancy", maps_to: null,
    note: "Raises baseline core temperature. Not yet in the model." },
];

/** Medications that change how a body handles heat.
 *
 *  This is a real mechanism, not a box-ticking exercise: anticholinergics
 *  suppress sweating, beta blockers cut skin blood flow, diuretics reduce blood
 *  volume, and stimulants raise heat production while dulling the sense of
 *  overheating. All of them appear in CDC and NWS heat guidance.
 *
 *  Corticosteroids do not belong in that group -- an inhaler is asthma control,
 *  not a thermoregulatory drug -- so it is listed and marked, rather than
 *  quietly folded in to make the list look longer.
 *
 *  IMPORTANT: the model has exactly ONE medication factor. Ticking three of
 *  these is the same as ticking one. The form says so, because a user who
 *  ticks more and sees no change would reasonably conclude the whole thing is
 *  theatre. */
export const MEDICATIONS: ConditionOption[] = [
  { id: "antihistamines", label: "Antihistamines (allergy relief)",
    maps_to: "heat_sensitive_medication" },
  { id: "beta_blockers", label: "Blood pressure medications (beta blockers)",
    maps_to: "heat_sensitive_medication" },
  { id: "diuretics", label: "Diuretics (water pills)",
    maps_to: "heat_sensitive_medication" },
  { id: "antidepressants", label: "Antidepressants",
    maps_to: "heat_sensitive_medication" },
  { id: "stimulants", label: "ADHD stimulant medications",
    maps_to: "heat_sensitive_medication" },
  { id: "corticosteroids", label: "Corticosteroids (e.g., inhalers, prednisone)",
    maps_to: null,
    note: "Treats the airway rather than heat tolerance. Not a heat factor in our model." },
  { id: "other_medication", label: "Other", maps_to: null,
    note: "We cannot map a medication we have not named." },
];

/** Age alone adds strain continuously; this category is the extra step change
 *  the problem statement calls out for older adults. Ticked automatically. */
export const OLDER_ADULT_AGE = 65;

export const OUTDOOR_OPTIONS = ["Rarely", "Sometimes", "Regular", "Daily"] as const;
export type OutdoorOption = (typeof OUTDOOR_OPTIONS)[number];

/** How much you are outside is a decent stand-in for how heat-acclimatised you
 *  are. Four labels onto the model's three levels -- lossy, and deliberately so
 *  rather than inventing a fourth level the model does not have. */
const ACCLIMATIZATION: Record<OutdoorOption, Profile["acclimatization"]> = {
  Rarely: "low",
  Sometimes: "typical",
  Regular: "typical",
  Daily: "high",
};

export const ACTIVITIES = [
  { key: "walk_easy", label: "An easy walk" },
  { key: "walk_brisk", label: "A brisk walk" },
  { key: "run", label: "A run" },
  { key: "cycle", label: "A bike ride" },
  { key: "manual_work", label: "Work outdoors" },
] as const;

export type PersonaDraft = {
  name: string;
  age: string;
  conditionIds: string[];
  medicationIds: string[];
  outdoor: OutdoorOption;
  activity: string;
  minutes: string;
  address: string;
  lat: number | null;
  lon: number | null;
  zip: string;
};

export const EMPTY_DRAFT: PersonaDraft = {
  name: "", age: "", conditionIds: [], medicationIds: [], outdoor: "Regular",
  activity: "walk_easy", minutes: "30",
  address: "", lat: null, lon: null, zip: "",
};

/** Which ticked conditions the model will actually act on. Used by the form to
 *  show, before you submit, what is going to count. */
export function modelledRisks(
  conditionIds: string[], age: number, medicationIds: string[] = [],
): RiskCategory[] {
  const risks = new Set<RiskCategory>();
  for (const [ids, catalogue] of [
    [conditionIds, CONDITIONS], [medicationIds, MEDICATIONS],
  ] as const) {
    for (const id of ids) {
      const found = catalogue.find((c) => c.id === id);
      if (found?.maps_to) risks.add(found.maps_to);
    }
  }
  // A Set, so five heat-sensitive medications collapse to one risk category --
  // which is exactly what the model does with them.
  if (age >= OLDER_ADULT_AGE) risks.add("older_adult");
  return [...risks];
}

export function draftToProfile(draft: PersonaDraft): Profile {
  const age = Number(draft.age) || 35;
  const risks = modelledRisks(draft.conditionIds, age, draft.medicationIds);
  return {
    id: "custom",
    display_name: draft.name.trim() || "Guest",
    note: "Built in the profile form for this demo. Synthetic.",
    zip_code: draft.zip || "10029",
    age,
    risk_categories: risks.length ? risks : ["none"],
    acclimatization: ACCLIMATIZATION[draft.outdoor],
    activity: draft.activity,
    activity_minutes: Number(draft.minutes) || 30,
    clothing: "light",
    synthetic: true,
  };
}

// --- the personas you build, and which one is showing --------------------
// localStorage rather than sessionStorage: on stage the app may well be open
// in a second tab (laptop screen + projector), and sessionStorage is per-tab,
// so personas built in one would be invisible in the other. Everything stored
// here is synthetic by construction -- see the notice on the form.
const KEY = "climap.personas";
const SELECTED_KEY = "climap.personas.selected";

export type StoredPersona = PersonaDraft & { uid: string };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export const loadPersonas = (): StoredPersona[] =>
  // Personas stored before a field existed would otherwise arrive missing it,
  // and the first `.includes` on undefined takes the whole page down. Anything
  // already saved is upgraded on read rather than migrated.
  read<StoredPersona[]>(KEY, []).map((persona) => ({
    ...EMPTY_DRAFT, ...persona,
    conditionIds: persona.conditionIds ?? [],
    medicationIds: persona.medicationIds ?? [],
  }));

export const loadSelected = (): string | null => read<string | null>(SELECTED_KEY, null);

export function selectPersona(uid: string | null) {
  write(SELECTED_KEY, uid);
}

/** Appends a persona and makes it the active one. Returns it with its uid. */
export function addPersona(draft: PersonaDraft): StoredPersona {
  const stored: StoredPersona = { ...draft, uid: `p${Date.now().toString(36)}` };
  write(KEY, [...loadPersonas(), stored]);
  write(SELECTED_KEY, stored.uid);
  return stored;
}

/** The persona currently being scored, if it is one of ours. */
export function selectedPersona(): StoredPersona | null {
  const uid = loadSelected();
  return uid ? loadPersonas().find((persona) => persona.uid === uid) ?? null : null;
}

/** Edit in place, keeping the uid so the selection and the chip survive.
 *  Without this, going back to the form to change one field would mint a second
 *  person instead of changing the score of the one on screen. */
export function updatePersona(uid: string, draft: PersonaDraft): StoredPersona[] {
  const next = loadPersonas().map((persona) =>
    persona.uid === uid ? { ...draft, uid } : persona);
  write(KEY, next);
  return next;
}

/** Removes one. If it was the active one, the selection falls back to whatever
 *  is left, and to the presets when nothing is. */
export function removePersona(uid: string): StoredPersona[] {
  const left = loadPersonas().filter((persona) => persona.uid !== uid);
  write(KEY, left);
  if (loadSelected() === uid) write(SELECTED_KEY, left.length ? left[left.length - 1]!.uid : null);
  return left;
}

// --- which preset people are hidden, and whether onboarding is done --------
// Presets live in the backend's profiles.json; "deleting" one here only hides
// it from this browser, so the data and the API contract stay untouched and a
// reset brings them all back.
const HIDDEN_KEY = "climap.presets.hidden";
const ONBOARDED_KEY = "climap.onboarded";

export const hiddenPresets = (): string[] => read<string[]>(HIDDEN_KEY, []);

export function hidePreset(id: string): string[] {
  const next = [...new Set([...hiddenPresets(), id])];
  write(HIDDEN_KEY, next);
  return next;
}

export function resetPresets(): string[] {
  write(HIDDEN_KEY, []);
  return [];
}

/** Opening the app sends you to the profile form first. Both buttons there
 *  clear this, so "skip" is a real skip and not a loop back to the same page.
 *
 *  sessionStorage, NOT localStorage, and the difference is the whole point:
 *
 *    refresh the main page   -> flag survives, you stay put
 *    new tab, or reopen      -> flag is gone, you start at the form again
 *
 *  So a demo always opens on the form, while refreshing mid-demo does not
 *  throw you back to it. The personas themselves stay in localStorage and
 *  outlive all of this. */
export const hasOnboarded = (): boolean => {
  try { return sessionStorage.getItem(ONBOARDED_KEY) === "1"; } catch { return false; }
};

export const markOnboarded = () => {
  try { sessionStorage.setItem(ONBOARDED_KEY, "1"); } catch { /* private mode */ }
};
