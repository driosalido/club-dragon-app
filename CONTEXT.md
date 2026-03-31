# Club Dragon Madrid — Platform Context

## Overview

Web application for Club Dragon Madrid (~280 members) that facilitates:
1. Finding game partners and organising sessions
2. Managing stored games (multi-session campaigns) with expiry control
3. Member profiles with game catalogs and availability
4. Mesa fija (fixed table) requests and queue management

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Telegram (3 flows) + JWT (jose) |
| Bot / Notifications | Telegram Bot API (grammy) |
| Validation | Zod v4 |
| Data fetching | TanStack React Query v5 |
| Forms | react-hook-form + @hookform/resolvers |
| Dates | date-fns v4 (locale es) |
| Icons | lucide-react |
| Cron jobs | Vercel Cron |
| Rate limiting | Upstash Redis (KV_REST_API_*) |
| Hosting | Vercel (Preview = dev branch, Production = main branch) |

## Project structure

```
club-dragon/
├── src/
│   ├── __tests__/
│   ├── app/
│   │   ├── (auth)/login/         # Login page (3 auth methods)
│   │   ├── (app)/                # Protected app routes
│   │   │   ├── layout.tsx        # Main layout with BottomNav
│   │   │   ├── tableros/         # Storage management
│   │   │   ├── partidas/         # Game sessions
│   │   │   ├── perfil/           # User profile
│   │   │   └── admin/            # Admin panel (socios, mesas-fijas)
│   │   └── api/
│   │       ├── auth/telegram/
│   │       ├── auth/telegram-miniapp/
│   │       ├── auth/telegram-link/start|status/
│   │       ├── auth/logout/
│   │       ├── users/
│   │       ├── users/me/
│   │       ├── games/
│   │       ├── games/bgg/
│   │       ├── sessions/
│   │       ├── sessions/[id]/
│   │       ├── storage/
│   │       ├── storage/mesa-fija-requests/
│   │       ├── admin/users/
│   │       ├── admin/migrate/
│   │       ├── admin/sync-slots/
│   │       ├── telegram/webhook/
│   │       └── cron/storage-semaphore/
│   ├── components/
│   │   ├── BottomNav.tsx
│   │   ├── QueryProvider.tsx
│   │   ├── TelegramLoginButton.tsx
│   │   ├── TelegramMiniAppAuth.tsx
│   │   ├── TelegramLinkAuth.tsx
│   │   └── OnboardingWizard.tsx
│   ├── config/
│   │   └── storage.ts            # Slot config (pizzeros, mesas fijas, lifecycle)
│   ├── lib/
│   │   ├── auth.ts               # JWT verify + requireAuth helpers
│   │   ├── auth-cookie.ts        # HttpOnly cookie builder (90-day, Secure)
│   │   ├── bgg.ts                # BoardGameGeek XML parser
│   │   ├── supabase/client.ts    # Browser Supabase client
│   │   ├── supabase/server.ts    # Server + service-role Supabase clients
│   │   ├── telegram/bot.ts       # grammy notification helpers
│   │   ├── telegram/verify.ts    # Widget hash verification
│   │   ├── telegram/miniapp.ts   # Mini App initData verification
│   │   ├── matching/notify.ts    # Session match notifications
│   │   └── matching/session-status.ts
│   ├── proxy.ts                  # Route protection middleware
│   └── types/
│       └── database.ts           # Supabase auto-generated types
├── supabase/migrations/          # 15 migrations
├── vercel.json                   # Cron: /api/cron/storage-semaphore at 8:00 UTC daily
├── CONTEXT.md                    # This file
└── AGENTS.md                     # AI agent instructions
```

## Authentication

Three auth flows are supported, all checked against `TELEGRAM_GROUP_ID` group membership:

### 1. Telegram Login Widget (`/api/auth/telegram`)
- Classic browser widget, verifies HMAC-SHA256 hash with bot token
- `auth_date` must be < 86400 seconds old
- Used as fallback for desktop browsers

### 2. Telegram Mini App (`/api/auth/telegram-miniapp`)
- Receives `initData` from `window.Telegram.WebApp.initData`
- Verifies HMAC with `WebAppData` key derivation (Mini App protocol)
- Auto-authenticates silently when opened as Mini App

### 3. Link-based polling (`/api/auth/telegram-link/start` + `/status`)
- Step 1: `POST /start` → returns a short-lived token
- Step 2: User confirms auth in the Telegram bot
- Step 3: Client polls `GET /status?token=...` every 2s (5-min expiry)
- Stored in `telegram_login_requests` table

