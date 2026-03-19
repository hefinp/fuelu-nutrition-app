# FuelU — Replit.md

## Overview
FuelU is a full-stack nutrition calculator web application that provides personalized dietary management. It generates calorie and macronutrient targets, creates tailored meal plans (Simple, Gourmet, Michelin) based on user preferences and biometrics, and offers features like meal plan save/export (PDF), shopping list generation, and individual meal replacement. The platform also includes a food log with macro tracking, weight tracking with AI insights, hydration tracking, and robust user authentication. FuelU aims to be a holistic solution for personal nutrition, from planning to tracking and analysis, leveraging AI for personalized insights and suggestions. The business vision is to capture a significant market share in personal health and wellness by offering a highly customizable and intelligent nutrition platform.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React (Vite) using Wouter for routing and TanStack React Query for server state management. Form validation is handled by React Hook Form with Zod. UI components leverage shadcn/ui (New York style) based on Radix UI, styled with Tailwind CSS. Animations are powered by Framer Motion, and Recharts is used for data visualization. jsPDF enables client-side PDF generation. Core features include a CalculatorForm, ResultsDisplay for meal plans, SavedMealPlans management, a Dashboard displaying user metrics, WeightTracker with AI insights, PreferencesForm for food and fasting settings, and HydrationTracker. A modular FoodLog and MyMealsFoodWidget provide comprehensive food entry and meal management, including barcode scanning, AI food recognition, and recipe import from various sources (URLs, photos, videos using ffmpeg and GPT-4o vision). Additional premium features include CycleTracker for female users, VitalityTracker for male users with PubMed-sourced AI tips, and an Insights column/tab offering wellbeing analysis and research summaries. The dashboard uses a three-section mental model: **Plan → Track → Insights** on both mobile (tabbed) and desktop (three-column grid at xl breakpoint).

### Backend
The backend runs on Node.js with TypeScript using Express 5. It integrates Vite in middleware mode for development and uses session-based authentication with `express-session` and a PostgreSQL store. The RESTful API shares Zod schemas with the client via a `shared/` directory. Key functionalities include user authentication (register, login, logout, OAuth), server-side meal plan generation with static meal databases and nutrient density scoring, calorie and macronutrient calculations, and APIs for weight tracking, hydration, food logging, cycle tracking, and AI insights. A structured ingredient system stores parsed ingredient data for user, imported, and community meals. A comprehensive tier system (free/simple/advanced/payg) with Stripe integration manages access to features, credits, and subscriptions. A 21-day stepped trial system provides new non-beta users with tiered access before settling on the Free tier.

### Shared Layer
This layer contains Drizzle ORM schema definitions and Zod schemas for API request/response contracts, ensuring type safety and validation across both frontend and backend.

### Data Storage
PostgreSQL is the primary database, managed with Drizzle ORM. Key tables store user data, calculations, saved meal plans, weight entries, food log entries, unified user meals, password reset tokens, sessions, cycle/vitality symptoms, period logs, AI insights cache, feature gates, credit transactions, tier pricing, and credit packs. Database migrations are handled automatically on server start.

