import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bike,
  CalendarPlus,
  ChevronDown,
  Clock3,
  CloudSun,
  Dumbbell,
  ExternalLink,
  Footprints,
  Leaf,
  Navigation,
  RefreshCw,
  Send,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Climap NYC — Plan your free time" },
      { name: "description", content: "A friendly planning assistant that fits activities around your time, location, and today's conditions." },
      { property: "og:title", content: "Climap NYC — Plan your free time" },
      { property: "og:description", content: "Find thoughtful activities that fit your schedule and today's conditions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClimapNYC,
});

const schedule = [
  { time: "9:00 AM", title: "Work", detail: "Focus time", duration: "3h" },
  { time: "12:00 PM", title: "Lunch", detail: "Café with Nina", duration: "1h" },
  { time: "2:00 PM", title: "Meeting", detail: "Project check-in", duration: "1h" },
  { time: "5:30 PM", title: "Free", detail: "Open until dinner", duration: "1h 30m", free: true },
  { time: "7:00 PM", title: "Dinner", detail: "At home", duration: "1h" },
];

const activities = [
  { title: "Lakeside walk", time: "5:00–6:00 PM", place: "0.8 mi away", status: "Good conditions", tone: "good", icon: Footprints, selected: true },
  { title: "Easy bike ride", time: "5:00–6:30 PM", place: "1.2 mi away", status: "Warm later", tone: "warm", icon: Bike, selected: false },
  { title: "Indoor workout", time: "Flexible · 45 min", place: "At home", status: "No outdoor exposure", tone: "good", icon: Dumbbell, selected: false },
] as const;