### After auth
- User upserted in `users` table keyed on `telegram_id`
- JWT issued (HS256, 90-day expiry, signed with `JWT_SECRET`)
- Cookie: `auth-token`, HttpOnly, SameSite=Lax, Secure (HTTPS only), 90 days

### Route protection (`src/proxy.ts`)
Protected paths: `/partidas`, `/tableros`, `/perfil`, `/admin`
Redirects to `/login` if JWT missing or invalid.

## Critical business rules

### Storage — Traffic light lifecycle

Config in `src/config/storage.ts`:
- **3 pizzeros** (A, B, C), each with **10 slots** = 30 slots total
- **4 mesas fijas**
- Lifecycle thresholds: warning=31d, critical=61d, expired=81d

| Status | Days since `last_session_at` | Action |
|--------|------------------------------|--------|
| `active` | 0–30 | — |
| `warning` | 31–60 | Bot notifies players |
| `critical` | 61–80 | Bot sends urgent alert |
| `expired` | ≥81 | Bot notifies players + admins |
| `evicted` | — | Admin manually evicted |
| `completed` | — | Game completed by players |

- PostgreSQL trigger updates `status` and `last_session_at` on new `stored_game_sessions` row
- Daily cron at 08:00 UTC checks all stored games and fires notifications
- `sync-slots` admin endpoint syncs slots from config to DB

### Mesa fija queue

Requests have a `queue_position` and flow through these statuses:
`queued` → `approved` → `assigned` (slot allocated)
`queued/approved` → `rejected` | `cancelled` | `expired`

### Session matching
- When session is created, find members who have `game_id` in `user_games`
- Exclude host and members already signed up to another session of the same game on that date/time
- Order by interest level: `own_and_teach` > `want_to_play` > `learning`
- Rate limit: max 1 notification per game per member per 24h (Upstash KV)

### Session status lifecycle
```
open → full (max_players reached)
full → confirmed (when min_players participants confirmed)
open/full/confirmed → cancelled (host cancels)
confirmed → completed (host marks done)
```

## Data model

### users
```sql
id UUID PK
telegram_id BIGINT UNIQUE NOT NULL
telegram_username TEXT
display_name TEXT NOT NULL
avatar_url TEXT
bio TEXT
is_admin BOOLEAN DEFAULT false
is_active BOOLEAN DEFAULT true
member_number INTEGER
created_at TIMESTAMPTZ DEFAULT now()
last_seen_at TIMESTAMPTZ
```

### games
```sql
id UUID PK
bgg_id INTEGER UNIQUE
name TEXT NOT NULL
category TEXT CHECK (category IN ('wargame_tablero','wargame_figuras','euros','rol','abstracto','familiar'))
min_players SMALLINT
max_players SMALLINT
avg_duration_min SMALLINT
thumbnail_url TEXT
added_by UUID REFERENCES users(id)
created_at TIMESTAMPTZ DEFAULT now()
```

### user_games
```sql
user_id UUID REFERENCES users(id)
game_id UUID REFERENCES games(id)
interest_level TEXT CHECK (interest_level IN ('want_to_play','own_and_teach','learning'))
notes TEXT
created_at TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (user_id, game_id)
```

### sessions
```sql
id UUID PK
host_user_id UUID REFERENCES users(id)
game_id UUID REFERENCES games(id)
stored_game_id UUID REFERENCES stored_games(id)
title TEXT
description TEXT
status TEXT DEFAULT 'open' CHECK (status IN ('open','full','confirmed','cancelled','completed'))
location_type TEXT CHECK (location_type IN ('club','home','online'))
location_details TEXT
scheduled_date DATE NOT NULL
scheduled_time_start TIME
scheduled_time_end TIME
min_players SMALLINT NOT NULL
max_players SMALLINT NOT NULL
created_at TIMESTAMPTZ DEFAULT now()
```

### session_participants
```sql
session_id UUID REFERENCES sessions(id)
user_id UUID REFERENCES users(id)
status TEXT CHECK (status IN ('interested','confirmed','waitlist','declined'))
joined_at TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (session_id, user_id)
```

### storage_slots
```sql
id UUID PK
slot_number SMALLINT UNIQUE NOT NULL
label TEXT
notes TEXT
is_active BOOLEAN DEFAULT true
max_board_size TEXT CHECK (max_board_size IN ('small','medium','large','xl'))
slot_type TEXT NOT NULL CHECK (slot_type IN ('pizzero','mesa_fija'))
pizzero TEXT CHECK (pizzero IN ('A','B','C'))   -- only for pizzero slots
```

