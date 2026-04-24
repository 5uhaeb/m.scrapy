# MailBoard

A personal inbox dashboard with advanced search, saved filters, domain analytics, and CSV/JSON export — built on the Gmail API.

> Scope: MailBoard operates only on the authenticated user's own Gmail data through Google's official API. It requests read-only Gmail access and cannot send, modify, archive, or delete mail.

## Features

- Google OAuth sign-in with automatic access-token refresh
- Full Gmail operator support: `from:`, `to:`, `subject:`, `label:`, `has:attachment`, `is:read`, `is:unread`, `is:starred`, `after:`, `before:`, `older_than:`, `newer_than:`
- UI filter builder, date presets, quick chips, pagination, and newest/oldest sorting
- Sanitized email preview drawer with remote images blocked by default
- Saved searches, search history, keyword analytics, and sender-domain analytics
- CSV and JSON export of up to 800 messages matching the current filter
- Light/dark cartoon-hybrid UI

## What MailBoard Is Not

MailBoard is a personal API client, not a scraper or bulk data tool. It uses Google's official OAuth 2.0 flow to authenticate each user, reads only that user's own inbox via the Gmail REST API with read-only scope, and stores nothing on the server beyond saved searches and history metadata the user explicitly creates.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth.js + Google provider |
| API | Official Gmail REST API via `googleapis` |
| DB | Prisma + Neon Postgres |
| Sanitization | `isomorphic-dompurify` |

## Google Cloud Setup

1. Create a Google Cloud project named something like `mailboard`.
2. Enable the Gmail API.
3. Configure the OAuth consent screen.
   - App name: `MailBoard`
   - Scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add your own Google account as a test user while the app is in Testing mode.
4. Create an OAuth client ID with application type `Web application`.
5. For local development, add:
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Before deploying, also add the production redirect URI:
   - `https://YOUR-PRODUCTION-DOMAIN/api/auth/callback/google`

Keep both localhost and production callback URLs configured. Local sign-in and deployed sign-in use different callback URLs, and both must match exactly.

## Local Setup

```bash
npm install
cp .env.example .env.local
npx prisma db push
npm run dev
```

Required env vars:

```ini
GOOGLE_CLIENT_ID=123...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
NEXTAUTH_SECRET=<long random string>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="postgresql://user:pass@host-pooler.neon.tech/neondb?sslmode=require"

# Optional: lock sign-in to specific emails for personal use
ALLOWED_EMAIL=you@gmail.com,friend@gmail.com
# ALLOWED_EMAILS also works. Commas, semicolons, spaces, and newlines are accepted.
```

The Prisma schema is configured for Neon Postgres. Use the same Neon `DATABASE_URL` locally and in production to avoid database drift.

## Running

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js in development mode on port 3000 |
| `npm run build` | Generate Prisma Client, push the schema, and build Next.js |
| `npm start` | Run the production build |
| `npm run db:push` | Push the Prisma schema to the configured database |
| `npm run db:generate` | Regenerate the Prisma Client |

## Deploying To Vercel + Neon

MailBoard is one full-stack Next.js app. Deploy the repository as a single Vercel project; do not split it into separate frontend and backend services.

Neon is the production database. Use Neon's pooled connection string, the one with `-pooler` in the hostname. Serverless functions create many short-lived connections, and the pooler keeps those connections manageable.

In Vercel project settings, add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, and optionally `ALLOWED_EMAIL` or `ALLOWED_EMAILS`. Set `NEXTAUTH_URL` to your Vercel URL with no trailing slash. Set `DATABASE_URL` to the Neon pooled Postgres string. Leave the allowed-email env var blank if you want test users to be able to sign in, or provide a separated list of emails to restrict access.

In Google Cloud Console, configure both redirect URIs on the same OAuth client:

- `http://localhost:3000/api/auth/callback/google`
- `https://YOUR-PRODUCTION-DOMAIN/api/auth/callback/google`

The deployed app must use the production `NEXTAUTH_URL`, for example `https://your-app-name.vercel.app`.

On the first Vercel deploy, if you see a Prisma connection error, redeploy once. The initial build can occasionally race the first database connection.

## Deployment Checklist

- Verify login works in production.
- Verify Gmail search works.
- Verify saving searches writes to Neon.
- Verify history persists after refresh.
- Verify CSV/JSON export works.
- Verify no secrets are tracked by Git.

## Security Notes

- Secrets stay server-side. The browser never sees the refresh token.
- The app uses the `gmail.readonly` scope.
- Email HTML is sanitized before rendering, and remote images are blocked until the user opts in per message.
- In-memory rate limits apply to search and export routes.
- `.env`, `.env.local`, and `prisma/dev.db` are ignored by Git.

## Project Structure

```text
mailboard/
  prisma/schema.prisma
  src/app
  src/components
  src/lib
  src/types
```

## Gmail Operators

The UI filter object is converted by `src/lib/query-builder.ts`. Raw Gmail search syntax can also be entered directly and is appended verbatim. Full Gmail operator reference: https://support.google.com/mail/answer/7190

## License

Personal / educational use. Adapt freely.
