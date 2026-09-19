import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, Leaf, Mail, MapPin, Sparkles, Lock, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import lakeside from "@/assets/login-lakeside.jpg";

const highlights = [
  { icon: CalendarCheck, text: "Sees the gaps in your day" },
  { icon: MapPin, text: "Knows what's nearby" },
  { icon: Sparkles, text: "Suggests what fits right now" },
];

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ClimatePlan" },
      { name: "description", content: "Sign in or create a ClimatePlan account to plan your free time around your schedule and today's conditions." },
      { property: "og:title", content: "Sign in — ClimatePlan" },
      { property: "og:description", content: "Sign in or create a ClimatePlan account to start planning your free time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isSignUp = mode === "signup";

  return (
    <div className="grid min-h-dvh bg-canvas text-foreground lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img src={lakeside} alt="" width={1024} height={1536} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/65" />

        <div className="relative flex items-center gap-2.5 text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-white/90 text-primary"><Leaf className="size-5" /></span>
          <span className="text-lg font-bold">ClimatePlan</span>
        </div>

        <div className="relative max-w-sm text-white">
          <h2 className="text-3xl font-bold leading-tight drop-shadow-sm">Plan your free time with a little help.</h2>
          <p className="mt-3 text-base leading-relaxed text-white/85">
            ClimatePlan looks at your schedule, your location, and today's conditions, then suggests something that actually fits.
          </p>
          <ul className="mt-6 space-y-3">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-semibold text-white/90">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 backdrop-blur-sm"><Icon className="size-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">Prototype preview · no real accounts</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12 md:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Leaf className="size-5" /></span>
            <span className="text-lg font-bold">ClimatePlan</span>
          </div>

          <h1 className="text-3xl font-bold">{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {isSignUp ? "We'll ask a few quick things about you next." : "Sign in to see today's plan."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(["signin", "signup"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`h-9 rounded-lg text-sm font-semibold transition-colors ${mode === value ? "bg-background text-foreground shadow-card" : "text-muted-foreground"}`}
              >
                {value === "signin" ? "Sign in" : "New account"}
              </button>
            ))}
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (isSignUp) navigate({ to: "/profile" });
              else navigate({ to: "/" });
            }}
          >
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" placeholder="Maya Chen" className="h-11 pl-9" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" placeholder="maya@example.com" className="h-11 pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" className="h-11 pl-9" />
              </div>
            </div>

            <Button type="submit" className="h-11 w-full rounded-xl text-base font-semibold">
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "New here? "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(isSignUp ? "signin" : "signup")}
            >
              {isSignUp ? "Sign in" : "Create one"}
            </button>
          </p>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">Skip to today's plan</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