function ClimapNYC() {
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
            <Button asChild variant="outline" size="sm" className="hidden rounded-lg shadow-none sm:inline-flex"><Link to="/login">Sign out</Link></Button>
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">Maya</p><p className="text-xs text-muted-foreground">Chicago, IL</p></div>
            <Link to="/profile" className="grid size-9 place-items-center rounded-full bg-avatar text-sm font-bold text-avatar-foreground" aria-label="Your profile">MC</Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto grid max-w-[1560px] gap-5 px-4 py-5 md:px-6 lg:grid-cols-[270px_minmax(500px,1fr)] lg:px-8 lg:py-7 xl:grid-cols-[290px_minmax(620px,1fr)]">
        <aside className="order-2 space-y-5 lg:order-1 lg:self-start">
          <section className="rounded-xl border border-border bg-background p-5 shadow-panel" aria-labelledby="schedule-title">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase text-muted-foreground">Monday, Sep 21</p><h2 id="schedule-title" className="mt-1 text-xl font-bold">My schedule</h2></div>
              <Button variant="outline" size="sm" className="shrink-0 rounded-lg shadow-none"><RefreshCw /> Sync</Button>
            </div>
            <div className="relative space-y-1 before:absolute before:bottom-6 before:left-[4.35rem] before:top-6 before:w-px before:bg-border">
              {schedule.map((event) => (
                <div key={event.time} className="grid grid-cols-[3.65rem_1rem_minmax(0,1fr)] gap-3 py-3">
                  <time className="pt-0.5 text-xs font-semibold text-muted-foreground">{event.time}</time>
                  <span className={`relative z-10 mt-1 size-3 rounded-full ring-4 ring-background ${event.free ? "bg-good" : "bg-schedule"}`} />
                  <div className={event.free ? "rounded-lg border border-good-border bg-good-soft px-3 py-2 -mt-2" : "min-w-0"}>
                    <div className="flex items-center justify-between gap-2"><h3 className={`truncate text-sm font-bold ${event.free ? "text-good-strong" : ""}`}>{event.title}</h3><span className="text-xs text-muted-foreground">{event.duration}</span></div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-secondary px-4 py-3"><p className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-primary" /> 1h 30m free today</p></div>
          </section>

          <section className="rounded-xl border border-border bg-background p-5 shadow-panel" aria-labelledby="conditions-title">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sun-soft text-sun"><CloudSun className="size-5" /></span><div><p className="text-xs font-bold uppercase text-muted-foreground">Chicago</p><h2 id="conditions-title" className="text-xl font-bold">Environmental conditions</h2></div></div>
            <div className="mt-5 divide-y divide-border">
              <Condition emoji="🌡️" label="Comfortable now" note="A pleasant time outside" />
              <Condition emoji="🫁" label="Air quality: Fair" note="Keep activity moderate" />
              <Condition emoji="☀️" label="Strong sun later" note="Earlier is more comfortable" />
            </div>
            <Button variant="outline" className="mt-4 w-full justify-between rounded-lg shadow-none">See live conditions <ChevronDown /></Button>
          </section>
        </aside>

        <section className="order-1 min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-panel lg:order-2" aria-labelledby="planner-title">
          <div className="border-b border-border px-6 py-6 md:px-8">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><span className="size-2 rounded-full bg-good" /> Ready to plan</div>
            <h1 id="planner-title" className="text-3xl font-bold leading-tight md:text-4xl">What would you like to do?</h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">I'll help you find something that fits your time, location, and today's conditions.</p>
          </div>

          <Conversation className="min-h-0">
            <ConversationContent className="gap-6 px-6 py-7 md:px-8">
              <Message from="user" className="max-w-[82%]">
                <p className="text-right text-xs font-bold text-muted-foreground">You</p>
                <MessageContent className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">I have about two hours free this afternoon. I'd like to exercise outside.</MessageContent>
              </Message>
              <Message from="assistant" className="max-w-full">
                <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-agent text-agent-foreground"><Leaf className="size-4" /></span><p className="text-sm font-bold">Climap NYC</p></div>
                <div className="w-full space-y-3.5 rounded-2xl rounded-tl-sm border border-border/60 bg-secondary/60 p-4">
                  <MessageContent className="text-[15px] leading-relaxed">
                    <MessageResponse>You have a free window from 5–7 PM. Based on your location and today's conditions, I'd suggest a walk earlier rather than strenuous exercise later.</MessageResponse>
                  </MessageContent>
                  <div className="grid gap-3 xl:grid-cols-3">
                    {activities.map((activity) => <ActivityCard key={activity.title} activity={activity} />)}
                  </div>
                  {/* STATIC MAP PLACEHOLDER: Replace StaticActivityMap with the future dynamic map implementation. */}
                  <StaticActivityMap />
                </div>
              </Message>
            </ConversationContent>
          </Conversation>

          <div className="border-t border-border px-6 py-5 md:px-8">
            <p className="mb-2.5 text-xs font-bold uppercase text-muted-foreground">Try asking</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {["I want to exercise", "I want to go outside", "I want to relax", "I have 1 hour", "Surprise me"].map((prompt) => <Button key={prompt} variant="outline" size="sm" className="rounded-full bg-background font-medium shadow-none">{prompt}</Button>)}
            </div>
            <PromptInput onSubmit={(_, event) => event.preventDefault()} className="rounded-xl">
              <PromptInputTextarea readOnly placeholder="Tell me what you're in the mood for…" className="min-h-20 text-base" />
              <PromptInputFooter className="justify-end p-2"><PromptInputSubmit disabled aria-label="Send message" className="size-9 rounded-lg"><Send className="size-4" /></PromptInputSubmit></PromptInputFooter>
            </PromptInput>
          </div>
        </section>

      </main>
    </div>
  );
}

function ActivityCard({ activity }: { activity: (typeof activities)[number] }) {
  const Icon = activity.icon;
  return <article className={`relative flex min-h-52 flex-col rounded-xl border bg-card p-4 shadow-card ${activity.selected ? "border-primary ring-1 ring-primary" : "border-border"}`}>
    {activity.selected ? <span className="absolute right-3 top-3 text-[10px] font-bold uppercase text-primary">Selected</span> : null}
    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-5" /></span>
    <h3 className="mt-3 text-base font-bold">{activity.title}</h3>
    <p className="mt-1 text-xs font-medium text-muted-foreground">{activity.time}</p>
    <p className="mt-1 text-xs text-muted-foreground">{activity.place}</p>
    <p className={`mt-3 flex items-center gap-2 text-xs font-bold ${activity.tone === "good" ? "text-good-strong" : "text-warm-strong"}`}><span className={`size-2 rounded-full ${activity.tone === "good" ? "bg-good" : "bg-warm"}`} />{activity.status}</p>
    <Button variant="outline" size="sm" className="mt-auto w-full rounded-lg font-semibold shadow-none"><CalendarPlus /> Add to calendar</Button>
  </article>;
}

function StaticActivityMap() {
  return (
    <section className="mt-1 overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="nearby-map-title">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Location + route</p>
          <h3 id="nearby-map-title" className="mt-0.5 text-base font-bold">Lakeside Park</h3>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-sm font-bold"><Footprints className="size-4 text-primary" /> 12 min</p>
          <p className="text-xs text-muted-foreground">0.8 mi away</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.45fr)_minmax(210px,0.8fr)]">
        <div className="relative min-h-64 overflow-hidden bg-muted" role="img" aria-label="Mock map showing a highlighted walking route from Maya's approximate location to Lakeside Park, with nearby bike trail and indoor workout locations">
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

          <span className="absolute left-[8%] top-[12%] text-[10px] font-semibold text-muted-foreground">W Addison St</span>
          <span className="absolute bottom-[12%] right-[5%] text-[10px] font-semibold text-good-strong">Lake Michigan</span>
          <span className="absolute left-[26%] top-[38%] text-[10px] font-semibold text-muted-foreground">Lakeview</span>

          <div className="absolute bottom-[13%] left-[25%] -translate-x-1/2">
            <span className="mx-auto grid size-8 place-items-center rounded-full border-4 border-background bg-foreground text-background shadow-card"><Navigation className="size-3.5" /></span>
            <span className="mt-1 block rounded-md bg-background px-2 py-1 text-center text-[10px] font-bold shadow-card">You</span>
          </div>
          <div className="absolute left-[70%] top-[21%] -translate-x-1/2">
            <span className="mx-auto grid size-10 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-panel"><Footprints className="size-4" /></span>
            <span className="mt-1 block whitespace-nowrap rounded-md bg-background px-2.5 py-1.5 text-xs font-bold text-primary shadow-card">Lakeside Park</span>
          </div>
          <div className="absolute left-[18%] top-[22%] -translate-x-1/2">
            <span className="mx-auto grid size-7 place-items-center rounded-full border-2 border-background bg-warm text-foreground shadow-card"><Bike className="size-3.5" /></span>
            <span className="mt-1 block whitespace-nowrap rounded-md bg-background px-2 py-1 text-[10px] font-semibold shadow-card">Lakefront Trail</span>
          </div>
          <div className="absolute bottom-[12%] right-[29%] translate-x-1/2">
            <span className="mx-auto grid size-7 place-items-center rounded-full border-2 border-background bg-background text-muted-foreground shadow-card"><Dumbbell className="size-3.5" /></span>
            <span className="mt-1 block whitespace-nowrap rounded-md bg-background px-2 py-1 text-[10px] font-semibold shadow-card">Home workout</span>
          </div>
        </div>

        <div className="flex flex-col border-t border-border p-4 md:border-l md:border-t-0 sm:p-5">
          <p className="text-xs font-bold uppercase text-muted-foreground">Directions</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-good-border bg-good-soft p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-background text-primary"><Footprints className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold">Walk · 12 min</p><p className="text-xs text-good-strong">Best fit for conditions</p></div>
                <span className="text-xs font-bold text-primary">1</span>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground"><Bike className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold">Bike · 6 min</p><p className="text-xs text-muted-foreground">Faster, but warmer</p></div>
                <span className="text-xs font-bold text-muted-foreground">2</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Walking keeps the pace moderate in fair air quality, considering asthma.</p>
          <Button type="button" className="mt-4 w-full rounded-lg" aria-label="Open directions placeholder">
            Open directions <ExternalLink />
          </Button>
        </div>
      </div>
    </section>
  );
}

function Condition({ emoji, label, note }: { emoji: string; label: string; note: string }) {
  return <div className="flex gap-3 py-4"><span className="text-xl" aria-hidden="true">{emoji}</span><div><p className="text-sm font-bold">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{note}</p></div></div>;
}
