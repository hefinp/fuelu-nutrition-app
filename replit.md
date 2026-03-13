# NutriSync — Replit.md

## Overview

NutriSync is a full-stack nutrition calculator web app. Users enter their biometrics to receive personalized daily/weekly calorie targets and macronutrient breakdowns. The app generates meal plans (Simple, Gourmet, Michelin) filtered by food preferences, allergies, and disliked meals. Features include: meal plan save/export (PDF), shopping lists, individual meal replace buttons, food log (daily tracking with macro progress bars), weight tracking (chart + log), hydration tracking (daily goal, quick-log widget, behind-schedule alerts), password reset via email (Resend), email meal plan to inbox, a meal dislike system that excludes disliked meals from future generated plans, web recipe import → personal recipe library, and recipe-to-meal-plan integration with slot controls and weekly limits.

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
- `calculator-form.tsx` — Collects user biometrics; accepts `compact` prop to render form-only (no card wrapper) inside the metrics slide-over panel; pre-fills from user's last calculation when logged in; `onResult` receives full `Calculation` object
- `results-display.tsx` — Shows calorie targets, macro breakdown chart, meal plan, PDF export, shopping list PDF. `MealPlanGenerator` includes a Schedule section: Mon–Sun day chips for daily plans (selecting multiple dates sends `planType: multi-daily`), and a week picker (prev/next arrows) for weekly plans. `computeCyclePhase` accepts an optional `referenceDate` for per-day phase computation. Multi-daily plans render each date as a labeled `DailyMealView`.
- `saved-meal-plans.tsx` — Displays saved meal plan cards with rename/delete actions. Cards show cycle phase badge (coloured pill) for female users with cycle tracking enabled; phase is read from `planData.cyclePhase`, `cyclePhaseByDay`, or `cyclePhaseByDate`.
- `pages/auth.tsx` — Login/register page with tabbed UI; shows Google/Apple OAuth buttons when provider secrets are configured (fetched from `/api/auth/providers`), hidden during beta invite gate; invite code field shown conditionally when `INVITE_CODES` env var is set; handles `?error=google_failed` and `?error=apple_failed` query params
- `pages/dashboard.tsx` — Main app page; auto-loads last calculation on login; CalculatorForm is in a slide-over panel (user icon → "My Metrics"); two-column layout with ResultsDisplay + WeightTracker when metrics exist; "Set up your metrics" CTA only shown if no prior calculations.
- `components/weight-tracker.tsx` — Weight logging + recharts LineChart; logs weight entries with date, shows current/change/count stats, recent entry list with delete.
- `components/preferences-form.tsx` — Food preferences & allergies form rendered inside the My Metrics panel. Diet types: Vegetarian, Vegan, Pescatarian, Halal, Kosher. Allergies: Gluten, Dairy, Eggs, Nuts, Peanuts, Shellfish, Fish, Soy. Custom food exclusions (tag input), preferred foods (tag input, boosts meal selection), micronutrient optimisation toggle (favours nutrient-dense meals). Saves to `PUT /api/user/preferences`; reads from `GET /api/user/preferences`. Also shows Disliked Meals section to view/remove individually disliked meals.
- `components/hydration-tracker.tsx` — Daily water intake tracker. Circular SVG progress ring showing ml vs daily goal, colour-coded (amber when behind, blue on track, green when complete). Quick-add buttons (+250/500/750/1000ml), custom amount input. Today's log list with timestamps and delete. Behind-schedule alert banner (amber/red thresholds at 12:00/15:00/19:00, dismissible via sessionStorage keyed to today's date). Goal and unit (ml vs glasses, 1 glass=250ml) read from user preferences (`hydrationGoalMl`, `hydrationUnit`). Routes: `GET /api/hydration?date=`, `POST /api/hydration`, `DELETE /api/hydration/:id`.
- `components/food-log.tsx` — Food log with Daily/Weekly view toggle. Daily view: today's entries with macro progress bars (only confirmed entries counted) vs daily targets. Unconfirmed (planned) entries show with dashed border and muted style + green confirm button; planned summary line shows count/total kcal. Weekly view: fetches current week (Mon–Sun) via `GET /api/food-log?from=&to=`, shows per-day calorie/macro rows with weekly totals progress bars. Add/delete/confirm entries. Reads from `GET /api/food-log?date=YYYY-MM-DD` (daily) or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (weekly range); posts to `POST /api/food-log`; patch to `PATCH /api/food-log/:id/confirm`. Scan tab: barcode scanner (ZXing), community DB check first, then Open Food Facts + USDA. Barcode not-found → photo interstitial: "Take a photo of the label" (GPT-4o Vision) or "Enter manually". Label scan results show "Estimated values" amber badge if AI couldn't read label confidently. Scan results with `sourceType: "label"|"estimated"` auto-saved to community `custom_foods` DB.
- **Email Plan feature:** Email Plan button on saved meal plans. For daily plans, shows an inline "Scale shopping list for N days" selector before sending. For weekly plans, sends immediately. The email includes: plan name, full meal breakdown (day/slot/meal/macros), and a categorised shopping list (Protein, Produce, Grains & Carbs, Dairy, Pantry & Spices, Other) scaled to the chosen number of days. Shopping list data is generated client-side via `buildShoppingList()` from `results-display.tsx` and passed to `POST /api/saved-meal-plans/:id/email`. All user-provided values in email HTML are sanitized via `esc()` to prevent HTML injection.
- `pages/forgot-password.tsx` — Forgot password form; POSTs to `/api/auth/forgot-password`, shows confirmation after sending.
- `pages/reset-password.tsx` — Password reset form accessed via `?token=` param; POSTs to `/api/auth/reset-password`, redirects to `/auth` on success.
- `pages/landing.tsx` — Marketing landing page for logged-out visitors
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
- **Meal plan generation:** Server-side using three static meal databases in `server/routes.ts`: `MEAL_DATABASE` (simple), `GOURMET_MEAL_DATABASE`, `MICHELIN_MEAL_DATABASE`. Each has breakfast/lunch/dinner/snack pools with `microScore` (1–5) rating nutrient density. Meals are filtered by user preferences/allergies/custom exclusions using keyword matching before plan generation. `pickBestMeal` scores by macro fit, preferred-food boost, and optional micronutrient weighting. Three-tier selector (Simple/Fancy/Michelin) on the frontend.
- **Calorie/macro calculation:** Performed server-side using TDEE/Harris-Benedict style formulas, stored as computed integer columns
- **Auto-save:** When a logged-in user generates a meal plan, it is automatically saved to `saved_meal_plans`

