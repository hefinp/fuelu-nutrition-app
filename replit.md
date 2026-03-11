# NutriSync — Replit.md

## Overview

NutriSync is a nutrition calculator web app. Users enter their biometrics (weight, height, age, gender, activity level, fitness goal, and target weight change) and receive a personalized daily/weekly calorie target plus macronutrient breakdowns (protein, carbs, fat). The app also generates daily and weekly meal plans from a built-in meal database, displays results with charts, and allows PDF export. Calculation history is stored in a PostgreSQL database.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework:** React (via Vite, not Next.js — no RSC)
- **Routing:** Wouter (lightweight client-side routing; single `Dashboard` route + `NotFound` fallback)
- **State/data fetching:** TanStack React Query for server state; React Hook Form + Zod for form validation
- **UI components:** shadcn/ui (New York style) built on Radix UI primitives
- **Styling:** Tailwind CSS with custom CSS variables for theming; fonts are DM Sans (body) and Outfit (display), loaded from Google Fonts
- **Animations:** Framer Motion for entry animations and transitions
- **Charts:** Recharts (PieChart for macro breakdown)
- **PDF export:** jsPDF (client-side PDF generation of meal plans)
- **Path aliases:** `@/` → `client/src/`, `@shared/` → `shared/`

**Key frontend components:**
- `calculator-form.tsx` — Collects user biometrics and submits to the API
- `results-display.tsx` — Shows calorie targets, macro breakdown chart, meal plan, and PDF export
- `history-list.tsx` — Lists past calculations fetched from the API

**Important data note:** PostgreSQL `numeric` columns (weight, height, targetAmount) come back as strings from `drizzle-orm/pg-core`. The form keeps weight/height as strings to match the Drizzle schema; age uses `z.coerce.number()`.

### Backend

- **Runtime:** Node.js with TypeScript (tsx for dev, esbuild for production bundle)
- **Framework:** Express 5
- **Dev server:** Vite middleware mode integrated into Express (HMR over `/vite-hmr`)
- **Production build:** esbuild bundles the server to `dist/index.cjs`; Vite builds the client to `dist/public`
- **API pattern:** REST; all routes under `/api`. Route definitions and Zod schemas are shared between client and server via the `shared/` directory
- **Meal plan generation:** Server-side, using a static hardcoded `MEAL_DATABASE` in `server/routes.ts` — no external AI/nutrition API currently used
- **Calorie/macro calculation:** Performed server-side in the route handler using standard formulas (TDEE/Harris-Benedict style), stored as computed integer columns

### Shared Layer (`shared/`)

- `schema.ts` — Drizzle ORM table definitions + `drizzle-zod` insert schema. Single table: `calculations`
- `routes.ts` — Zod schemas for API request/response contracts, shared by both client hooks and server route handlers. Acts as a typed API contract layer.

### Data Storage

- **Database:** PostgreSQL (Drizzle ORM, `drizzle-orm/node-postgres`)
- **Connection:** `pg.Pool` via `DATABASE_URL` env var
- **Schema:** Single table `calculations` storing user inputs plus computed calorie and macro goals
- **Migrations:** Drizzle Kit (`drizzle-kit push` for schema sync; migrations output to `./migrations/`)
- **Storage interface:** `IStorage` / `DatabaseStorage` in `server/storage.ts` — simple create + list operations

### Authentication

- No authentication system is present. The app is stateless and open — any user can submit and view calculations.

### Build & Dev

- `npm run dev` — starts Express + Vite middleware (HMR enabled)
- `npm run build` — runs Vite client build then esbuild server bundle
- `npm run db:push` — syncs Drizzle schema to the database

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| PostgreSQL | Primary database (via `DATABASE_URL` env var — must be provisioned) |
| Google Fonts | DM Sans and Outfit typefaces (loaded via CDN in `index.html` and `index.css`) |
| Radix UI | Accessible headless component primitives for all UI components |
| TanStack React Query | Server state management and data fetching on the client |
| Framer Motion | Animations and transitions |
| Recharts | Macro breakdown pie chart |
| jsPDF | Client-side PDF export of meal plans |
| Drizzle ORM + drizzle-zod | Database ORM and schema-to-Zod validation bridge |
| Zod | Runtime validation on both client and server |
| React Hook Form + @hookform/resolvers | Form state management with Zod resolver |
| Wouter | Lightweight client-side routing |
| date-fns | Date formatting in history list |
| Vite + @vitejs/plugin-react | Client bundler and dev server |
| esbuild | Server bundler for production |
| @replit/vite-plugin-runtime-error-modal | Runtime error overlay (dev only, Replit environment) |
| @replit/vite-plugin-cartographer | Replit dev tooling (dev only) |
| connect-pg-simple | (Dependency present, not actively used — session store for potential future auth) |