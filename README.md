# CheckrideAI

CheckrideAI is a full-stack private pilot checkride preparation app for students preparing for the oral and written portions of the checkride. It combines focused practice, mock exams, progress analytics, and an ACS-based AI oral examiner in one personalized study workspace.

**[Open the live app](https://pplproai.app)**

## Highlights

- Build focused practice sets by knowledge category
- Take timed, 60-question practice exams
- Rehearse curated FAA-S-ACS-6C scenarios with an aircraft-aware AI examiner
- Receive structured ACS scoring, readiness feedback, and targeted review areas
- Track score history, category mastery, and spaced-repetition suggestions
- Save a preferred aircraft, checkride date, checklist progress, and study history per account
- Follow an optional first-login product tour

## Tech Stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- **Data and authentication:** Supabase Auth and PostgreSQL
- **AI:** Anthropic API with Zod-validated structured output
- **Testing:** Node.js test runner and Playwright
- **Delivery:** GitHub Actions and Vercel
- **Monitoring:** Vercel Web Analytics and Speed Insights

## Engineering

- Cookie-backed Supabase sessions protect authenticated pages on the server.
- PostgreSQL Row Level Security isolates every user's scores, profiles, checklists, and oral sessions.
- The AI endpoint independently verifies authentication, validates request limits, applies per-user rate limits, and keeps the Anthropic key server-only.
- Oral sessions select from a server-owned ACS question bank; the model evaluates one answer against a defined rubric instead of inventing the exam or receiving the full transcript.
- Oral-exam responses use a structured schema for scores, strengths, missing knowledge, and study recommendations instead of relying on free-form text parsing.
- AI request records store model usage, token counts, and estimated cost for operational visibility.
- GitHub Actions runs lint, unit tests, a production build, and desktop browser workflows on pushes and pull requests.

## Run Locally

```bash
git clone https://github.com/imabeginnercoder/CheckrideAI.git
cd CheckrideAI
npm install
cp .env.example .env.local
npm run dev
```

Add these values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key
ANTHROPIC_API_KEY=your_secret_api_key
```

Detailed database, authentication-email, and deployment instructions are in [docs/SETUP.md](docs/SETUP.md).

## Testing

```bash
npm run lint       # ESLint and React/Next.js rules
npm test           # Analytics, oral scoring, cost, and profile unit tests
npm run build      # Optimized production build
npm run test:e2e   # Desktop and mobile Playwright workflows
npm run test:e2e:study # Study flows with an isolated local test backend
```

Public browser tests cover landing-page navigation, password recovery, protected-route redirects, and unauthorized API access. An optional test account enables the complete authenticated workflow.

Confirmation recovery tests intercept all Auth calls to check existing-account guidance, resend links, cooldowns, and email-delivery errors without creating users or sending email. To test a server you already have running, set `E2E_BASE_URL=http://localhost:3000` when running `npm run test:e2e`.

The isolated study tests exercise daily-plan navigation, exam mistake tracking, practice-save retries after reload, oral draft/follow-up and scorecard recovery, and voice transcript editing and speech-service failures on desktop and mobile. They use a local fixture backend and simulated speech recognition, without a real account or paid AI calls.

## Study workflow

- The dashboard's **Today's study plan** adapts to a 10, 20, 30, or 45 minute budget, question-level mistakes, review intervals, recent oral gaps, and the checkride date.
- Written exams save individual answers to the same history as practice sets. Missed questions can be reviewed with explanations and opened as an exact retry set.
- Practice results report failed saves and offer a retry. Reloading the same tab preserves the results and which writes succeeded, so retrying a partially saved set does not repeat acknowledged answer writes. Correcting an exam mistake moves that question out of the immediate review queue.
- The oral bank contains 60 authored scenarios covering the applicable single-engine land ACS areas, including navigation, emergencies, night operations, and postflight procedures. Sessions remain limited to 5–30 questions.
- Oral progress is saved per account in this browser's local storage, including drafts, follow-up questions, feedback, and completed scorecards. Reopening the app on the same browser restores the session; cross-device draft synchronization is not included. Failed account saves keep the scorecard available with a retry action.
- **Dictate answer** uses browser speech recognition where supported. Stop recording, review or edit the text, then submit it through the existing scorer. Browser speech services may process audio online; this app does not upload or store recordings. No additional API key is required. Unsupported browsers retain typed answers.

## Architecture

```text
app/
  api/chat/          Protected AI examiner endpoint
  auth/              Confirmation and session callbacks
  dashboard/         Analytics, countdown, and onboarding
  oral/              Oral session and ACS assessment UI
  profile/           Pilot preferences and AI usage
lib/
  acs-oral-questions.ts  ACS-mapped scenarios and adaptive selection
  oral-exam.ts       Scoring schemas, assessment logic, limits, and cost calculation
  profile.ts         Profile synchronization and date helpers
  supabase/          Browser, server, and proxy clients
supabase/
  auth-and-user-data.sql
tests/
  e2e/               Playwright user workflows
proxy.ts             Session refresh and protected-route boundary
```

The dashboard is divided into focused widgets and shared types so data coordination, analytics, and presentation can evolve independently.
