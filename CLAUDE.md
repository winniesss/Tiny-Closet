# CLAUDE.md — Tiny Closet

## Project Overview

Tiny Closet is an AI-powered wardrobe management app for parents to inventory, organize, and manage their children's clothing. It uses Google Gemini for image analysis and runs entirely client-side with IndexedDB for persistence.

**Live app:** AI Studio progressive web app
**Version:** 1.8+

## Tech Stack

- **Framework:** React 18.3 with TypeScript 5.5
- **Build:** Vite 5.4 (ES modules)
- **Styling:** Tailwind CSS 3.4 (via CDN in index.html) + PostCSS + Autoprefixer
- **Icons:** Lucide React
- **Database:** Dexie 4.2 (IndexedDB wrapper)
- **AI:** Google Gemini 2.5 Flash (`@google/genai`)
- **Charts:** Recharts 2.12
- **Routing:** React Router DOM 6.23 (HashRouter)
- **Deployment:** Vercel

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build to /dist
npm run preview      # Preview production build
```

There are **no tests, linters, or formatters** configured. TypeScript strict mode is the primary safety net.

## Environment Variables

- `API_KEY` or `GEMINI_API_KEY` — Required for Gemini AI image analysis
- See `.env.example` for template
- Exposed to browser via `vite.config.ts` define

## Directory Structure

```
├── App.tsx                  # Root component with routing & persistent tab layout
├── index.tsx                # React entry point with ErrorBoundary
├── index.html               # HTML template (Tailwind CDN, fonts, import map)
├── types.ts                 # All TypeScript type definitions
├── db.ts                    # Dexie database schema & migrations
├── vite.config.ts           # Vite config with env variable injection
├── components/              # Reusable UI components
│   ├── Navbar.tsx           # Bottom navigation bar
│   ├── Logo.tsx             # Animated logo
│   ├── WeatherWidget.tsx    # Weather display
│   └── ItemDetailModal.tsx  # Clothing item editor modal
├── pages/                   # Route-level page components
│   ├── Dashboard.tsx        # Home — outfit suggestions + weather
│   ├── Closet.tsx           # Wardrobe browser with filters
│   ├── AddItem.tsx          # Multi-step image upload & AI analysis
│   ├── Settings.tsx         # Profile, export/import, FAQ
│   ├── Stats.tsx            # Closet statistics charts
│   └── SignUp.tsx           # Onboarding flow
└── services/                # External API integrations
    ├── geminiService.ts     # Gemini AI image analysis
    └── weatherService.ts    # Open-Meteo weather API
```

## Architecture & Key Patterns

### Persistent Tab Layout
Main pages (Dashboard, Closet, Stats, Settings) stay **mounted but hidden via CSS** rather than being unmounted on route change. This preserves scroll position and avoids re-renders. See `App.tsx` for the implementation.

### Client-Side Database (Dexie/IndexedDB)
All data lives in the browser. No backend server. The database has three tables:
- `items` — Clothing inventory (images stored as Base64)
- `profile` — Child profile (single record)
- `outfitLikes` — Saved outfit combinations

Use `useLiveQuery()` from `dexie-react-hooks` for reactive data fetching. Schema migrations are in `db.ts`.

### AI Image Analysis Pipeline
1. User uploads/captures photo → canvas-based resize & crop
2. Base64-encoded image sent to Gemini with structured JSON schema
3. Response includes bounding boxes for multi-item detection
4. Items cropped from original image, fields auto-populated
5. User reviews and saves to IndexedDB

### Routing
Hash-based routing (`/#/closet`, `/#/stats`, etc.) for offline compatibility. Routes: `/`, `/closet`, `/stats`, `/settings`, `/add`, `/signup`.

## Code Conventions

### Naming
- **Components & Types:** PascalCase (`ClothingItem`, `Dashboard`)
- **Functions & variables:** camelCase (`calculateAge`, `cleanColor`)
- **Constants:** UPPER_CASE (`COLORS`, `MAX_DIM`)

### File Organization
- One component per file
- Types centralized in `types.ts`
- External API logic in `services/`
- All components are functional (hooks-based); only `ErrorBoundary` uses a class

### Styling
- Tailwind utility classes throughout
- Primary color: orange; accent: sky; highlights: pink/purple
- Fonts: DM Serif Display (headings), Nunito (body) — loaded via CDN in index.html
- iOS safe-area insets handled via `env(safe-area-inset-*)`
- Consistent `rounded-[2rem]` for modals and cards

### Commit Messages
Use conventional commit format: `feat:`, `fix:`, `refactor:`, etc. Feature-driven commits with descriptive messages.

## Important Implementation Details

- **No server-side code** — everything runs in the browser
- **Images are Base64** stored directly in IndexedDB (no external storage)
- **API key is exposed client-side** via `process.env.API_KEY` — this is by design for this app
- **Weather uses Open-Meteo** (free, no API key) with browser geolocation
- **Outfit recommendations** use color harmony logic, weather awareness, and age-based size filtering
- Size-to-age mapping uses heuristic parsing (see `Dashboard.tsx` for the `calculateAge` function)
- The Dockerfile and nginx.conf exist but are minimal/empty — Vercel is the primary deployment target
