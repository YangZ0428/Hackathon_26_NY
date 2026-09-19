import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Check, Leaf } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — ClimatePlan" },
      { name: "description", content: "Tell ClimatePlan a little about you so recommendations fit your routine, health considerations, and location." },
      { property: "og:title", content: "Your profile — ClimatePlan" },
      { property: "og:description", content: "Add your details so ClimatePlan can personalise activity suggestions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const outdoorOptions = ["Rarely", "Sometimes", "Regular", "Daily"];

const healthConditions = [
  "Asthma",
  "Allergies",
  "High blood pressure",
  "Diabetes",
  "Heart disease",
  "Arthritis",
  "Eczema / skin sensitivity",
  "Migraine",
  "COPD",
  "Pregnancy",
];

const calendarOptions = [
  { id: "google", label: "Google Calendar" },
  { id: "outlook", label: "Outlook" },
  { id: "ios", label: "Apple Calendar (iOS)" },
];

function ProfilePage() {
  const navigate = useNavigate();
  const [conditions, setConditions] = useState<string[]>(["Asthma"]);
  const [otherChecked, setOtherChecked] = useState(false);
  const [calendars, setCalendars] = useState<string[]>([]);

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[900px] items-center gap-3 px-5 md:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="ClimatePlan home">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
            <span className="text-lg font-bold">ClimatePlan</span>
          </Link>
          <span className="ml-auto text-sm font-semibold text-muted-foreground">Step 2 of 2</span>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-5 py-8 md:px-8 md:py-12">
        <p className="text-sm font-bold uppercase text-primary">Welcome to ClimatePlan</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Tell me a little about you</h1>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
          This helps me suggest activities that fit your routine and how you feel outside. You can change any of it later.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ to: "/" });
          }}
        >
          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <h2 className="text-lg font-bold">About you</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue="Maya" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input id="age" type="number" defaultValue={32} className="h-11" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="location">Where you usually are</Label>
                <Input id="location" defaultValue="Chicago, IL" className="h-11" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <h2 className="text-lg font-bold">Your routine</h2>
            <div className="mt-5 space-y-1.5">
              <Label htmlFor="outdoor">Outdoor exercise</Label>
              <Select defaultValue="Regular">
                <SelectTrigger id="outdoor" className="h-11 w-full sm:max-w-xs">
                  <SelectValue placeholder="How often?" />
                </SelectTrigger>
                <SelectContent>
                  {outdoorOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <h2 className="text-lg font-bold">Pre-existing health conditions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Used quietly in the background to keep suggestions comfortable — you'll never see scores or thresholds.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {healthConditions.map((condition) => (
                <label
                  key={condition}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    checked={conditions.includes(condition)}
                    onCheckedChange={() => toggle(conditions, setConditions, condition)}
                  />
                  {condition}
                </label>
              ))}
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <Checkbox
                  checked={otherChecked}
                  onCheckedChange={(checked) => setOtherChecked(checked === true)}
                />
                Other
              </label>
            </div>
            {otherChecked && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="other-condition">Please describe</Label>
                <Input id="other-condition" placeholder="Anything else I should keep in mind?" className="h-11" />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-background p-6 shadow-panel">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></span>
              <div>
                <h2 className="text-lg font-bold">Sync your calendar</h2>
                <p className="text-sm text-muted-foreground">So I can spot your free windows automatically.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {calendarOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-3 text-sm font-medium transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <Checkbox
                    checked={calendars.includes(option.id)}
                    onCheckedChange={() => toggle(calendars, setCalendars, option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Optional — you can also connect a calendar later from the schedule panel.</p>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="ghost" className="h-11 rounded-xl px-5 font-semibold text-muted-foreground">
              <Link to="/">Skip for now</Link>
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
