# FuelU — Replit.md

## Overview
FuelU is a full-stack nutrition calculator web application that provides personalized dietary management. It generates calorie and macronutrient targets, creates tailored meal plans (Simple, Gourmet, Michelin) based on user preferences and biometrics, and offers features like meal plan save/export (PDF), shopping list generation, and individual meal replacement. The platform also includes a food log with macro tracking, weight tracking with AI insights, hydration tracking, and robust user authentication. FuelU aims to be a holistic solution for personal nutrition, from planning to tracking and analysis, leveraging AI for personalized insights and suggestions. The business vision is to capture a significant market share in personal health and wellness by offering a highly customizable and intelligent nutrition platform.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React (Vite) using Wouter for routing and TanStack React Query for server state management. Form validation is handled by React Hook Form with Zod. UI components leverage shadcn/ui (New York style) based on Radix UI, styled with Tailwind CSS. Animations are powered by Framer Motion, and Recharts is used for data visualization. jsPDF enables client-side PDF generation. Core features include a CalculatorForm, ResultsDisplay for meal plans, SavedMealPlans management, a Dashboard displaying user metrics, WeightTracker with AI insights, PreferencesForm for food and fasting settings, and HydrationTracker. A modular FoodLog and MyMealsFoodWidget provide comprehensive food entry and meal management, including barcode scanning, AI food recognition, and recipe import from various sources (URLs, photos, videos using ffmpeg and GPT-4o vision). Additional premium features include CycleTracker for female users, VitalityTracker for male users with PubMed-sourced AI tips, and Insights offering wellbeing analysis and research summaries.

### Backend
The backend runs on Node.js with TypeScript using Express 5. It integrates Vite in middleware mode for development and uses session-based authentication with `express-session` and a PostgreSQL store. The RESTful API shares Zod schemas with the client via a `shared/` directory. Key functionalities include user authentication (register, login, logout, OAuth), server-side meal plan generation with static meal databases and nutrient density scoring, calorie and macronutrient calculations, and APIs for weight tracking, hydration, food logging, cycle tracking, and AI insights. A structured ingredient system stores parsed ingredient data for user, imported, and community meals. A comprehensive tier system (free/simple/advanced/payg) with Stripe integration manages access to features, credits, and subscriptions. A 21-day stepped trial system provides new non-beta users with tiered access before settling on the Free tier.

### Shared Layer
This layer contains Drizzle ORM schema definitions and Zod schemas for API request/response contracts, ensuring type safety and validation across both frontend and backend.

### Data Storage
PostgreSQL is the primary database, managed with Drizzle ORM. Key tables store user data, calculations, saved meal plans, weight entries, food log entries, unified user meals, password reset tokens, sessions, cycle/vitality symptoms, period logs, AI insights cache, feature gates, credit transactions, tier pricing, and credit packs. Database migrations are handled automatically on server start.

**Canonical Foods Database (Phase 1 — Task #157):** A shared `canonical_foods` table serves as the single source of truth for all food data. Foods enter the database via four sources: `user_manual`, `usda_cached`, `ai_generated`, and `barcode_scan`. The food search waterfall is: canonical DB → USDA API (results auto-cached) → AI estimate (results auto-cached). `user_food_bookmarks` replaces `user_saved_foods` — "My Foods" is now a personal bookmarks layer over the shared canonical DB. Existing `custom_foods` and `user_saved_foods` data has been migrated.

### Authentication
Session-based authentication uses `express-session` and `connect-pg-simple`. Passwords are hashed with `bcryptjs`. OAuth support for Google and Apple is provided via Passport.js, conditionally enabled by environment variables. An optional invite code beta gate can restrict new registrations.

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