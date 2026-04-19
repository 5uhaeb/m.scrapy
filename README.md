# Gmail Search Dashboard

A personal, self-hosted web app for searching your **own** Gmail inbox with advanced filters, saved views, domain analytics, and CSV/JSON export. Built with Next.js, the official Gmail API, and Google OAuth using the minimum-privilege `gmail.readonly` scope.

> **Scope.** This app operates only on the authenticated user's own Gmail data via Google's official API. It does not scrape search results, harvest third-party contacts, or read anyone else's mail. It requests read-only Gmail access — it cannot send, modify, or delete anything.

---

## Features

- **Google OAuth sign-in** with automatic access-token refresh
- **Full Gmail operator support** — `from:`, `to:`, `subject:`, `label:`, `has:attachment`, `is:read`, `is:unread`, `is:starred`, `after:`, `before:`, `older_than:`, `newer_than:`
- **UI filter builder** — no need to remember operators
- **Date presets** — today, yesterday, last 7/30 days, this month, last month, custom range
- **Quick chips** — Invoices, Jobs, Receipts, Interview, Bank, University
- **Results UI** — sender, recipients, subject, snippet, date, labels, attachment indicator
- **Sort** newest/oldest; **paginate** via Gmail page tokens
- **Email preview** drawer with sanitized HTML rendering (DOMPurify, images blocked by default)
- **Deep link** to open the thread in Gmail
- **Saved searches** and **search history** (last 50) in a local SQLite DB
- **Domain aggregation** — group by sender domain with counts/bar chart
- **Keyword analytics** — match counts for your saved keywords
- **Message / thread view toggle**
- **CSV and JSON export** of up to 800 messages matching the current filter
- **Dark mode** with system / light / dark preference
- **Responsive** for laptop and mobile

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | NextAuth.js + Google provider |
| API | Official `googleapis` SDK |
| DB | Prisma + SQLite (swap to Postgres by editing `prisma/schema.prisma`) |
| Sanitization | `isomorphic-dompurify` |

---

## Prerequisites

- **Node.js 18.18+** (Next.js 14 requirement)
- **npm**, **pnpm**, or **yarn**
- A **Google account** (this one will be searched)
- A free **Google Cloud** project

---

## 1. Google Cloud setup

### 1.1 Create a project

1. Go to https://console.cloud.google.com/projectcreate
2. Name it something like `gmail-search-dashboard`
3. Click **Create**

### 1.2 Enable the Gmail API

1. Open https://console.cloud.google.com/apis/library
2. Make sure your new project is selected in the top-left project picker
3. Search for **Gmail API**, open it, click **Enable**

### 1.3 Configure the OAuth consent screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Choose **External** user type → **Create**
3. Fill in:
   - **App name:** Gmail Search Dashboard
   - **User support email:** your address
   - **Developer contact email:** your address
4. **Scopes** — click **Add or remove scopes**, filter for Gmail, and select:
   - `https://www.googleapis.com/auth/gmail.readonly`

   The app also uses `openid`, `email`, `profile` (basic identity). Save.
5. **Test users** — add your own Google email as a test user. In *Testing* mode, only listed test users can sign in — which is exactly what you want for a personal tool.
6. Save and continue.

> You do **not** need to submit the app for verification as long as you stay in Testing mode with yourself as a test user.

### 1.4 Create OAuth credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Click **Create credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Gmail Search Dashboard (local)`
5. **Authorized JavaScript origins** — add:
   ```
   http://localhost:3000
   ```
6. **Authorized redirect URIs** — add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Click **Create**, then copy the **Client ID** and **Client secret** — you'll paste them into `.env.local` next.

---

## 2. Local setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in secrets
cp .env.example .env.local

# 3. Generate a NextAuth secret
#    paste the output into NEXTAUTH_SECRET
openssl rand -base64 32

# 4. Initialize the SQLite database
npx prisma db push

# 5. Run the dev server
npm run dev
```

Open **http://localhost:3000**, click **Continue with Google**, approve the consent screen, and you're in.

### 2.1 Required `.env.local` values

```ini
GOOGLE_CLIENT_ID=123...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
NEXTAUTH_SECRET=<output of openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"

