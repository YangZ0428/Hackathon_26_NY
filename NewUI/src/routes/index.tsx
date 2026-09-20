import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock3,
  CloudSun,
  ExternalLink,
  Footprints,
  Leaf,
  Navigation,
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
  type Attribution,
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

/** Pull a duration out of what the user typed.
 *
 *  The assistant is scripted, not a language model -- but this one piece is
 *  real: "I have 1 hour" genuinely changes which gaps in the day are long
 *  enough, which changes the windows we offer. An LLM would slot in exactly
 *  here, turning free text into the same structured fields.
 *
 *  Returns null when there is no duration to find, and the profile's own
 *  activity length is used instead. */
/** What the planner says while it works. Each line names a real step in the
 *  compare call it is standing in for. */
const THINKING_STAGES = [
  "Reading the gaps in your day…",
  "Pulling real observations for each window…",
  "Scoring every option for this person…",
];

function minutesFromText(text: string): number | null {
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hr|hour)/i);
  if (hours) return Math.round(parseFloat(hours[1]!) * 60);
  const mins = text.match(/(\d+)\s*(?:m\b|min)/i);
  if (mins) return parseInt(mins[1]!, 10);
  if (/half an hour/i.test(text)) return 30;
  if (/\ban hour\b/i.test(text)) return 60;
  return null;
}

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
  // Which card has its explanation open. The backend computes attribution for
  // one option at a time (focus_option_id), so opening a card refetches.
  const [openId, setOpenId] = useState<string | null>(null);
  // The planner answers when you send, not on page load: this is a chat, and a
  // result that appears before anyone asks for it does not read like one.
  const [draftMessage, setDraftMessage] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [thinkingStage, setThinkingStage] = useState<number | null>(null);
  const thinking = thinkingStage !== null;
  const [askedMinutes, setAskedMinutes] = useState<number | null>(null);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Opening the app runs the full path: login -> profile -> week -> a day.
  // markOnboarded() is called on the profile form, so once you have been
  // through it a refresh of this page keeps you here.
  useEffect(() => {
    if (!hasOnboarded()) navigate({ to: "/login" });
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
  const profileMinutes = custom ? draftToProfile(custom).activity_minutes
    : profiles.find((person) => person.id === profileId)?.activity_minutes ?? 30;
  // A duration in the message wins over the profile's default.
  const minutes = askedMinutes ?? profileMinutes;

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

  /** Send a message. The scoring itself is already reactive -- this controls
   *  when the answer is revealed, and hands over any duration it can parse. */
  const send = (text: string) => {
    const message = text.trim();
    if (!message) return;
    setSentMessage(message);
    setAskedMinutes(minutesFromText(message));
    setDraftMessage("");
    setOpenId(null);
    // Walk the stages. They name what the backend genuinely does on a compare:
    // read the day, fetch each window from the public APIs, score each option
    // for this person. Padding, but not a lie about the work.
    setThinkingStage(0);
    THINKING_STAGES.forEach((_, index) => {
      if (index === 0) return;
      window.setTimeout(() => setThinkingStage(index), index * 620);
    });
    window.setTimeout(() => setThinkingStage(null), THINKING_STAGES.length * 620);
  };

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
  const focused = data?.options.find((option) => option.id === (focusId ?? best?.id)) ?? null;

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto grid h-16 max-w-[1560px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 lg:flex lg:px-8">
          <a href="#main" className="flex min-w-0 items-center gap-2.5" aria-label="Climap NYC home">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
            <span className="truncate text-lg font-bold">Climap NYC</span>
          </a>
          <nav className="order-3 col-span-2 flex items-center gap-1 border-t border-border py-2 lg:order-none lg:col-span-1 lg:ml-8 lg:border-0 lg:py-0" aria-label="Main navigation">
            <Button asChild variant="ghost" className="h-9 rounded-lg px-4 font-semibold text-muted-foreground"><Link to="/week">Week</Link></Button>
            <Button variant="ghost" className="h-9 rounded-lg bg-secondary px-4 font-semibold text-foreground">Day</Button>
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

      <main id="main" className="mx-auto grid max-w-[1560px] gap-5 px-4 py-5 md:px-6 lg:grid-cols-[280px_minmax(560px,1fr)] lg:px-8 lg:py-7 xl:grid-cols-[300px_minmax(700px,1fr)]">
        {/* ------------- left column: the day, and the conditions it sits in */}
        <aside className="order-2 space-y-5 lg:order-1 lg:self-start">
          <section className="rounded-xl border border-border bg-background p-5 shadow-panel" aria-labelledby="schedule-title">
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
          </section>

          <section className="rounded-xl border border-border bg-background p-5 shadow-panel" aria-labelledby="conditions-title">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-sun-soft text-sun"><CloudSun className="size-5" /></span>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {data?.date_context ? `Observed ${data.date_context}` : "Live forecast"}
                </p>
                <h2 id="conditions-title" className="text-xl font-bold">Environmental conditions</h2>
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
              {custom && (
                // Only for people we built: a preset lives in the backend's
                // profiles.json and editing it here would be a lie.
                <Button asChild variant="outline" size="sm" className="rounded-full font-semibold shadow-none">
                  <Link to="/profile">Edit profile</Link>
                </Button>
              )}
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
              {!sentMessage && (
                <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
                  <p className="text-sm font-semibold">Ask when to go.</p>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Say what you are planning and how long you have. Say a duration and
                    it will be used — &ldquo;I have 1 hour&rdquo; only offers gaps in your
                    day that are actually an hour long.
                  </p>
                </div>
              )}

              {sentMessage && (
                <Message from="user" className="max-w-[82%]">
                  <p className="text-right text-xs font-bold text-muted-foreground">You</p>
                  <MessageContent className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
                    {sentMessage}
                  </MessageContent>
                </Message>
              )}

              {sentMessage && thinking && (
                <Message from="assistant" className="max-w-full">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-agent text-agent-foreground"><Leaf className="size-4" /></span>
                    <p className="text-sm font-bold">Climap NYC</p>
                  </div>
                  <MessageContent className="flex items-center gap-2 text-[15px] text-muted-foreground">
                    <span className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
                          style={{ animationDelay: `${dot * 160}ms` }}
                        />
                      ))}
                    </span>
                    {THINKING_STAGES[thinkingStage ?? 0]}
                  </MessageContent>
                </Message>
              )}

              {sentMessage && !thinking && (
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

                <div className="grid items-start gap-3 xl:grid-cols-3">
                  {data?.options.map((option) => (
                    <OptionCard
                      key={option.id}
                      option={option}
                      isBaseline={option.id === data.baseline_option_id}
                      isFocused={option.id === (focusId ?? best?.id)}
                      isBooked={added === option.id}
                      isBaselineCard={option.id === data.baseline_option_id}
                      isOpen={openId === option.id}
                      // Only show the explanation on the card it was computed for.
                      attribution={
                        data.attribution?.to_option_id === option.id ? data.attribution : null
                      }
                      loading={loading}
                      onSelect={() => {
                        setFocusId(option.id);
                        setOpenId((current) => (current === option.id ? null : option.id));
                      }}
                      onBook={() => bookOption(option)}
                    />
                  ))}
                </div>

                {data?.tradeoff && (
                  <div className="mt-3 rounded-lg bg-secondary px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    {data.tradeoff.text}
                  </div>
                )}

                {/* STATIC MAP PLACEHOLDER: the drawing is hand-made SVG, not a
                    map service. Its labels follow the selected option, but the
                    geometry is fixed. Replace the whole module when a real map
                    goes in. */}
                <StaticActivityMap option={focused} />
              </Message>
              )}
            </ConversationContent>
          </Conversation>

          <div className="border-t border-border px-6 py-5 md:px-8">
            <p className="mb-2.5 text-xs font-bold uppercase text-muted-foreground">Assumptions behind these numbers</p>
            <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
              {data?.assumptions.map((line) => <li key={line}>{line}</li>)}
            </ol>
            <p className="mb-2.5 text-xs font-bold uppercase text-muted-foreground">Try asking</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                "I'd like to walk outside this afternoon",
                "I have 1 hour",
                "I only have 20 minutes",
                "Where is there some shade?",
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-background font-medium shadow-none"
                  onClick={() => send(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
            <PromptInput
              onSubmit={(_, event) => { event.preventDefault(); send(draftMessage); }}
              className="rounded-xl"
            >
              <PromptInputTextarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="What are you planning, and how long do you have?"
                className="min-h-20 text-base"
              />
              <PromptInputFooter className="justify-between gap-3 p-2 pl-3.5">
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Scripted for now — the duration you mention is the part that really
                  feeds the model. A language model would sit exactly here.
                </p>
                <PromptInputSubmit
                  disabled={!draftMessage.trim()}
                  aria-label="Send message"
                  className="size-9 shrink-0 rounded-lg"
                >
                  <Send className="size-4" />
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>

      </main>
    </div>
  );
}

