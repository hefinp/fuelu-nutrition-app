# Fuelr — Replit.md

## Overview

Fuelr is a comprehensive full-stack nutrition calculator web application designed to empower users with personalized dietary management. It generates daily/weekly calorie and macronutrient targets based on user biometrics, and creates tailored meal plans (Simple, Gourmet, Michelin) considering food preferences, allergies, and dislikes. Key features include meal plan save/export (PDF), shopping list generation, individual meal replacement, a food log with macro tracking, weight tracking with AI insights, hydration tracking with alerts, and a robust user authentication system with password reset and OAuth options. The platform aims to provide a holistic solution for personal nutrition, from planning to tracking and analysis, incorporating AI for personalized insights and meal suggestions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with **React** (Vite) utilizing **Wouter** for client-side routing. **TanStack React Query** manages server state, and **React Hook Form** with **Zod** handles form validation. UI components are from **shadcn/ui** (New York style) based on **Radix UI**, styled with **Tailwind CSS**. Animations are powered by **Framer Motion**, and charts by **Recharts**. **jsPDF** is used for client-side PDF generation.

Core components include:
-   **CalculatorForm**: Collects user biometrics, pre-fills for logged-in users, and provides calculation results.
-   **ResultsDisplay**: Presents calorie targets, macro breakdowns, and meal plans with options for PDF export and shopping lists. It supports multi-daily and weekly plans, including cycle phase awareness for female users.
-   **SavedMealPlans**: Manages saved meal plans, supporting renaming, deletion, and email functionality.
-   **Dashboard**: The main application page, displaying user metrics, results, and tracking components.
-   **WeightTracker**: Logs weight entries, visualizes data with a LineChart, and offers AI-driven trend analysis.
-   **PreferencesForm**: Manages food preferences, allergies, custom exclusions, preferred foods, and micronutrient optimization.
-   **HydrationTracker**: Monitors daily water intake with progress indicators, quick-add options, and behind-schedule alerts.
-   **FoodLog**: Dashboard widget showing today's macro progress and entries, with a "Log Meal" button and "View full diary" link. Split into modular files:
    -   `food-log-shared.tsx`: Types, constants, helpers, ProgressBar, MacroGrid, LoggedMealModal.
    -   `food-log-drawer.tsx`: 5-tab entry form (manual, search, barcode scan, AI, plan import) as a bottom sheet/modal overlay.
    -   `food-log.tsx`: Slim dashboard widget (~340 lines).
-   **MyMealsFoodWidget**: Dashboard widget for saved meals and custom foods, split into modular files:
    -   `meals-food-shared.tsx`: Shared types (MealSlot, Ingredient, etc.), constants (SLOT_OPTIONS, SLOT_COLOURS), and reusable components (MacroBar, MacroChips).
    -   `community-browser-modal.tsx`: Community meals browser modal with allergen detection. Also used by RecipeLibrary.
    -   `import-modal.tsx`: Recipe import modal (URL or photo).
    -   `edit-meal-modal.tsx`: Edit meal/favourite modal.
    -   `add-food-modal.tsx`: Add custom food modal with barcode scan, AI estimate, and manual entry.
    -   `create-meal-modal.tsx`: Create meal modal with food picker (search, barcode, AI, My Foods tabs).
    -   `my-meals-food-widget.tsx`: Slim dashboard widget (~500 lines) importing all modals.
-   **DiaryPage** (`/diary`): Full food diary with daily/weekly views, date navigation, entry management (confirm/star/delete), weekly AI insights, and the FoodLogDrawer for logging.
-   **CycleTracker**: (For female users) Tracks menstrual cycles, predicts phases, provides cycle-phase-specific nutrition tips (via AI with web search), and logs symptoms and period history.
-   **Insights**: Offers wellbeing insights, including symptom trends, food correlations, AI-powered narrative analysis, and research summaries based on user data and external research (PubMed/NIH).

