# StillGo

**You don't have to skip it. Find the window when you can.**

Built for the [Health in Climate AI Hackathon](https://healthinclimate.ai/hackathons/nyc/2026),
NYC 2026 — problem 08, *Heat, air, and your plans* (NYU Department of Mental Health).

---

## What it does

Someone has already decided to go outside. StillGo shows them the same plan at
different times and places, what each version costs them in heat and air-pollution
exposure, and where that difference comes from.

It does **not** tell people to stay indoors. Outdoor activity is protective for
mental health; a tool that discourages it works against the partner's own mission.
StillGo finds the window when you still can.

```
Mei, 71 — on a blood-pressure medication that reduces heat tolerance
  Today 4:30 PM, your block        86  Extreme    This one we would move.
  Today 4:30 PM, the park loop     79  High       −8%
  Tomorrow 7:00 AM, your block     26  Low        −70%   Your best window. Go.

Jordan, 28 — same walk, same weather, no risk factors
  Today 4:30 PM, your block        60  Moderate   Workable. Carry water.
```

Same street, same hour, same walk. The difference is the person.

## How the score works

Five steps, each one a named function in `backend/app/heat.py`:

1. Solar radiation and tree canopy → **mean radiant temperature**
2. That plus air temperature, weighted by wind → **operative temperature**
3. Humidity via vapour pressure → sweat evaporates less
4. Activity (MET) and clothing (clo) → your own heat, and how much escapes
5. Map to 0–100, then multiply by a **vulnerability factor** from age, risk
   category and acclimatisation

A simplified member of the UTCI / operative-temperature family.

**The score describes the plan, not the person.** Same person, three plans, three
scores. The problem statement forbids diagnosing or predicting individual health
outcomes, and this framing is how we stay on the right side of that line.

## Where the difference comes from

`backend/app/explain.py` runs a **one-at-a-time ablation**: hold one factor at the
worse option's value, re-run the model, and see how much of the improvement
disappears. That is the factor's contribution.

The model is non-linear, so contributions do not sum exactly to the total. We
normalise, and we say so in the response and on the page.

## Data

Three public endpoints, **no API key anywhere**:

| Source | What we take |
|---|---|
| `api.open-meteo.com/v1/forecast` | hourly air temperature, humidity, wind, solar radiation |
| `air-quality-api.open-meteo.com/v1/air-quality` | PM2.5, ozone, US AQI |
| `api.weather.gov/alerts/active` | official NWS heat and air-quality alerts |
| `archive-api.open-meteo.com/v1/archive` | real past observations, for demoing a day that was actually hot |

Every `/api/compare` response carries **`requested_urls`** — the exact URLs hit while
building it. Paste one into a browser and you get the same numbers back.

### Integrity rule

There is **no synthetic-data generator** in this project. If the upstream API is
unreachable and no snapshot covers the hour, the API returns 503 rather than
substituting plausible-looking numbers.

## What is real and what is not

| Synthetic / chosen by us | Real |
|---|---|
| The four person profiles (the brief requires synthetic profiles) | Weather, air quality and alerts |
| The vulnerability coefficients and scale constants | The operative-temperature formulation |
| Which three time-and-place options to compare | CDC's heat-sensitive medication classes |
| `canopy_shade` values (a stand-in; see below) | The ablation method |

The coefficients are **assumptions**, set from the direction of published CDC and
NWS guidance, not fitted to outcome data. They are listed as assumptions in the
API response and shown on the page. With a deployment partner collecting which
recommendations people follow and what happens next, they become learned rather
than assumed — that is the data the problem statement itself names as missing.

## Run it

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.api:app --reload --port 8000     # docs at /docs

# frontend, in a second terminal
cd frontend
npm install
npm run dev
```

September in New York is not hot enough to show the comparison. To demo on a day
that was:

```bash
python tools/find_hot_day.py        # lists the real hottest days this summer
export STILLGO_DEMO_DATE=2026-07-03 # 39.2 °C / 103 °F, observed
```

The page labels the date so nobody mistakes it for today.

## Known limits

- Shade is estimated from street-tree canopy density, not measured. No city-wide
  street-level shade layer exists.
- Conditions are forecasts or archive observations for a point, not sensor
  readings at the spot.
- The strain number is not a medical measurement.
- No public dataset links a plan to a health outcome, so this compares exposure
  between options. It does not predict what will happen to anyone.

## Licence

MIT — see [LICENSE](LICENSE).
