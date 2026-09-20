import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarPlus,
  ChevronDown,
  Clock3,
  Check,
  CloudSun,
  Footprints,
  Leaf,
  MapPin,
  RefreshCw,
  Send,
  X,
} from "lucide-react";

import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  type CompareResponse,
  type OptionResult,
  type PlanOption,
  type Profile,
  fetchCompare,
  fetchOptions,
  fetchProfiles,
  toneFor,
} from "@/lib/api";
import {
  type ScheduleEvent,
  DEFAULT_DAY, addPlan, clockLabel, durationLabel, freeWindows, isoAt,
  pickWindows, totalFree,
} from "@/lib/schedule";
import {
  type StoredPersona,
  draftToProfile, hasOnboarded, hiddenPresets, hidePreset, loadPersonas,
  loadSelected, removePersona, resetPresets, selectPersona,
} from "@/lib/persona";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Climap NYC — find the window when you can" },
      { name: "description", content: "Compare how much heat and air-pollution exposure a plan costs you at different times and places, using real public forecast data." },
      { property: "og:title", content: "Climap NYC" },
      { property: "og:description", content: "You don't have to skip it. Find the window when you can." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClimapNYC,
});

/** Build the three options out of the day's free windows and the two places.
 *
 *  Same 2x2 shape as before -- two options share a time and differ in tree
 *  cover, two share a place and differ in time -- so the attribution chart
 *  stays readable. What changed is where the times come from: the gaps in this
 *  person's day, not a fixed pair of hours in a data file.
 */
function buildOptions(
  places: PlanOption[], events: ScheduleEvent[], minutes: number, date: string,
): PlanOption[] {
  const street = places.find((place) => place.canopy_shade < 0.3);
  const shaded = places.find((place) => place.canopy_shade >= 0.3);
  if (!street || !shaded || !date) return [];

  const { baseline, alternative } = pickWindows(freeWindows(events, minutes), minutes);
  if (baseline === null) return [];

  const at = (place: PlanOption, start: number, id: string): PlanOption => ({
    ...place, id,
    when_iso: isoAt(date, start),
    when_label: `Today, ${clockLabel(start)}`,
  });

  const options = [at(street, baseline, "a"), at(shaded, baseline, "b")];
  if (alternative !== null) options.push(at(street, alternative, "c"));
  return options;
}

