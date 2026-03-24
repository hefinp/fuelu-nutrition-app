# FuelU — Replit.md

## Overview
FuelU is a full-stack nutrition calculator web application designed for personalized dietary management. It generates calorie and macronutrient targets, creates tailored meal plans (Simple, Fancy, Gourmet) based on user preferences and biometrics, and offers features like meal plan saving/exporting, shopping list generation, and individual meal replacement. The platform includes a food log with macro tracking, AI-powered weight and hydration tracking, and robust user authentication. FuelU aims to be a holistic solution for personal nutrition, leveraging AI for personalized insights and suggestions, and capturing a significant market share in personal health and wellness.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React (Vite), utilizing Wouter for routing, TanStack React Query for server state management, and React Hook Form with Zod for form validation. UI components are built with shadcn/ui (New York style) based on Radix UI, styled with Tailwind CSS. Animations are handled by Framer Motion, and Recharts is used for data visualization. jsPDF enables client-side PDF generation. Key features include a CalculatorForm, ResultsDisplay, SavedMealPlans, a Dashboard with user metrics, WeightTracker with AI insights, PreferencesForm, HydrationTracker, and a modular FoodLog with barcode scanning, AI food recognition, and recipe import. Premium features include CycleTracker, VitalityTracker, and an Insights column/tab. The dashboard follows a **Plan → Track → Insights** mental model.

#### My Diary Widget Structure
The My Diary widget (`my-diary-widget.tsx`) is composed of focused sub-components in `client/src/components/diary/`:
- `diary-food-section.tsx` — Meal slot accordion with drag-and-drop (DraggableEntry, DroppableSlot), edit/delete, move/copy dialog
- `diary-water-section.tsx` — Water logging popup with quick amounts and custom input
- `diary-weight-section.tsx` — Weight logging popup
- `diary-strava-section.tsx` — Strava activity display with loading/error states
The main widget handles date navigation, queries, macro summary, and composes these sections.

### Backend
The backend uses Node.js with TypeScript and Express 5, integrating Vite in middleware mode for development. It employs session-based authentication with `express-session` and a PostgreSQL store. The RESTful API shares Zod schemas with the client via a `shared/` directory. Core functionalities include user authentication (register, login, OAuth), server-side meal plan generation with static meal databases and nutrient density scoring, calorie and macronutrient calculations, and APIs for tracking. A structured ingredient system stores parsed ingredient data. A comprehensive tier system (free/simple/advanced/payg) with Stripe integration manages feature access and subscriptions, including a 21-day stepped trial.

### Shared Layer
This layer defines Drizzle ORM schema definitions and Zod schemas for API request/response contracts, ensuring type safety and validation across both frontend and backend.

### Data Storage
PostgreSQL is the primary database, managed with Drizzle ORM. It stores user data, calculations, saved meal plans, tracking entries, authentication tokens, and system configurations. A `canonical_foods` table acts as the single source of truth for all food data, sourced from manual user input, USDA, AI generation, and barcode scans, prioritizing trusted sources. Specialized food data for NZ Restaurants and Hello Fresh recipes are also stored.

### Nutritionist Platform
A dedicated portal at `/nutritionist/portal` allows nutritionists and dietitians to manage clients. Features include client management, AI plan generation with a prompt-to-plan workflow, plan verification and delivery, plan scheduling, template libraries, and meal annotations. Nutritionists can override client macro targets and generate customizable progress reports. Client satisfaction surveys can be created and sent manually or automatically.

### Custom Meal Plan Builder
The Meal Planning widget opens directly into the custom planner (no generator/custom toggle). Users can manually place saved meals, drag and drop meals, use AI autofill for remaining slots, random-replace individual meals via a RefreshCw button, and save/export custom plans. Per-tier monthly generation limits are enforced on the autofill endpoint (Free: 1 weekly/3 daily, Simple: 2 weekly/6 daily, Advanced: unlimited), tracked in the `meal_plan_generations` table with atomic upsert counting. Remaining generation counts are displayed above the autofill button with upgrade prompts when limits are reached.

### Strava Integration
Users can connect their Strava account via OAuth to import fitness activity data into the dashboard. Activity data is stored locally in `strava_activities` and synced via webhooks. This data is used in the activity widget, food diary, and for adaptive TDEE calculations.

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
-   **Resend**: Transactional email service (non-transactional emails include unsubscribe links via signed tokens).
-   **Vite + @vitejs/plugin-react**: Frontend build tool and dev server.
-   **esbuild**: Backend bundler.