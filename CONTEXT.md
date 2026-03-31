# Club Dragon Madrid — Platform Context

## Overview

Web application for Club Dragon Madrid (~280 members) that facilitates:
1. Finding game partners and closing sessions
2. Managing stored games (multi-session campaigns) with expiry control
3. Member profiles with game catalogs and availability

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Telegram Login Widget + JWT (jose) |
| Bot / Notifications | Telegram Bot API (grammy) |
| Validation | Zod |
| Data fetching | TanStack React Query v5 |
| Dates | date-fns (locale es) |
| Cron jobs | Vercel Cron |
| Rate limiting | Vercel KV (Redis) |
| Hosting | Vercel (Free Tier) |

## Project structure

```
club-dragon/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (app)/
│   │   ├── partidas/
│   │   ├── tableros/
│   │   └── perfil/
│   └── api/
│       ├── auth/telegram/
│       ├── users/
│       ├── games/
│       ├── sessions/
│       ├── storage/
│       └── cron/storage-semaphore/
├── components/
├── lib/
│   ├── supabase/
│   ├── telegram/
│   └── matching/
├── types/
└── supabase/
    └── migrations/
```

## Critical business rules

### Authentication
- Use the official Telegram Login Widget
- Verify HMAC-SHA256 signature with bot token
- Payload is only valid if `auth_date` < 86400 seconds ago
- JWT expires in 30 days

### Stored games — Traffic light

| Status | Days since `last_session_at` | Action |
|--------|------------------------------|--------|
| `active` (green) | 0–22 | — |
| `warning` (yellow) | 23–27 | Bot notifies the group |
| `critical` (red) | 28–30 | Bot sends urgent alert |
| `expired` | >30 | Bot notifies players + admins |

- A PostgreSQL trigger automatically updates `status` and `last_session_at` when a row is inserted into `stored_game_sessions`
- A daily cron job at 09:00 Europe/Madrid checks all stored games and fires notifications

### Session matching
- When a session is created, find members who have that `game_id` in `user_games`
- Exclude the host and members already signed up to another session of the same game on that date/time
- Order by interest level: `own_and_teach` > `want_to_play` > `learning`
- Rate limit: max 1 notification for the same game to the same member per 24h (Vercel KV)

### Session status lifecycle
```
open → full (when max_players is reached) → confirmed (when min_players is reached)
open / full / confirmed → cancelled (host cancels, all participants notified)
confirmed → completed (host marks as finished)
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
stored_game_id UUID REFERENCES stored_games(id)  -- nullable
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
```

### stored_games
```sql
id UUID PK
slot_id UUID REFERENCES storage_slots(id) UNIQUE
game_id UUID REFERENCES games(id)
registered_by UUID REFERENCES users(id)
status TEXT DEFAULT 'active' CHECK (status IN ('active','warning','critical','expired','completed','evicted'))
started_at TIMESTAMPTZ DEFAULT now()
last_session_at TIMESTAMPTZ DEFAULT now()
scenario_notes TEXT
current_state_notes TEXT
turn_info TEXT
expected_end_date DATE
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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
JWT_SECRET=
CRON_SECRET=
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

## Code conventions

- Strict TypeScript (`strict: true`)
- Server Components by default, Client Components only when needed
- API routes in `app/api/` with Zod validation on all inputs
- Row Level Security on all Supabase tables
- Errors as `{ error: string, code?: string }`
- Dates always UTC internally, displayed in Europe/Madrid timezone
- Tests with Vitest + Testing Library