function ClimapNYC() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState<string>("mei");
  // People built on /profile. They sit alongside the presets, override them
  // when one is selected, and carry a geocoded address so the weather call
  // uses those coordinates rather than the demo ones.
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<string[]>(() => hiddenPresets());
  const [personas, setPersonas] = useState<StoredPersona[]>(() => loadPersonas());
  const [selectedUid, setSelectedUid] = useState<string | null>(() => loadSelected());
  const custom = personas.find((person) => person.uid === selectedUid) ?? null;
  const [places, setPlaces] = useState<PlanOption[]>([]);
  const [demoDate, setDemoDate] = useState("");
  const [events, setEvents] = useState<ScheduleEvent[]>(DEFAULT_DAY);
  const [added, setAdded] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // First visit starts at the profile form. Both buttons there mark onboarding
  // done, so "Skip for now" genuinely skips instead of bouncing back here.
  useEffect(() => {
    if (!hasOnboarded()) navigate({ to: "/profile" });
  }, [navigate]);

  // Load the catalogue once.
  useEffect(() => {
    Promise.all([fetchProfiles(), fetchOptions()])
      .then(([people, options]) => {
        setProfiles(people);
        // We reuse the catalogue's places (coordinates, canopy) but replace its
        // times. Its first entry also tells us which day the backend is pinned
        // to, which is the only way the browser can know about
        // CLIMAP_DEMO_DATE.
        setPlaces(options);
        setDemoDate(options[0]?.when_iso.slice(0, 10) ?? "");
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  // How long the plan takes decides which gaps in the day are usable at all.
  const minutes = custom ? draftToProfile(custom).activity_minutes
    : profiles.find((person) => person.id === profileId)?.activity_minutes ?? 30;

  const windows = useMemo(() => freeWindows(events, minutes), [events, minutes]);
  const options = useMemo(
    () => buildOptions(places, events, minutes, demoDate),
    [places, events, minutes, demoDate],
  );
  // Serialised so the effect below re-runs on a real change of times, not on
  // every render that rebuilds an equivalent array.
  const optionsKey = JSON.stringify(options);

  // Re-compare when the person, the day, or the focused option changes.
  useEffect(() => {
    const current: PlanOption[] = JSON.parse(optionsKey);
    if (current.length < 2) { setData(null); setLoading(false); return; }
    setLoading(true);
    fetchCompare({
      ...(custom
        ? {
            profile: draftToProfile(custom),
            location: custom.lat !== null && custom.lon !== null
              ? { label: custom.address, lat: custom.lat, lon: custom.lon, zip_code: custom.zip }
              : undefined,
          }
        : { profileId }),
      options: current,
      optionIds: current.map((option) => option.id),
      baselineOptionId: current[0]!.id,
      focusOptionId: focusId,
    })
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [profileId, custom, optionsKey, focusId]);

  /** Book an option: it becomes a commitment, that window closes, and the
   *  remaining options are recomputed against the day as it now stands. */
  const bookOption = (option: OptionResult) => {
    const source = options.find((candidate) => candidate.id === option.id);
    if (!source) return;
    const start = Number(source.when_iso.slice(11, 13)) * 60
      + Number(source.when_iso.slice(14, 16));
    setEvents((previous) => addPlan(
      previous, start, minutes, plainActivity(data?.profile), option.where_label));
    setAdded(option.id);
    setFocusId(undefined);
  };

  const best = data?.options.reduce(
    (lowest, option) => (option.strain.score < lowest!.strain.score ? option : lowest),
    data.options[0],
  );
  const baseline = data?.options.find((option) => option.id === data.baseline_option_id);

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto grid h-16 max-w-[1560px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 lg:flex lg:px-8">
          <a href="#main" className="flex min-w-0 items-center gap-2.5" aria-label="Climap NYC home">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
            <span className="truncate text-lg font-bold">Climap NYC</span>
          </a>
          <nav className="order-3 col-span-2 flex items-center gap-1 border-t border-border py-2 lg:order-none lg:col-span-1 lg:ml-8 lg:border-0 lg:py-0" aria-label="Main navigation">
            <Button variant="ghost" className="h-9 rounded-lg bg-secondary px-4 font-semibold text-foreground">Today</Button>
            <Button variant="ghost" className="h-9 rounded-lg px-4 font-semibold text-muted-foreground">Week</Button>
            <Button asChild variant="ghost" className="h-9 rounded-lg px-4 font-semibold text-muted-foreground"><Link to="/profile">Me</Link></Button>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {data && <DataBadge data={data} />}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{data?.profile.display_name ?? "—"}</p>
              <p className="max-w-[16rem] truncate text-xs text-muted-foreground">
                {custom?.address || `ZIP ${data?.profile.zip_code ?? "—"} · New York`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto grid max-w-[1560px] gap-5 px-4 py-5 md:px-6 lg:grid-cols-[250px_minmax(500px,1fr)_270px] lg:px-8 lg:py-7 xl:grid-cols-[270px_minmax(620px,1fr)_290px]">
        {/* ------------------------------ schedule: the source of the options */}
        <aside className="order-2 rounded-xl border border-border bg-background p-5 shadow-panel lg:order-1 lg:self-start" aria-labelledby="schedule-title">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Your day</p>
              <h2 id="schedule-title" className="mt-1 text-xl font-bold">My schedule</h2>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-lg shadow-none"><RefreshCw /> Sync</Button>
          </div>
          <div className="relative space-y-1 before:absolute before:bottom-6 before:left-[4.35rem] before:top-6 before:w-px before:bg-border">
            {events.map((event) => {
              const booked = event.kind === "plan";
              return (
                <div key={event.id} className="grid grid-cols-[3.65rem_1rem_minmax(0,1fr)] gap-3 py-3">
                  <time className="pt-0.5 text-xs font-semibold text-muted-foreground">{clockLabel(event.start)}</time>
                  <span className={`relative z-10 mt-1 size-3 rounded-full ring-4 ring-background ${booked ? "bg-good" : "bg-schedule"}`} />
                  <div className={booked ? "-mt-2 rounded-lg border border-good-border bg-good-soft px-3 py-2" : "min-w-0"}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`truncate text-sm font-bold ${booked ? "text-good-strong" : ""}`}>{event.title}</h3>
                      <span className="text-xs text-muted-foreground">{durationLabel(event.end - event.start)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 rounded-lg bg-secondary px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-primary" /> {durationLabel(totalFree(windows))} free today
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {windows.length
                ? `The windows below come from these gaps: ${windows
                    .map((w) => `${clockLabel(w.start)}–${clockLabel(w.end)}`).join(", ")}.`
                : "No gap today is long enough for this plan."}
            </p>
            {events.some((event) => event.kind === "plan") && (
              <button
                type="button"
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                onClick={() => { setEvents(DEFAULT_DAY); setAdded(null); setFocusId(undefined); }}
              >
                Reset the day
              </button>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------ the comparison */}
        <section className="order-1 min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-panel lg:order-2" aria-labelledby="planner-title">
          <div className="border-b border-border px-6 py-6 md:px-8">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="size-2 rounded-full bg-good" /> {loading ? "Checking conditions…" : "Ready to plan"}
            </div>
            <h1 id="planner-title" className="text-3xl font-bold leading-tight md:text-4xl">You don't have to skip it.</h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Same plan, different times and places. Here is what each one costs you.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {personas.map((person) => {
                const active = person.uid === selectedUid;
                const name = draftToProfile(person).display_name;
                return (
                  <span
                    key={person.uid}
                    className={`inline-flex h-8 items-center rounded-full border text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    <button
                      type="button"
                      className="py-1 pl-3.5 pr-1.5"
                      onClick={() => {
                        selectPersona(person.uid);
                        setSelectedUid(person.uid);
                        setFocusId(undefined);
                      }}
                    >
                      {name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      title={`Delete ${name}`}
                      className={`grid h-full place-items-center rounded-r-full pl-0.5 pr-2.5 ${
                        active ? "hover:bg-primary-foreground/20" : "hover:bg-border"
                      }`}
                      onClick={() => {
                        const left = removePersona(person.uid);
                        setPersonas(left);
                        setSelectedUid(loadSelected());
                        setFocusId(undefined);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                );
              })}
              {profiles.filter((person) => !hidden.includes(person.id)).map((person) => {
                const active = !custom && person.id === profileId;
                return (
                  <span
                    key={person.id}
                    className={`inline-flex h-8 items-center rounded-full border text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    <button
                      type="button"
                      className="py-1 pl-3.5 pr-1.5"
                      onClick={() => {
                        selectPersona(null); setSelectedUid(null);
                        setProfileId(person.id); setFocusId(undefined);
                      }}
                    >
                      {person.display_name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Hide ${person.display_name}`}
                      title="Hide from this list. The preset itself is untouched — use Reset to bring it back."
                      className={`grid h-full place-items-center rounded-r-full pl-0.5 pr-2.5 ${
                        active ? "hover:bg-primary-foreground/20" : "hover:bg-border"
                      }`}
                      onClick={() => {
                        const next = hidePreset(person.id);
                        setHidden(next);
                        if (active) {
                          const remaining = profiles.find(
                            (other) => !next.includes(other.id) && other.id !== person.id);
                          if (remaining) setProfileId(remaining.id);
                        }
                        setFocusId(undefined);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                );
              })}
              {hidden.length > 0 && (
                <Button
                  variant="ghost" size="sm"
                  className="rounded-full font-semibold text-muted-foreground"
                  onClick={() => setHidden(resetPresets())}
                >
                  Reset people
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="rounded-full font-semibold text-muted-foreground">
                <Link to="/profile">+ Build one</Link>
              </Button>
            </div>
          </div>

          {error && (
            <div className="m-6 rounded-lg border border-warm-border bg-warm-soft px-4 py-3 text-sm md:mx-8">
              <p className="font-bold text-warm-strong">Backend not reachable</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Start it with <code>python3 -m uvicorn app.api:app --port 8000</code> in the backend folder.
              </p>
            </div>
          )}

          <Conversation className="min-h-0">
            <ConversationContent className="gap-6 px-6 py-7 md:px-8">
              <Message from="user" className="max-w-[82%]">
                <p className="text-right text-xs font-bold text-muted-foreground">You</p>
                <MessageContent className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
                  {data ? `I'm planning ${plainActivity(data.profile)} for about ${data.profile.activity_minutes} minutes. When should I go?` : "…"}
                </MessageContent>
              </Message>

              <Message from="assistant" className="max-w-full">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-agent text-agent-foreground"><Leaf className="size-4" /></span>
                  <p className="text-sm font-bold">Climap NYC</p>
                </div>
                <MessageContent className="w-full text-[15px] leading-relaxed">
                  <MessageResponse>
                    {best && baseline
                      ? best.id === baseline.id
                        ? `Your original plan is already the best of the three. ${best.verdict.text}`
                        : `${best.verdict.text} Moving from ${baseline.when_label.toLowerCase()} to ${best.when_label.toLowerCase()} cuts your heat strain by ${Math.abs(best.delta_vs_baseline_pct ?? 0)}%.`
                      : "Checking real forecast data…"}
                  </MessageResponse>
                </MessageContent>

                <div className="grid gap-3 xl:grid-cols-3">
                  {data?.options.map((option) => (
                    <OptionCard
                      key={option.id}
                      option={option}
                      isBaseline={option.id === data.baseline_option_id}
                      isFocused={option.id === (focusId ?? best?.id)}
                      isBooked={added === option.id}
                      onSelect={() => setFocusId(option.id)}
                      onBook={() => bookOption(option)}
                    />
                  ))}
                </div>

                {data?.tradeoff && (
                  <div className="mt-3 rounded-lg bg-secondary px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    {data.tradeoff.text}
                  </div>
                )}
              </Message>
            </ConversationContent>
          </Conversation>

          <div className="border-t border-border px-6 py-5 md:px-8">
            <p className="mb-2.5 text-xs font-bold uppercase text-muted-foreground">Assumptions behind these numbers</p>
            <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
              {data?.assumptions.map((line) => <li key={line}>{line}</li>)}
            </ol>
            <PromptInput onSubmit={(_, event) => event.preventDefault()} className="rounded-xl">
              <PromptInputTextarea readOnly placeholder="Ask about another time or place…" className="min-h-20 text-base" />
              <PromptInputFooter className="justify-end p-2">
                <PromptInputSubmit disabled aria-label="Send message" className="size-9 rounded-lg"><Send className="size-4" /></PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>

        {/* ------------------------------------------------ conditions / why / who */}
        <aside className="order-3 space-y-5 lg:self-start">
          <section className="rounded-xl border border-border bg-background p-5 shadow-panel" aria-labelledby="conditions-title">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-sun-soft text-sun"><CloudSun className="size-5" /></span>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {data?.date_context ? `Observed ${data.date_context}` : "Live forecast"}
                </p>
                <h2 id="conditions-title" className="text-xl font-bold">Conditions</h2>
              </div>
            </div>
            <div className="mt-5 divide-y divide-border">
              {best && (
                <>
                  <Condition emoji="🌡️" label={`${best.conditions.air_temp_c.toFixed(1)} °C air`} note={`Feels like ${best.conditions.operative_temp_c.toFixed(1)} °C with sun and wind`} />
                  <Condition emoji="🫁" label={best.conditions.pm25_aqi != null ? `PM2.5 AQI ${best.conditions.pm25_aqi}` : "PM2.5 unavailable"} note={best.conditions.ozone_aqi != null ? `Ozone AQI ${best.conditions.ozone_aqi}` : "No ozone reading for this hour"} />
                  <Condition emoji="☀️" label={`${Math.round(best.conditions.solar_wm2)} W/m² sun`} note={`Radiant temperature ${best.conditions.mean_radiant_temp_c.toFixed(1)} °C`} />
                </>
              )}
            </div>
            {best?.conditions.nws_alert && (
              <p className="mt-4 rounded-lg bg-warm-soft px-3 py-2 text-xs font-bold text-warm-strong">{best.conditions.nws_alert}</p>
            )}
            <Button variant="outline" className="mt-4 w-full justify-between rounded-lg shadow-none">See sources <ChevronDown /></Button>
          </section>

          <section className="rounded-xl border border-border bg-background p-5 shadow-panel">
            <h2 className="text-lg font-bold">Why this recommendation?</h2>
            {data?.attribution ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Down <span className="font-bold text-foreground">{data.attribution.total_drop} points</span>. Here is where that comes from.
                </p>
                <div className="mt-4 flex h-6 overflow-hidden rounded-md">
                  {data.attribution.factors.map((factor, index) => (
                    <span key={factor.key} style={{ width: `${factor.share_pct}%`, background: FACTOR_COLOURS[index % FACTOR_COLOURS.length] }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-3">
                  {data.attribution.factors.map((factor, index) => (
                    <li key={factor.key} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 font-semibold">
                          <span className="size-2.5 rounded-sm" style={{ background: FACTOR_COLOURS[index % FACTOR_COLOURS.length] }} />
                          {factor.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{factor.share_pct}%</span>
                      </div>
                      <p className="mt-0.5 pl-[1.125rem] text-xs text-muted-foreground">{factor.lever}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{data.attribution.method}</p>
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your original plan is already the best of the three, so there is nothing to explain.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-background p-5 shadow-panel">
            <h2 className="text-lg font-bold">Along the way</h2>
            <ul className="mt-3 space-y-2">
              {data?.resources.map((resource) => (
                <li key={resource.name} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">{resource.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{resource.distance_label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-background p-5 shadow-panel">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-avatar text-sm font-bold text-avatar-foreground">
                {initials(data?.profile.display_name)}
              </span>
              <div>
                <h2 className="font-bold">{data?.profile.display_name ?? "—"}</h2>
                <p className="text-xs text-muted-foreground">Synthetic profile</p>
              </div>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <ProfileRow label="Age" value={String(data?.profile.age ?? "—")} />
              <ProfileRow label="Activity" value={plainActivity(data?.profile)} />
              <ProfileRow label="Risk factors" value={(data?.profile.risk_categories ?? []).map(humanRisk).join(", ") || "—"} />
              <ProfileRow label="Heat acclimatisation" value={data?.profile.acclimatization ?? "—"} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {data?.profile.note}
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}

const FACTOR_COLOURS = ["#B45B36", "#C79338", "#6F9C82", "#7C93A8", "#8A7CA8"];

function OptionCard({
  option, isBaseline, isFocused, isBooked, onSelect, onBook,
}: {
  option: OptionResult;
  isBaseline: boolean;
  isFocused: boolean;
  isBooked: boolean;
  onSelect: () => void;
  onBook: () => void;
}) {
  const tone = toneFor(option.strain.band);
  return (
    // A div, not a button: "Add to calendar" is a second action inside the
    // card and nesting one button in another is invalid markup.
    <div
      className={`flex min-h-52 flex-col rounded-xl border bg-card text-left shadow-card transition ${
        isFocused ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isFocused}
        className="flex flex-1 flex-col p-4 text-left"
      >
        <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Footprints className="size-5" /></span>
        <h3 className="mt-3 text-base font-bold">{option.when_label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{option.where_label}</p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{option.strain.score}</span>
          <span className="text-xs font-semibold text-muted-foreground">{option.strain.band_label}</span>
        </div>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {isBaseline ? "your original plan" : `${option.delta_vs_baseline_pct}% strain`}
        </p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <span className={`block h-full rounded-full ${tone === "good" ? "bg-good" : "bg-warm"}`} style={{ width: `${option.strain.score}%` }} />
        </div>

        <p className={`mt-3 text-xs font-bold ${tone === "good" ? "text-good-strong" : "text-warm-strong"}`}>
          {option.verdict.text}
        </p>
      </button>

      <button
        type="button"
        onClick={onBook}
        disabled={isBooked}
        className={`m-4 mt-0 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
          isBooked
            ? "border-good-border bg-good-soft text-good-strong"
            : "border-border hover:bg-secondary"
        }`}
      >
        {isBooked
          ? <><Check className="size-3.5" /> On your schedule</>
          : <><CalendarPlus className="size-3.5" /> Add to calendar</>}
      </button>
    </div>
  );
}

function DataBadge({ data }: { data: CompareResponse }) {
  const live = data.data_mode === "live" || data.data_mode === "cached";
  return (
    <span
      title={data.requested_urls[0] ?? ""}
      className={`hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block ${
        live ? "bg-good-soft text-good-strong" : "bg-secondary text-muted-foreground"
      }`}
    >
      {live ? "Live public APIs" : "Cached snapshot"}
      {data.date_context ? ` · ${data.date_context}` : ""}
    </span>
  );
}

function Condition({ emoji, label, note }: { emoji: string; label: string; note: string }) {
  return (
    <div className="flex gap-3 py-4">
      <span className="text-xl" aria-hidden="true">{emoji}</span>
      <div><p className="text-sm font-bold">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{note}</p></div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function plainActivity(profile?: Profile | null): string {
  const map: Record<string, string> = {
    rest: "resting outside",
    walk_easy: "an easy walk",
    walk_brisk: "a brisk walk",
    run: "a run",
    cycle: "a bike ride",
    manual_work: "outdoor work",
  };
  return profile ? (map[profile.activity] ?? profile.activity) : "—";
}

function humanRisk(key: string): string {
  const map: Record<string, string> = {
    none: "None",
    older_adult: "Older adult",
    heat_sensitive_medication: "Heat-sensitive medication",
    cardiovascular: "Cardiovascular",
    respiratory: "Respiratory",
  };
  return map[key] ?? key;
}

function initials(name?: string): string {
  if (!name) return "—";
  return (name.split(/[\s,]+/)[0] ?? name).slice(0, 2).toUpperCase();
}