# Optional: lock sign-in to a single email for personal use
ALLOWED_EMAIL=you@gmail.com
```

> If you set `ALLOWED_EMAIL`, every sign-in attempt from any other Google account will be rejected on the server.

---

## 3. Running

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js in development mode on :3000 |
| `npm run build` | Prisma generate + production build |
| `npm start` | Run the production build |
| `npm run db:push` | Apply schema to the SQLite file |
| `npm run db:generate` | Regenerate the Prisma client |

---

## 4. Project structure

```
gmail-search-dashboard/
├── prisma/
│   └── schema.prisma              # User / SavedSearch / SearchHistory / UserPreference
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + theme bootstrap
│   │   ├── page.tsx               # Landing / sign-in
│   │   ├── globals.css            # Tailwind layers + email-body styles
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Main dashboard (client component)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── gmail/
│   │       │   ├── search/route.ts        # POST — list + metadata
│   │       │   ├── message/[id]/route.ts  # GET — full message body
│   │       │   ├── thread/[id]/route.ts   # GET — thread metadata
│   │       │   ├── profile/route.ts       # GET — profile + counts
│   │       │   └── export/route.ts        # POST — CSV / JSON
│   │       ├── saved-searches/
│   │       │   ├── route.ts               # GET / POST
│   │       │   └── [id]/route.ts          # DELETE
│   │       └── history/route.ts           # GET / DELETE
│   ├── components/
│   │   ├── Providers.tsx          # SessionProvider
│   │   ├── SearchBar.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── ResultsTable.tsx
│   │   ├── EmailPreview.tsx       # drawer with sanitized HTML
│   │   ├── SavedFilters.tsx       # saved + history tabs
│   │   ├── QuickChips.tsx
│   │   ├── Analytics.tsx          # domains + keyword counts
│   │   ├── ExportButtons.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── Pagination.tsx
│   ├── lib/
│   │   ├── auth.ts                # NextAuth config + token refresh
│   │   ├── prisma.ts
│   │   ├── gmail.ts               # API wrapper + parsing
│   │   ├── query-builder.ts       # filters → Gmail query string
│   │   ├── date-utils.ts          # presets → after:/before:/newer_than:
│   │   ├── sanitize.ts            # DOMPurify wrapper
│   │   ├── rate-limit.ts
│   │   └── api-helpers.ts         # requireSession, handleGmailError
│   └── types/
│       ├── index.ts
│       └── next-auth.d.ts         # JWT augmentation
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. How filtering maps to Gmail operators

The UI filter object is converted by `src/lib/query-builder.ts`:

| UI filter | Gmail operator |
|---|---|
| Keywords | free text |
| From | `from:…` |
| To | `to:…` |
| Subject | `subject:…` |
| Label | `label:…` |
| Has attachment | `has:attachment` |
| Starred | `is:starred` |
| Unread only | `is:unread` |
| Read only | `is:read` |
| Today / Yesterday / This month / Last month / Custom | `after:YYYY/MM/DD before:YYYY/MM/DD` |
| Last 7 / 30 days | `newer_than:7d` / `newer_than:30d` |
| Raw query | appended verbatim |

Full Gmail operator reference: https://support.google.com/mail/answer/7190

---

## 6. Security notes

- **Secrets never leave the server.** Client ID and client secret live only in `.env.local`; only the sanitized access token is used on the server. The browser never sees the refresh token.
- **Read-only scope.** The app cannot send, modify, delete, or archive anything. If you grant more scopes by accident, reduce them and re-consent.
- **Token refresh.** Access tokens auto-refresh in the NextAuth JWT callback. Refresh failures force sign-out.
- **HTML sanitization.** Email bodies are sanitized with DOMPurify before rendering, scripts/iframes/event handlers are stripped, and remote images are blocked by default (toggle per message).
- **Rate limiting.** In-memory per-user limits: 30 searches/min, 5 exports/min.
- **Optional allow-list.** Set `ALLOWED_EMAIL` in `.env.local` to reject any account other than yours.
- **Never commit `.env.local`.** `.gitignore` already excludes it.

---

## 7. Switching to PostgreSQL

1. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Put the Postgres URL in `.env.local`:
   ```ini
   DATABASE_URL="postgresql://user:pass@host:5432/gmail_dashboard"
   ```
3. `npx prisma db push`

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` on sign-in | Make sure `http://localhost:3000/api/auth/callback/google` is in **Authorized redirect URIs**. |
| `Access blocked: This app's request is invalid` | Add your email under **Test users** on the OAuth consent screen. |
| `invalid_grant` errors after a while | Token refresh failed. Sign out and back in. If repeated, re-run OAuth with `prompt=consent` (already configured). |
| Empty results but Gmail shows matches | Check your `label:` — Gmail labels are case sensitive and use the visible label name, not the system ID. |
| No refresh token issued | Fully revoke the app at https://myaccount.google.com/permissions and sign in again; `prompt=consent` should force a new refresh token. |
| Database file locked | Stop any running `next dev` process before running `prisma db push`. |

---

## 9. License

Personal / educational use. Adapt freely.