### Shared Layer (`shared/`)

- `schema.ts` — Drizzle ORM table definitions: `users`, `calculations`, `savedMealPlans`, `session` (created via SQL). Exports insert schemas, select types, and `PublicUser` type.
- `routes.ts` — Zod schemas for API request/response contracts, shared by both client hooks and server route handlers.

### Data Storage

- **Database:** PostgreSQL (Drizzle ORM, `drizzle-orm/node-postgres`)
- **Connection:** `pg.Pool` via `DATABASE_URL` env var
- **Tables:**
  - `users` — id, email (unique), name, password_hash (nullable), provider, provider_id, preferences (jsonb: `{diet, allergies, excludedFoods, preferredFoods, micronutrientOptimize, dislikedMeals}`), created_at
  - `calculations` — id, user_id (FK nullable), weight, height, age, gender, activity_level, goal, target_type, target_amount, daily_calories, weekly_calories, protein_goal, carbs_goal, fat_goal, created_at
  - `saved_meal_plans` — id, user_id (FK), calculation_id (FK nullable), name, plan_type, meal_style, plan_data (jsonb), created_at
  - `weight_entries` — id, user_id (FK), weight (numeric), recorded_at
  - `food_log_entries` — id, user_id (FK), date (text YYYY-MM-DD), meal_name, calories, protein, carbs, fat, created_at
  - `password_reset_tokens` — id, user_id (FK), token (unique), expires_at, used_at (nullable)
  - `session` — connect-pg-simple session store (created manually via SQL)
- **Migrations:** Drizzle Kit (`drizzle-kit push` for schema sync); new tables were created directly via psql when drizzle-kit interactive prompts couldn't be bypassed
- **Storage interface:** `IStorage` / `DatabaseStorage` in `server/storage.ts`

### Authentication

- Session-based auth via `express-session` + PostgreSQL session store
- Passwords hashed with `bcryptjs`; password_hash is nullable for OAuth-only accounts
- `req.session.userId` used throughout routes to scope data to the logged-in user
- Calculations and meal plans are scoped to user when logged in; fallback to all records for anonymous users
- **OAuth (Google + Apple):** Passport.js with `passport-google-oauth20` and `passport-apple`. Strategies are only registered when env vars are present (graceful degradation). `GET /api/auth/google` → Google OAuth redirect; `GET /api/auth/google/callback` → sets session and redirects to `/dashboard`. Same pattern for Apple (`POST /api/auth/apple/callback` — Apple POSTs back). `GET /api/auth/providers` endpoint returns `{google: bool, apple: bool}` for the UI to conditionally show buttons. `findOrCreateOAuthUser` in storage links OAuth users by provider+providerId, or by email if account already exists.
- **Invite code beta gate:** When `INVITE_CODES` env var is set (comma-separated list), registration requires a valid invite code. `GET /api/auth/invite-required` returns `{required: bool}`. Backend validates invite code (case-insensitive) before user creation. OAuth routes blocked during beta. Frontend shows invite code field conditionally and hides OAuth buttons. If `INVITE_CODES` is unset, gate is disabled and registration is open. Current codes: BETA2024, NUTRI01, FRIEND42.
- **Required secrets for OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Google); `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (Apple, .p8 file contents with `\n` for newlines)

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
| resend | Transactional email (password reset, email meal plan). Requires `RESEND_API_KEY` env var. The Replit integration was dismissed — either connect the Replit Resend integration or add `RESEND_API_KEY` manually as a secret. Without it, emails are skipped with a console warning. |
| date-fns | Date formatting |
| Vite + @vitejs/plugin-react | Client bundler and dev server |
| esbuild | Server bundler for production |