const FACTOR_COLOURS = ["#B45B36", "#C79338", "#6F9C82", "#7C93A8", "#8A7CA8"];

function OptionCard({
  option, isBaseline, isFocused, isBooked, isBaselineCard, isOpen, attribution,
  loading, onSelect, onBook,
}: {
  option: OptionResult;
  isBaseline: boolean;
  isFocused: boolean;
  isBooked: boolean;
  isBaselineCard: boolean;
  isOpen: boolean;
  attribution: Attribution | null;
  loading: boolean;
  onSelect: () => void;
  onBook: () => void;
}) {
  const tone = toneFor(option.strain.band);
  return (
    // A div, not a button: "Add to calendar" is a second action inside the
    // card and nesting one button in another is invalid markup.
    <div
      className={`flex min-h-60 flex-col rounded-xl border bg-card text-left shadow-card transition ${
        isFocused ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={isOpen}
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

        <span className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
          Why this recommendation?
          <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3.5">
          {isBaselineCard ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              This is the plan you came in with, so there is nothing to explain yet.
              Every other card is measured against this one — open one of those to
              see what changes and by how much.
            </p>
          ) : loading || !attribution ? (
            <p className="text-xs text-muted-foreground">Re-running the model…</p>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Down <span className="font-bold text-foreground">{attribution.total_drop} points</span> against
                your original plan. Here is where that comes from.
              </p>
              <div className="mt-3 flex h-5 overflow-hidden rounded-md">
                {attribution.factors.map((factor, index) => (
                  <span
                    key={factor.key}
                    style={{ width: `${factor.share_pct}%`, background: FACTOR_COLOURS[index % FACTOR_COLOURS.length] }}
                  />
                ))}
              </div>
              <ul className="mt-3 space-y-2.5">
                {attribution.factors.map((factor, index) => (
                  <li key={factor.key} className="text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: FACTOR_COLOURS[index % FACTOR_COLOURS.length] }} />
                        {factor.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{factor.share_pct}%</span>
                    </div>
                    <p className="mt-0.5 pl-[1.125rem] leading-relaxed text-muted-foreground">{factor.lever}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{attribution.method}</p>
            </>
          )}
        </div>
      )}

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

/** Their hand-drawn neighbourhood map, moved from Chicago to East Harlem.
 *
 *  Everything here is decorative: the streets, the water and the route are
 *  fixed SVG paths, not geometry from a map service, and the walk time is a
 *  rough constant. What IS live is the heading -- it names the option you have
 *  selected -- so the panel stays consistent with the rest of the screen
 *  instead of contradicting it.
 *
 *  Say this out loud if anyone asks. A drawing that quietly implies routing we
 *  do not do would undercut the parts of this project that are real.
 */
function StaticActivityMap({ option }: { option: OptionResult | null }) {
  const shaded = option?.where_label.toLowerCase().includes("shade")
    || option?.where_label.toLowerCase().includes("park");
  return (
    <section className="mt-1 overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="nearby-map-title">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-muted-foreground">Route sketch · illustrative</p>
          <h3 id="nearby-map-title" className="mt-0.5 truncate text-base font-bold">
            {option?.where_label ?? "Select an option"}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm font-bold">
            <Footprints className="size-4 text-primary" /> {option?.when_label.replace("Today, ", "") ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{shaded ? "shaded route" : "street level"}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.45fr)_minmax(210px,0.8fr)]">
        <div className="relative min-h-64 overflow-hidden bg-muted" role="img" aria-label="Illustrative sketch of East Harlem showing a walking route from the user's block north to the park loop. Not a real map.">
          <svg viewBox="0 0 700 360" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="700" height="360" className="fill-muted" />
            <path d="M0 54 C130 78 176 38 304 65 S512 111 700 59" className="fill-none stroke-background" strokeWidth="28" />
            <path d="M0 54 C130 78 176 38 304 65 S512 111 700 59" className="fill-none stroke-border" strokeWidth="2" />
            <path d="M-20 280 C100 243 169 269 256 205 S410 136 508 151 S620 217 735 174" className="fill-none stroke-background" strokeWidth="34" />
            <path d="M-20 280 C100 243 169 269 256 205 S410 136 508 151 S620 217 735 174" className="fill-none stroke-border" strokeWidth="2" />
            <path d="M110 -20 C128 92 105 160 154 232 S247 316 285 390" className="fill-none stroke-background" strokeWidth="22" />
            <path d="M110 -20 C128 92 105 160 154 232 S247 316 285 390" className="fill-none stroke-border" strokeWidth="2" />
            <path d="M490 -15 C452 73 471 147 432 218 S362 297 374 380" className="fill-none stroke-background" strokeWidth="20" />
            <path d="M490 -15 C452 73 471 147 432 218 S362 297 374 380" className="fill-none stroke-border" strokeWidth="2" />
            <path d="M585 210 C656 211 714 245 735 326 L735 390 L526 390 C536 330 544 269 585 210Z" className="fill-agent" />
            <path d="M565 226 C626 236 676 263 708 317" className="fill-none stroke-good" strokeDasharray="4 7" strokeLinecap="round" strokeWidth="3" />
            <path d="M204 294 C228 278 260 249 283 219 C310 184 344 174 379 171 C423 167 459 139 502 113" className="fill-none stroke-primary" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
            <path d="M204 294 C228 278 260 249 283 219 C310 184 344 174 379 171 C423 167 459 139 502 113" className="fill-none stroke-primary-foreground" strokeDasharray="2 12" strokeLinecap="round" strokeWidth="2" />
          </svg>

          <span className="absolute left-[8%] top-[12%] text-[10px] font-semibold text-muted-foreground">E 110th St</span>
          <span className="absolute bottom-[12%] right-[5%] text-[10px] font-semibold text-good-strong">Harlem Meer</span>
          <span className="absolute left-[26%] top-[38%] text-[10px] font-semibold text-muted-foreground">East Harlem</span>

          <div className="absolute bottom-[13%] left-[25%] -translate-x-1/2">
            <span className="mx-auto grid size-8 place-items-center rounded-full border-4 border-background bg-foreground text-background shadow-card"><Navigation className="size-3.5" /></span>
            <span className="mt-1 block rounded-md bg-background px-2 py-1 text-center text-[10px] font-bold shadow-card">You</span>
          </div>
          <div className="absolute left-[70%] top-[21%] -translate-x-1/2">
            <span className={`mx-auto grid size-10 place-items-center rounded-full border-4 border-background shadow-panel ${shaded ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}><Footprints className="size-4" /></span>
            <span className="mt-1 block whitespace-nowrap rounded-md bg-background px-2.5 py-1.5 text-xs font-bold text-primary shadow-card">Park loop</span>
          </div>
          <div className="absolute left-[18%] top-[22%] -translate-x-1/2">
            <span className={`mx-auto grid size-7 place-items-center rounded-full border-2 border-background shadow-card ${shaded ? "bg-background text-muted-foreground" : "bg-warm text-foreground"}`}><Bike className="size-3.5" /></span>
            <span className="mt-1 block whitespace-nowrap rounded-md bg-background px-2 py-1 text-[10px] font-semibold shadow-card">2nd Ave</span>
          </div>
        </div>

        <div className="flex flex-col border-t border-border p-4 sm:p-5 md:border-l md:border-t-0">
          <p className="text-xs font-bold uppercase text-muted-foreground">Getting there</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-good-border bg-good-soft p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-background text-primary"><Footprints className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">On foot</p>
                  <p className="text-xs text-good-strong">Scored above</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground"><Bike className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">By bike</p>
                  <p className="text-xs text-muted-foreground">Higher effort, more airflow</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Distances and the drawn route are illustrative. The scores above are not.
          </p>
          <Button type="button" variant="outline" disabled className="mt-4 w-full rounded-lg shadow-none">
            Open directions <ExternalLink />
          </Button>
        </div>
      </div>
    </section>
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