### Backend
The backend runs on **Node.js** with **TypeScript** using **Express 5**. It integrates Vite in middleware mode for HMR during development. Authentication is session-based using `express-session` with a PostgreSQL store. The API follows a RESTful pattern, with all routes under `/api`, sharing Zod schemas with the client via a `shared/` directory.

**Route architecture** (split into domain modules under `server/routes/`):
-   `server/routes.ts` — Thin entry point: imports all routers, sets up Passport OAuth strategies, mounts routers via `app.use()`.
-   `server/constants.ts` — Shared constants: ALLERGEN_KEYWORDS, FOOD_CATEGORY_KEYWORDS, MEAT/PORK_KEYWORDS, CYCLE_PHASE_KEYWORDS, authRateLimiter.
-   `server/meal-data.ts` — Meal databases (Simple, Gourmet, Michelin), types (MealEntry, MealDb), helper functions (filtering, scaling, scoring, cycle phase computation, plan generation, macro calculation).
-   `server/routes/auth.ts` — Auth (register, login, logout, OAuth callbacks, password reset, invite check).
-   `server/routes/calculations.ts` — Calculation preview/create/list + user preferences get/put.
-   `server/routes/meal-plans.ts` — Meal plan generation, replace-meal, saved plans CRUD, schedule, optimise, email.
-   `server/routes/weight.ts` — Weight entries CRUD.
-   `server/routes/cycle.ts` — Cycle daily-tip, period logs, symptoms CRUD.
-   `server/routes/insights.ts` — All AI insight endpoints: cycle insights, phase-evidence, AI insights, research-pulse, weight insights, food-log weekly insights.
-   `server/routes/hydration.ts` — Hydration CRUD.
-   `server/routes/food-log.ts` — Food log CRUD, food search, barcode lookup, label scan, AI food recognition, daily nudge, custom foods, disliked meals.
-   `server/routes/recipes.ts` — User recipes CRUD, URL import, photo import.
-   `server/routes/favourites.ts` — Favourite meals CRUD.
-   `server/routes/community.ts` — Community meals CRUD + startup gap-fill.
-   `server/routes/admin.ts` — Admin invite codes, beta feedback, community meal balance.

Key backend functionalities include:
-   User authentication (register, login, logout, OAuth).
-   Server-side meal plan generation using static meal databases (Simple, Gourmet, Michelin) with filtering based on user preferences and nutrient density scoring.
-   Calorie and macronutrient calculations based on TDEE/Harris-Benedict formulas.
-   Automatic saving of generated meal plans for logged-in users.
-   API endpoints for weight tracking, hydration, food logging, cycle tracking, and AI insights.

### Shared Layer (`shared/`)
This layer contains Drizzle ORM schema definitions for all database tables and Zod schemas for API request/response contracts, ensuring type safety and validation across both frontend and backend.

### Data Storage
The application uses **PostgreSQL** as its primary database, managed with **Drizzle ORM**.
Key tables include:
-   `users`: Stores user credentials, preferences (JSONB), and OAuth details.
-   `calculations`: Records user biometric calculations and nutritional targets.
-   `saved_meal_plans`: Stores user-saved meal plans.
-   `weight_entries`: Logs user weight over time.
-   `food_log_entries`: Records daily food intake.
-   `password_reset_tokens`: Manages password reset requests.
-   `session`: Stores `express-session` data.
-   `cycle_symptoms`: Logs menstrual cycle symptoms.
-   `cycle_period_logs`: Stores menstrual period start/end dates and computed cycle lengths.
-   `ai_insights_cache`: Caches AI-generated insights to optimize performance.
Database migrations are handled automatically on server start.

### Authentication
Session-based authentication is implemented with `express-session` and a PostgreSQL store. Passwords are hashed with `bcryptjs`. OAuth is supported for Google and Apple via **Passport.js**, conditionally enabled based on environment variables. An optional invite code beta gate can restrict new registrations.

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
-   **Resend**: Transactional email service for password resets and meal plan delivery.
-   **date-fns**: Date utility library.
-   **Vite + @vitejs/plugin-react**: Frontend build tool and dev server.
-   **esbuild**: Backend bundler.