# NutriSync — Replit.md

## Overview

NutriSync is a nutrition calculator web app. Users enter their biometrics (weight, height, age, gender, activity level, fitness goal) and receive a personalized daily/weekly calorie target plus macronutrient breakdowns (protein, carbs, fat). The app generates daily and weekly meal plans (Simple or Gourmet style) from a built-in meal database, displays results with charts, supports PDF export of meal plans and shopping lists, and allows user accounts to save and manage meal plans.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework:** React (via Vite, not Next.js — no RSC)
- **Routing:** Wouter (client-side routing; `/` for Dashboard, `/auth` for login/register, `NotFound` fallback)
- **State/data fetching:** TanStack React Query for server state; React Hook Form + Zod for form validation
- **UI components:** shadcn/ui (New York style) built on Radix UI primitives
- **Styling:** Tailwind CSS with custom CSS variables for theming; fonts are DM Sans (body) and Outfit (display), loaded from Google Fonts
- **Animations:** Framer Motion for entry animations and transitions
- **Charts:** Recharts (PieChart for macro breakdown)
- **PDF export:** jsPDF (client-side PDF generation of meal plans and shopping lists with NutriSync branding)
- **Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`

**Key frontend components:**
- `calculator-form.tsx` — Collects user biometrics; pre-fills from user's last calculation when logged in
- `results-display.tsx` — Shows calorie targets, macro breakdown chart, meal plan, PDF export, shopping list PDF
- `saved-meal-plans.tsx` — Displays saved meal plan cards with rename/delete actions
- `pages/auth.tsx` — Login/register page with tabbed UI
- `hooks/use-auth.ts` — Auth state hook (user, login, register, logout, loading states)
- `hooks/use-calculations.ts` — Calculation history hook and create mutation

**Important data note:** PostgreSQL `numeric` columns (weight, height, targetAmount) come back as strings from `drizzle-orm/pg-core`. The form keeps weight/height as strings to match the Drizzle schema; age uses `z.coerce.number()`. Empty `targetAmount` is coerced to `null` before DB insert.

### Backend

- **Runtime:** Node.js with TypeScript (tsx for dev, esbuild for production bundle)
- **Framework:** Express 5
- **Dev server:** Vite middleware mode integrated into Express (HMR over `/vite-hmr`)
- **Session:** `express-session` + `connect-pg-simple` storing sessions in the `session` table; `SESSION_SECRET` env var required
- **Auth routes:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- **Production build:** esbuild bundles the server to `dist/index.cjs`; Vite builds the client to `dist/public`
- **API pattern:** REST; all routes under `/api`. Route definitions and Zod schemas are shared between client and server via the `shared/` directory
- **Meal plan generation:** Server-side, using a static hardcoded `MEAL_DATABASE` and `GOURMET_MEAL_DATABASE` in `server/routes.ts`
- **Calorie/macro calculation:** Performed server-side using TDEE/Harris-Benedict style formulas, stored as computed integer columns
- **Auto-save:** When a logged-in user generates a meal plan, it is automatically saved to `saved_meal_plans`

### Shared Layer (`shared/`)

- `schema.ts` — Drizzle ORM table definitions: `users`, `calculations`, `savedMealPlans`, `session` (created via SQL). Exports insert schemas, select types, and `PublicUser` type.
- `routes.ts` — Zod schemas for API request/response contracts, shared by both client hooks and server route handlers.

### Data Storage

- **Database:** PostgreSQL (Drizzle ORM, `drizzle-orm/node-postgres`)
- **Connection:** `pg.Pool` via `DATABASE_URL` env var
- **Tables:**
  - `users` — id, email (unique), name, password_hash, created_at
  - `calculations` — id, user_id (FK nullable), weight, height, age, gender, activity_level, goal, target_type, target_amount, daily_calories, weekly_calories, protein_goal, carbs_goal, fat_goal, created_at
  - `saved_meal_plans` — id, user_id (FK), calculation_id (FK nullable), name, plan_type, meal_style, plan_data (jsonb), created_at
  - `session` — connect-pg-simple session store (created manually via SQL)
- **Migrations:** Drizzle Kit (`drizzle-kit push` for schema sync)
- **Storage interface:** `IStorage` / `DatabaseStorage` in `server/storage.ts`

### Authentication

- Session-based auth via `express-session` + PostgreSQL session store
- Passwords hashed with `bcryptjs`
- `req.session.userId` used throughout routes to scope data to the logged-in user
- Calculations and meal plans are scoped to user when logged in; fallback to all records for anonymous users

### Build & Dev

- `npm run dev` — starts Express + Vite middleware (HMR enabled)
- `npm run build` — runs Vite client build then esbuild server bundle
- `npm run db:push` — syncs Drizzle schema to the database

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| PostgreSQL | Primary database (via `DATABASE_URL` env var) |
| Google Fonts | DM Sans and Outfit typefaces |
| Radix UI | Accessible headless component primitives |
| TanStack React Query | Server state management and data fetching |
| Framer Motion | Animations and transitions |
| Recharts | Macro breakdown pie chart |
| jsPDF | Client-side PDF export of meal plans and shopping lists |
| Drizzle ORM + drizzle-zod | Database ORM and schema-to-Zod validation bridge |
| Zod | Runtime validation on both client and server |
| React Hook Form + @hookform/resolvers | Form state management with Zod resolver |
| Wouter | Lightweight client-side routing |
| express-session + connect-pg-simple | Session-based authentication with PostgreSQL store |
| bcryptjs | Password hashing |
| date-fns | Date formatting |
| Vite + @vitejs/plugin-react | Client bundler and dev server |
| esbuild | Server bundler for production |
