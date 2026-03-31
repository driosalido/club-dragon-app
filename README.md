# Club Dragon Madrid

Internal web platform for Club Dragon Madrid (~280 members) to organize board game sessions, manage stored games, and coordinate availability among club members.

## Features

- **Sessions** — Propose game sessions, automatically find interested players, and manage sign-ups. Notifications via Telegram Bot.
- **Stored games** — Track games stored at the club (shelf slots and dedicated tables) with a traffic-light system that alerts on inactive games (green > yellow > red > expired).
- **Member profiles** — Personal game catalog with interest levels, weekly availability, and schedule exceptions.
- **BGG integration** — Game search and data from BoardGameGeek XML API2.
- **Admin** — Member management, storage slot configuration, and dedicated table requests.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Telegram Login Widget + JWT (jose) |
| Notifications | Telegram Bot API (grammy) |
| Validation | Zod 4 |
| Data fetching | TanStack React Query v5 |
| Tests | Vitest + Testing Library |
| Hosting | Vercel |

## Local development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Start dev server
npm run dev
```

### Required environment variables

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

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | Linter (ESLint) |
| `npm test` | Tests (Vitest) |

## Project structure

```
src/
├── app/
│   ├── (auth)/login/          # Telegram login
│   ├── (app)/                 # Authenticated routes
│   │   ├── partidas/          # Session feed and details
│   │   ├── tableros/          # Storage grid + traffic light
│   │   ├── perfil/            # Member profile
│   │   └── admin/             # Admin panel
│   └── api/                   # Route handlers
│       ├── auth/              # Telegram auth + logout
│       ├── users/             # Profiles and availability
│       ├── games/             # Game catalog + BGG proxy
│       ├── sessions/          # Session CRUD
│       ├── storage/           # Slots, stored games, dedicated tables
│       └── cron/              # Daily traffic-light check
├── components/                # Shared components
├── lib/                       # Business logic
│   ├── auth.ts                # JWT verification
│   ├── bgg.ts                 # BGG XML parsing
│   ├── supabase/              # Supabase clients
│   ├── telegram/              # Bot + verification
│   └── matching/              # Player matching + notifications
├── config/                    # App configuration
└── types/                     # TypeScript types (DB types)
```

## License

[MIT](LICENSE)
