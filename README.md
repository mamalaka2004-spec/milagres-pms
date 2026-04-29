# Milagres PMS

Property Management System for **Milagres Hospedagens** — premium vacation rentals in São Miguel dos Milagres, Alagoas, Brazil.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI:** shadcn/ui patterns + custom components
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **AI:** Anthropic Claude API
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod

## Getting Started

### 1. Prerequisites

- Node.js 18+
- npm or pnpm
- A Supabase project ([supabase.com](https://supabase.com))
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd milagres-pms
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMBER=5582999999999
```

### 4. Database Setup

1. Go to your Supabase project → SQL Editor
2. Copy the contents of `supabase/migrations/001_full_schema.sql`
3. Run the migration — this creates all 20 tables, indexes, triggers, RLS policies, and seed data

### 5. Create Admin User

In Supabase Dashboard → Authentication → Users → Add User:

- Email: `admin@milagreshospedagens.com`
- Password: your choice

Then in SQL Editor, insert the user record:

```sql
INSERT INTO public.users (id, company_id, email, full_name, role)
VALUES (
  '<auth-user-uuid>',
  'a0000000-0000-0000-0000-000000000001',
  'admin@milagreshospedagens.com',
  'Reginaldo',
  'admin'
);
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public landing page.
Open [http://localhost:3000/login](http://localhost:3000/login) to sign in.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, forgot password
│   ├── (dashboard)/     # Admin: dashboard, reservations, calendar, etc.
│   ├── (public)/        # Public: landing, property pages, booking
│   └── api/             # API routes
├── components/
│   ├── ui/              # Base UI components (shadcn-style)
│   ├── layout/          # Sidebar, topbar, navigation
│   ├── dashboard/       # Dashboard-specific components
│   ├── shared/          # Status badges, empty states, etc.
│   └── ...              # Module-specific components
├── lib/
│   ├── supabase/        # Supabase client utilities
│   ├── db/queries/      # Database query functions
│   ├── ai/              # AI assistant (prompts, tools, guardrails)
│   ├── validations/     # Zod schemas
│   └── utils/           # Formatting, constants, helpers
├── hooks/               # Custom React hooks
└── types/               # TypeScript type definitions
```

## Sprint Roadmap

| Sprint | Focus | Status |
|--------|-------|--------|
| 0 | Foundation, Auth, Layout | ✅ Done |
| 1 | Properties CRUD | 🔜 Next |
| 2 | Guests + Reservations | Planned |
| 3 | Calendar + Availability | Planned |
| 4 | Finance + Payments | Planned |
| 5 | Operations / Housekeeping | Planned |
| 6 | Public Pages + Booking Flow | Planned |
| 7 | AI Assistant | Planned |
| 8 | Polish + Deploy | Planned |

## Brand

- **Primary:** Sage green `#6B7F5E`
- **Cream:** `#F0EBE0`
- **Heading font:** Cormorant Garamond
- **Body font:** DM Sans

## License

Private — Milagres Hospedagens © 2026