### stored_games
```sql
id UUID PK
slot_id UUID REFERENCES storage_slots(id) UNIQUE
game_id UUID REFERENCES games(id)
registered_by UUID REFERENCES users(id)
responsible_user_id UUID REFERENCES users(id)  -- main contact
status TEXT DEFAULT 'active' CHECK (status IN ('active','warning','critical','expired','completed','evicted'))
started_at TIMESTAMPTZ DEFAULT now()
last_session_at TIMESTAMPTZ DEFAULT now()
scenario_notes TEXT
current_state_notes TEXT
turn_info TEXT
expected_end_date DATE
expected_duration_months INTEGER
completed_at TIMESTAMPTZ
```

### stored_game_players
```sql
stored_game_id UUID REFERENCES stored_games(id)
user_id UUID REFERENCES users(id)
faction_or_side TEXT
joined_at TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (stored_game_id, user_id)
```

### stored_game_sessions
```sql
id UUID PK
stored_game_id UUID REFERENCES stored_games(id)
logged_by UUID REFERENCES users(id)
session_date DATE NOT NULL
duration_minutes SMALLINT
state_after_session TEXT
next_turn_info TEXT
linked_session_id UUID REFERENCES sessions(id)
created_at TIMESTAMPTZ DEFAULT now()
```

### mesa_fija_requests
```sql
id UUID PK
slot_id UUID REFERENCES storage_slots(id)   -- nullable (can request without specific slot)
requester_id UUID REFERENCES users(id)
game_id UUID REFERENCES games(id)
status TEXT DEFAULT 'queued' CHECK (status IN ('queued','approved','rejected','assigned','cancelled','expired'))
queue_position INTEGER NOT NULL
reason TEXT
admin_notes TEXT
reviewed_by UUID REFERENCES users(id)
requested_at TIMESTAMPTZ DEFAULT now()
reviewed_at TIMESTAMPTZ
assigned_at TIMESTAMPTZ
expires_at TIMESTAMPTZ
expected_end_date DATE
expected_duration_months INTEGER
created_at TIMESTAMPTZ DEFAULT now()
```

### telegram_login_requests
```sql
token TEXT PK
status TEXT CHECK (status IN ('pending','approved','rejected','consumed'))
telegram_id BIGINT
telegram_username TEXT
telegram_first_name TEXT
telegram_last_name TEXT
telegram_photo_url TEXT
created_at TIMESTAMPTZ DEFAULT now()
expires_at TIMESTAMPTZ NOT NULL
approved_at TIMESTAMPTZ
consumed_at TIMESTAMPTZ
```

### user_availability
```sql
id UUID PK
user_id UUID REFERENCES users(id)
day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6)
time_start TIME
time_end TIME
```

### user_availability_exceptions
```sql
user_id UUID REFERENCES users(id)
exception_date DATE NOT NULL
available BOOLEAN DEFAULT false
note TEXT
PRIMARY KEY (user_id, exception_date)
```

## Required environment variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
JWT_SECRET=                          # openssl rand -hex 32

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_ID=                   # -1001234567890 (membership check)
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=   # shown in login widget
TELEGRAM_BOT_USERNAME=               # same, server-side
TELEGRAM_WEBHOOK_SECRET=             # optional, webhook security

# Rate limiting
KV_REST_API_URL=                     # Upstash KV
KV_REST_API_TOKEN=

# Cron
CRON_SECRET=                         # openssl rand -hex 32
```

### Environment separation (Vercel)
- **Production** (`main` branch): prod Supabase, prod bot (`@ClubDragonMadridBot`), prod group
- **Preview** (`dev` branch): dev Supabase, dev bot (`@ClubDragonDevBot`), test group
- Dev bot requires being an **admin** of the test Telegram group to call `getChatMember`

## Code conventions

- Strict TypeScript (`strict: true`)
- Server Components by default; `'use client'` only when needed
- API routes in `app/api/` with Zod validation on all inputs
- Row Level Security on all Supabase tables
- Errors returned as `{ error: string, code?: string }`
- Dates: UTC internally, displayed in Europe/Madrid timezone (Intl or date-fns locale es)
- Tests: Vitest + Testing Library
- Auth cookie: HttpOnly, SameSite=Lax, Secure (HTTPS), 90-day max-age
- Notifications via grammy — use `safeSend()` to silently handle blocked users