**Canonical Foods Database (Phase 1 — Task #157):** A shared `canonical_foods` table serves as the single source of truth for all food data. Foods enter the database via four sources: `user_manual`, `usda_cached`, `ai_generated`, and `barcode_scan`. The food search waterfall is: canonical DB → USDA API (results auto-cached) → AI estimate (results auto-cached). `user_food_bookmarks` replaces `user_saved_foods` — "My Foods" is now a personal bookmarks layer over the shared canonical DB. Existing `custom_foods` and `user_saved_foods` data has been migrated. **Data quality:** `canonicalFoodExistsByName` prefers trusted sources (USDA, NZFCD, FSANZ, barcode) over untrusted (ingredient_parsed, ai_generated) when both exist. On startup, `cleanupBadCanonicalFoods` corrects untrusted entries that have a trusted alternative with significantly different calories, and fixes known bad trusted entries (e.g., USDA "Egg" was cached as 513 kcal). Affected meals are recomputed automatically.

**NZ Restaurant & Hello Fresh Foods:** 153 curated food items from 18 NZ fast food chains (McDonald's, KFC, Subway, Burger King, Pizza Hut, Domino's, Carl's Jr., Wendy's, Taco Bell, Nando's, Oporto, Hell Pizza, Fatburger, Pita Pit, Grill'd, Shake Shack, Lord of the Fries, BurgerFuel) plus 20 Hello Fresh NZ recipes are stored in the `canonical_foods` table with `source='restaurant_nz'` and `brand` field populated. Additional columns: `brand`, `category`, `imageUrl`, `sourceUrl`, `cookTime`, `ingredientsList` (jsonb), `sugar100g`, `saturatedFat100g`. API endpoints: `/api/restaurant-foods/search` (query + brand filter, scoped to `source='restaurant_nz'`), `/api/restaurant-foods/brands` (distinct brand list). Frontend: "Restaurants" tab in AddFoodModal and "Eat Out" tab in food-log-drawer with search, brand filter, and meal slot inference by time of day. Seed data: `server/seeds/restaurant-foods.json`, seeder: `scripts/seed-restaurant-foods.ts`.

**Nutritionist Platform (Tasks #187, #188, #216):** A professional portal for nutritionists and dietitians to manage clients. Tables: `nutritionist_profiles` (tier: starter/professional/practice), `nutritionist_clients` (relationship with status/goal/notes), `nutritionist_invitations` (token-based client invite), `nutritionist_notes` (private clinical notes), `nutritionist_messages` (real-time messaging between nutritionist and client), `practice_accounts` (multi-seat practice), `practice_members` (nutritionists in a practice with admin/member roles). The `Practice` tier supports multiple nutritionist seats under one account. The nutritionist portal at `/nutritionist/portal` includes: Monitoring Dashboard (adherence indicators, alert system for inactive clients and off-target nutrition), Adherence View (planned vs actual daily breakdown), Client Roster with invitation management (with unread message badges per client), In-app messaging thread per client, and Practice Admin panel for seat management and client reassignment. Client-side messaging is available at `/messages` for managed clients, with unread count badge in the dashboard header.

### Authentication
Session-based authentication uses `express-session` and `connect-pg-simple`. Passwords are hashed with `bcryptjs`. OAuth support for Google and Apple is provided via Passport.js, conditionally enabled by environment variables. An optional invite code beta gate can restrict new registrations.

### Nutritionist Portal (Task #187)
A dedicated portal at `/nutritionist` for nutritionists to build and deliver personalised meal plans to clients.

**Features:**
- **Client Management**: Add clients by email, view their profiles and calculation history, take internal notes
- **AI Plan Generation**: Generate weekly or daily meal plans using GPT-4o with the client's stored profile data (goals, preferences, allergies, calorie targets)
- **Prompt-to-Plan Workflow**: Nutritionists type a free-text clinical adjustment note (e.g. "increase protein, peak training block") injected into the AI prompt alongside the client profile
- **Verification Queue**: AI-generated plans land in `pending_review` status for nutritionist review before delivery
- **Plan Approval & Delivery**: Approve plans then push them to the client's account; clients can view delivered plans via `/api/my-nutritionist-plans`
- **Plan Scheduling**: Set future delivery dates on any approved plan
- **Plan History**: Full history of all plans created for each client with delivery dates and statuses
- **Template Library**: Save any plan as a reusable template (e.g. "marathon taper week"), apply templates to any client
- **Annotations**: Add guidance notes on specific meals or days within a plan, surfaced to clients

**Access Control**: Nutritionist access requires the user's email to be in the `NUTRITIONIST_EMAILS` env var (comma-separated) or be the default admin email. Non-nutritionist users see an access-denied banner.

**Target Overrides (Task #217):** Nutritionists can override any client's calculated macro targets (calories, protein, carbs, fat, fibre) with custom values and a clinical rationale note. Overrides are stored in `client_target_overrides` (one row per client, unique on `client_id`). `getEffectiveTargets(clientId)` merges overrides over calculated values and is used throughout the app (monitoring dashboard, adherence, alerts, meal plan generation, client dashboard/diary). The nutritionist portal shows a "Nutrition Targets" panel with visual distinction for overridden fields (amber highlight) and a "Revert to Calculated" option. Clients see effective targets seamlessly via `/api/calculations/effective-targets`.

**Client Progress Reports (Task #218):** Nutritionists can generate, save, and export progress reports for any linked client. Reports aggregate food log data, weight trends, adherence scores, intake averages, clinical notes, and target info over a configurable date range. Reports are stored in `client_reports` with full snapshot data (`reportData` JSONB) and are re-accessible from a "Progress Reports" history panel on each client's profile. Reports can be exported as branded PDFs with weight trend charts, intake summaries, adherence metrics, clinical summaries, and disclaimer. The clinical summary can be edited after generation before export. UI includes a `GenerateReportDialog` modal and `ReportHistoryPanel` component integrated into the client profile view.

**DB Tables**: `nutritionist_clients`, `nutritionist_plans`, `plan_annotations`, `plan_templates`, `client_target_overrides`, `client_reports`
**API Routes**: `/api/nutritionist/*`, `/api/my-nutritionist-plans`

### Custom Meal Plan Builder (Task #222)
The Meal Planning widget has a "Generator / Custom" segmented toggle. Generator mode shows the existing AI meal plan generation UI. Custom mode allows users to:
- Manually place their saved meals (from My Meals library) into Breakfast/Lunch/Dinner/Snacks slots per day
- Drag and drop meals between slots with a Copy/Move choice popover
- Use Autofill to have the AI fill remaining empty slots while preserving user-placed meals
- Save, export PDF, and generate shopping lists from the custom plan
- Supports both Daily and Weekly plan types with the same date picker and schedule controls

**Server endpoint:** `POST /api/meal-plans/autofill` — accepts partial plan with user-placed meals, fills empty slots using the existing meal generation algorithm.

## Test Account
A seeded test account is created automatically at startup for e2e testing:
- **Email:** `test@fuelr.app`
- **Password:** `TestPass123!`
- **Tier:** `advanced` (all features unlocked)

## External Dependencies
-   **PostgreSQL**: Primary database.
-   **Google Fonts**: For typography.
-   **Radix UI**: Headless UI component primitives.
-   **TanStack React Query**: Server state management.
-   **Framer Motion**: Animations.
-   **Recharts**: Data visualization.
-   **jsPDF**: Client-side PDF generation.
-   **Drizzle ORM + drizzle-zod**: Database ORM and schema validation.
-   **Zod**: Runtime data validation.
-   **React Hook Form**: Form management.
-   **Wouter**: Client-side routing.
-   **express-session + connect-pg-simple**: Session management.
-   **bcryptjs**: Password hashing.
-   **Resend**: Transactional email service.
-   **Vite + @vitejs/plugin-react**: Frontend build tool and dev server.
-   **esbuild**: Backend bundler.