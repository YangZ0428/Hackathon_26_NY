import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Leaf, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/week")({
  head: () => ({
    meta: [
      { title: "Your week — Climap NYC" },
      { name: "description", content: "Plan your week around expected environmental conditions with concise Climap NYC suggestions." },
      { property: "og:title", content: "Your week — Climap NYC" },
      { property: "og:description", content: "See favorable activity windows and suggested schedule changes for the week ahead." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WeekPage,
});

type ForecastTone = "good" | "warm" | "poor" | "neutral";

const week = [
  { day: "MON", date: "21", tone: "good", note: "Favorable", events: [["9:00 AM", "Work"], ["6:00 PM", "Run"]] },
  { day: "TUE", date: "22", tone: "good", note: "Good evening", events: [["9:00 AM", "Work"], ["5:00 PM", "Free"]] },
  { day: "WED", date: "23", tone: "poor", note: "Less favorable", events: [["9:00 AM", "Work"], ["6:00 PM", "Run", "warning"]] },
  { day: "THU", date: "24", tone: "good", note: "Good morning", events: [["9:00 AM", "Work"], ["5:00 PM", "Free"]] },
  { day: "FRI", date: "25", tone: "warm", note: "Warm later", events: [["9:00 AM", "Work"], ["6:00 PM", "Dinner"]] },
  { day: "SAT", date: "26", tone: "good", note: "Favorable", events: [["10:00 AM", "Free"], ["7:00 PM", "Dinner"]] },
  { day: "SUN", date: "27", tone: "neutral", note: "May change", events: [["All day", "Free"]] },
] as const;

const suggestions = [
  {
    title: "Move Wednesday's run",
    description: "Conditions are currently expected to be less favorable around 6 PM.",
    detail: "Suggested: Wednesday 7:00 AM",
    why: "Wednesday afternoon is forecast to be warmer with fair air quality, which may feel harder for outdoor exercise — especially with asthma in your profile. Early morning is expected to be cooler and clearer.",
    tone: "warm" as const,
  },
  {
    title: "Saturday morning looks good",
    description: "You have 3 hours free and conditions are currently forecast to be favorable.",
    detail: "Best window: 9:00 AM–12:00 PM",
    why: "Saturday morning is currently expected to be comfortable, with good air quality and moderate sun — a favorable match for your regular outdoor exercise habit.",
    tone: "good" as const,
  },
  {
    title: "Friday evening",
    description: "Consider an indoor activity later in the day.",
    detail: "Expected to feel warmer outdoors",
    why: "Friday evening is forecast to stay warm after a hot afternoon, and heat can linger near dinner time. An indoor plan would likely be more comfortable.",
    tone: "neutral" as const,
  },
] as const;

const toneClasses: Record<ForecastTone, string> = {
  good: "bg-good",
  warm: "bg-warm",
  poor: "bg-destructive",
  neutral: "bg-schedule",
};

function WeekPage() {
  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto grid h-16 max-w-[1560px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 lg:flex lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Climap NYC home">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
            <span className="truncate text-lg font-bold">Climap NYC</span>
          </Link>
          <nav className="order-3 col-span-2 flex items-center gap-1 border-t border-border py-2 lg:order-none lg:col-span-1 lg:ml-8 lg:border-0 lg:py-0" aria-label="Main navigation">
            <Button variant="ghost" className="h-9 rounded-lg bg-secondary px-4 font-semibold text-foreground">Week</Button>
            <Button asChild variant="ghost" className="h-9 rounded-lg px-4 font-semibold text-muted-foreground"><Link to="/">Day</Link></Button>
            <Button asChild variant="ghost" className="h-9 rounded-lg px-4 font-semibold text-muted-foreground"><Link to="/profile">Me</Link></Button>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Button asChild variant="outline" size="sm" className="hidden rounded-lg shadow-none sm:inline-flex"><Link to="/login">Sign out</Link></Button>
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">Maya</p><p className="text-xs text-muted-foreground">Chicago, IL</p></div>
            <Link to="/profile" className="grid size-9 place-items-center rounded-full bg-avatar text-sm font-bold text-avatar-foreground" aria-label="Your profile">MC</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-7 md:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 border-b border-border pb-7 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><CalendarDays className="size-4" /> Sep 21 – Sep 27</div>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">Your week</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">This week looks good for outdoor activities. Wednesday afternoon may be better spent indoors.</p>
            <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="size-1.5 rounded-full bg-schedule" /> Based on current forecast</p>
          </div>
          <Button variant="outline" size="sm" className="w-fit rounded-lg shadow-none"><RefreshCw /> Sync calendar</Button>
        </div>

        <div className="mt-7 space-y-7">
          <section aria-labelledby="weekly-schedule-title">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase text-muted-foreground">My schedule</p><h2 id="weekly-schedule-title" className="mt-1 text-2xl font-bold">Week at a glance</h2></div>
              <div className="hidden items-center gap-4 text-xs font-semibold text-muted-foreground sm:flex"><Legend tone="good" label="Favorable" /><Legend tone="warm" label="Watch" /><Legend tone="poor" label="Adjust" /></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-panel">
              <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-7">
                {week.map((day) => (
                  <Link key={day.day} to="/" aria-label={`View ${day.day} ${day.date} on the Day page`} className="block transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none">
                    <article className="min-h-48 p-4 sm:min-h-52 xl:min-h-64">
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="text-xs font-bold text-muted-foreground">{day.day}</p><p className="mt-1 text-2xl font-bold">{day.date}</p></div>
                        <span className={`mt-1 size-2.5 rounded-full ${toneClasses[day.tone]}`} aria-label={day.note} />
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{day.note}</p>
                      <div className="mt-5 space-y-3">
                        {day.events.map(([time, title, warning]) => (
                          <div key={`${time}-${title}`} className={`rounded-lg border px-3 py-2.5 ${title === "Free" ? "border-good-border bg-good-soft" : "border-border bg-card"}`}>
                            <time className="text-[11px] font-semibold text-muted-foreground">{time}</time>
                            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">{title}{warning ? <span className="text-warm-strong" aria-label="Review forecast">⚠️</span> : null}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="suggestions-title">
            <div className="mb-4 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-agent text-agent-foreground"><Sparkles className="size-4" /></span><div><p className="text-xs font-bold uppercase text-muted-foreground">Planning ahead</p><h2 id="suggestions-title" className="text-2xl font-bold">Climap NYC suggestions</h2></div></div>
            <div className="grid gap-4 md:grid-cols-3">
              {suggestions.map((suggestion) => (
                <article key={suggestion.title} className="flex flex-col rounded-xl border border-border bg-background p-5 shadow-card">
                  <span className={`size-2.5 rounded-full ${toneClasses[suggestion.tone]}`} />
                  <h3 className="mt-4 text-lg font-bold">{suggestion.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{suggestion.description}</p>
                  <p className="mt-3 text-xs font-bold text-good-strong">{suggestion.detail}</p>
                  <div className="mt-4 rounded-lg bg-secondary p-3.5">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground">Why this suggestion</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{suggestion.why}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Legend({ tone, label }: { tone: ForecastTone; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${toneClasses[tone]}`} />{label}</span>;
}
