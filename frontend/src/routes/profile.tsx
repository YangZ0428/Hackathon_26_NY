/**
 * The persona builder. Fill it in on stage, hit continue, and the main page
 * scores that person against the same three plan options.
 *
 * Two things here are deliberate and worth defending if asked:
 *
 *  1. Conditions the model does not use are still listed, and marked. Hiding
 *     them would imply the model is more complete than it is; removing them
 *     would lose the roadmap. The marker is the honest middle.
 *  2. The address is geocoded for real, and the coordinates it returns are the
 *     ones the weather call uses. Type an address, and the lat/lon in
 *     `requested_urls` on the next screen will match it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Check, Leaf, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { type GeoLocation, fetchGeocode } from "@/lib/api";
import {
  ACTIVITIES, CONDITIONS, EMPTY_DRAFT, OLDER_ADULT_AGE, OUTDOOR_OPTIONS,
  type OutdoorOption, type PersonaDraft,
  addPersona, markOnboarded, modelledRisks,
} from "@/lib/persona";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Build a profile — Climap NYC" },
      { name: "description", content: "Describe a person and Climap NYC will score the same plan for them at different times and places, using real public forecast data." },
      { property: "og:title", content: "Build a profile — Climap NYC" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProfilePage,
});

const calendarOptions = [
  { id: "google", label: "Google Calendar" },
  { id: "outlook", label: "Outlook" },
  { id: "ios", label: "Apple Calendar (iOS)" },
];

const RISK_LABEL: Record<string, string> = {
  older_adult: "older adult",
  heat_sensitive_medication: "heat-sensitive medication",
  cardiovascular: "cardiovascular",
  respiratory: "respiratory",
};

function ProfilePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PersonaDraft>(EMPTY_DRAFT);
  const [calendars, setCalendars] = useState<string[]>([]);
  const [otherChecked, setOtherChecked] = useState(false);

  const set = <K extends keyof PersonaDraft>(key: K, value: PersonaDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  const toggleCondition = (id: string) =>
    setDraft((previous) => ({
      ...previous,
      conditionIds: previous.conditionIds.includes(id)
        ? previous.conditionIds.filter((item) => item !== id)
        : [...previous.conditionIds, id],
    }));

  // What the model will actually act on, shown live so there is no surprise
  // between what you tick and what moves the score.
  const risks = useMemo(
    () => modelledRisks(draft.conditionIds, Number(draft.age) || 0),
    [draft.conditionIds, draft.age],
  );

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[900px] items-center gap-3 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Climap NYC home">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
            <span className="text-lg font-bold">Climap NYC</span>
          </Link>
          <Button asChild variant="ghost" className="ml-auto h-9 rounded-lg px-4 font-semibold text-muted-foreground">
            <Link to="/">Back to today</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-5 py-8 md:px-8 md:py-12">
        <p className="text-sm font-bold uppercase text-primary">Build a profile</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Who are we planning for?</h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Heat is not one number for everyone. The same afternoon walk costs a 71-year-old
          on a heat-sensitive medication far more than it costs a 28-year-old. Describe
          someone and we will score their plan against real forecast data. Build as many
          as you like — they all sit side by side on the next screen.
        </p>
        <p className="mt-3 max-w-2xl rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">Synthetic profiles only.</strong>{" "}
          Please do not enter anyone's real health information. Nothing here is stored
          on a server — it stays in this browser, and you can delete any of them.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            addPersona(draft);
            markOnboarded();
            navigate({ to: "/" });
          }}
        >
          {/* ------------------------------------------------------ about you */}
          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <h2 className="text-lg font-bold">About you</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name" className="h-11" placeholder="Anyone"
                  value={draft.name}
                  onChange={(event) => set("name", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age" type="number" min={1} max={110} className="h-11" placeholder="35"
                  value={draft.age}
                  onChange={(event) => set("age", event.target.value)}
                />
                {Number(draft.age) >= OLDER_ADULT_AGE && (
                  <p className="text-xs text-primary">
                    Counts as an older adult — added to the model automatically.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <AddressField draft={draft} onPick={(place) =>
                  setDraft((previous) => ({
                    ...previous,
                    address: place.label, lat: place.lat, lon: place.lon, zip: place.zip_code,
                  }))
                } onType={(value) =>
                  setDraft((previous) => ({ ...previous, address: value, lat: null, lon: null }))
                } />
              </div>
            </div>
          </section>

          {/* -------------------------------------------------- your routine */}
          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <h2 className="text-lg font-bold">Your routine</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Time spent outdoors stands in for heat acclimatisation. The activity is the
              plan we are scoring — effort is a large part of heat strain.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="outdoor">Outdoor exercise</Label>
                <Select value={draft.outdoor} onValueChange={(value) => set("outdoor", value as OutdoorOption)}>
                  <SelectTrigger id="outdoor" className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTDOOR_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activity">What's the plan?</Label>
                <Select value={draft.activity} onValueChange={(value) => set("activity", value)}>
                  <SelectTrigger id="activity" className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITIES.map((option) => (
                      <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minutes">For how long?</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="minutes" type="number" min={5} max={240} className="h-11"
                    value={draft.minutes}
                    onChange={(event) => set("minutes", event.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- conditions */}
          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <h2 className="text-lg font-bold">Pre-existing health conditions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Four of these feed the model today. The rest are real heat-risk factors we
              have not built in yet — they are marked, so you can see where the model ends.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {CONDITIONS.map((condition) => (
                <label
                  key={condition.id}
                  title={condition.note}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={draft.conditionIds.includes(condition.id)}
                    onCheckedChange={() => toggleCondition(condition.id)}
                  />
                  <span className="min-w-0">
                    {condition.label}
                    {condition.maps_to ? (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary">
                        affects score
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">
                        not yet modelled
                      </span>
                    )}
                  </span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <Checkbox checked={otherChecked} onCheckedChange={(checked) => setOtherChecked(checked === true)} />
                <span>
                  Other
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">
                    not yet modelled
                  </span>
                </span>
              </label>
            </div>
            {otherChecked && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="other-condition">Please describe</Label>
                <Input id="other-condition" placeholder="Anything else we should keep in mind?" className="h-11" />
              </div>
            )}

            <div className="mt-5 rounded-lg border border-border bg-secondary/40 px-3.5 py-3 text-sm">
              <span className="font-semibold">The model will use:</span>{" "}
              {risks.length
                ? risks.map((risk) => RISK_LABEL[risk] ?? risk).join(", ")
                : "no risk factors — a baseline adult"}
            </div>
          </section>

          {/* ------------------------------------------------------- calendar */}
          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></span>
              <div>
                <h2 className="text-lg font-bold">Sync your calendar</h2>
                <p className="text-sm text-muted-foreground">So we can spot your free windows automatically.</p>
              </div>
              <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                not built yet
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {calendarOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-3 text-sm font-medium text-muted-foreground transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    checked={calendars.includes(option.id)}
                    onCheckedChange={() =>
                      setCalendars((previous) =>
                        previous.includes(option.id)
                          ? previous.filter((item) => item !== option.id)
                          : [...previous, option.id])
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Calendar integration is on the roadmap — the schedule on the next screen is
              illustrative. Everything to the right of it is live data.
            </p>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl px-5 font-semibold text-muted-foreground"
              onClick={() => { markOnboarded(); navigate({ to: "/" }); }}
            >
              Skip for now
            </Button>
            <Button type="submit" className="h-11 rounded-xl px-6 text-base font-semibold">
              <Check /> Save and continue
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

/** Address box with real geocoding behind it.
 *
 *  Debounced to 450ms: Nominatim's usage policy is about one request a second,
 *  and firing one per keystroke would be both rude and rate-limited. */
function AddressField({
  draft, onPick, onType,
}: {
  draft: PersonaDraft;
  onPick: (place: GeoLocation) => void;
  onType: (value: string) => void;
}) {
  const [matches, setMatches] = useState<GeoLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    const query = draft.address.trim();
    if (query.length < 3 || draft.lat !== null) { setMatches([]); return; }

    const timer = setTimeout(() => {
      setBusy(true);
      fetchGeocode(query)
        .then((result) => {
          setMatches(result.matches);
          // Distinguish "no such place in NYC" from "the geocoder is down".
          // Silently showing nothing for both is how you end up debugging the
          // wrong thing on stage.
          setNote(
            result.matches.length ? ""
              : result.problem
                ? `Address lookup unavailable (${result.problem}). Leave this blank to use the East Harlem demo location.`
                : result.coverage_note,
          );
          setProvider(result.matches.length ? result.provider : null);
          setOpen(true);
        })
        .catch((cause: Error) => {
          setMatches([]);
          setNote(`Address lookup failed: ${cause.message}`);
        })
        .finally(() => setBusy(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [draft.address, draft.lat]);

  return (
    <div className="relative space-y-1.5">
      <Label htmlFor="location">Where will this happen?</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="location"
          className="h-11 pl-9"
          placeholder="Start typing a New York City address…"
          autoComplete="off"
          value={draft.address}
          onChange={(event) => { setOpen(true); onType(event.target.value); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {busy && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          {matches.map((place) => (
            <li key={`${place.lat},${place.lon}`}>
              <button
                type="button"
                className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-secondary"
                onMouseDown={(event) => {
                  event.preventDefault();
                  skip.current = true;
                  onPick(place);
                  setMatches([]);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{place.label}</span>
                {place.zip_code && <span className="ml-2 text-muted-foreground">{place.zip_code}</span>}
              </button>
            </li>
          ))}
          {provider === "open-meteo" && (
            <li className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">
              Street-level lookup is unavailable right now — these are
              neighbourhood centres.
            </li>
          )}
        </ul>
      )}

      {draft.lat !== null ? (
        <p className="text-xs text-primary">
          Using {draft.lat.toFixed(4)}, {draft.lon?.toFixed(4)} — the same coordinates the
          weather call uses. You can check it in the sources on the next screen.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {note || "New York City only — tree-canopy data comes from the NYC Street Tree Census. Leave blank to use the East Harlem demo location."}
        </p>
      )}
    </div>
  );
}
