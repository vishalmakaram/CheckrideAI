# CheckrideAI Setup

This guide contains the operational details for running a separate CheckrideAI environment. People using the hosted product can simply visit [pplproai.app](https://pplproai.app).

## Requirements

- Node.js 22
- A Supabase project
- An Anthropic API key
- A Vercel account for deployment

## Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Set the following values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

The Supabase URL and public key identify the project; Row Level Security controls data access. `ANTHROPIC_API_KEY` is secret and must never be committed or exposed to browser code.

## Database

1. Create a Supabase project and enable Email authentication.
2. Open the Supabase SQL Editor.
3. Run [`supabase/auth-and-user-data.sql`](../supabase/auth-and-user-data.sql).

The migration is idempotent, so it can be rerun after the file changes.

### Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Name, aircraft, checkride date, and onboarding status |
| `quiz_scores` | Completed practice and exam scores |
| `question_results` | Per-question category performance |
| `checklist_items` | Completed checkride-planning items |
| `oral_sessions` | Transcripts and structured ACS assessments |
| `ai_usage` | Model, token, request, and estimated-cost records |

Each user-owned record references a Supabase account. Row Level Security policies limit reads and writes to the authenticated owner. Foreign-key cascades remove related records when an account is deleted. Indexes support user-history queries, and an auth trigger creates the initial profile after signup.

## Authentication URLs

In **Supabase > Authentication > URL Configuration**, set:

```text
Site URL: https://pplproai.app
```

Add these redirect URLs:

```text
https://pplproai.app/**
http://localhost:3000/**
```

Add the matching Vercel preview pattern when authentication needs to work in preview deployments.

## Authentication Emails

The production-ready HTML is stored in:

- [`supabase/email-templates/confirm-signup.html`](../supabase/email-templates/confirm-signup.html)
- [`supabase/email-templates/reset-password.html`](../supabase/email-templates/reset-password.html)

For a hosted Supabase project:

1. Open **Authentication > Email Templates** in Supabase.
2. Choose **Confirm sign up**, use the subject `Confirm your CheckrideAI account`, and paste the confirmation template HTML.
3. Choose **Reset password**, use the subject `Reset your CheckrideAI password`, and paste the reset template HTML.
4. Send one signup and one reset email to a test account and verify both links on the production domain.

Both templates use Supabase's `{{ .ConfirmationURL }}` variable. The application supplies the destination through `emailRedirectTo` or `redirectTo`, and `/auth/callback` exchanges the returned code for a cookie-backed session.

### Confirmation recovery

Signup responses do not always disclose whether an email already belongs to an account. The app therefore gives conditional confirmation instructions and links to sign-in and password reset, rather than claiming a new account was created. Pending signups, unconfirmed sign-ins, and expired confirmation links offer **Resend confirmation email** with a 60-second cooldown and explicit delivery-error messages.

When investigating a missing email, check **Authentication > Users** first. An account with a **Confirmed at** timestamp should sign in or reset its password instead of repeating signup. For unconfirmed accounts, check Auth logs and the SMTP provider's delivery records.

### Branded Sender

Supabase's built-in SMTP service is for development. For production delivery:

1. Create an account with an SMTP provider such as Resend, Postmark, Amazon SES, or SendGrid.
2. Add and verify `pplproai.app` with the provider. Copy the DNS records it gives you into the domain's DNS settings.
3. Create an SMTP credential and a sender such as `CheckrideAI <no-reply@pplproai.app>`.
4. In Supabase, open **Authentication > SMTP Settings**, enable custom SMTP, and enter the provider's host, port, username, and password.
5. Disable click tracking for authentication emails so the provider does not rewrite confirmation links.

SMTP passwords are secrets. Store them only in Supabase's SMTP settings, never in this repository or Vercel's public environment variables.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Set `E2E_EMAIL` and `E2E_PASSWORD` to a dedicated test account to include authenticated Playwright workflows.

## Vercel Deployment

1. Import the GitHub repository into Vercel.
2. Add the three application environment variables for Production and Preview.
3. Deploy the `main` branch.
4. Confirm the production domain is `https://pplproai.app`.
5. Redeploy after changing environment variables.

Vercel Web Analytics and Speed Insights are mounted in the root application layout.

## Continuous Integration

The GitHub Actions workflow runs lint, unit tests, a production build, and Playwright on pushes and pull requests to `main`. Add Supabase and Anthropic values as repository secrets for full integration coverage; build-only checks use safe placeholders.
