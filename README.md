# PulsePoint — Student Teammate Discovery & Project Collaboration Platform

PulsePoint is a student-focused teammate discovery and project collaboration platform designed to help builders discover complementary peers, form agile squads, explore hackathons, and turn project ideas into shipped software.

This repository contains the PulsePoint landing experience, Firebase Authentication, Supabase PostgreSQL profile database, and Supabase Storage profile picture uploads.

---

## Technology Stack

- **Frontend & Routing:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4.
- **Authentication & User Identity:** Firebase Authentication (Google & GitHub OAuth). The Firebase UID serves as the immutable user identity.
- **Database:** Supabase PostgreSQL (`public.profiles` table with JSONB document schema and timestamps).
- **File & Media Storage:** Supabase Storage (`profile-photos` public bucket).
- **Backend APIs:** Next.js Route Handlers (`/api/profile`, `/api/profile/avatar`) with server-side Firebase ID token verification via `firebase-admin`.

---

## Environment Configuration

Configure `.env.local` based on `.env.example`:

```bash
# Firebase Client (Authentication)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pulsepoint-xxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pulsepoint-xxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pulsepoint-xxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Server-only Firebase Admin (Token verification in Route Handlers)
FIREBASE_ADMIN_PROJECT_ID=pulsepoint-xxxx
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@pulsepoint-xxxx.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Server-only Supabase Credentials (PostgreSQL & Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

# Optional OAuth Client ID
NEXT_PUBLIC_FIREBASE_GITHUB_CLIENT_ID=your_github_client_id
```

> **Security Note:** Service role keys and private keys are never imported into browser components. All database queries and avatar uploads execute through authenticated Next.js API routes that verify the caller's Firebase ID token.

---

## Supabase Database & Storage Setup

1. **Profiles Table:** Apply the migration in [`supabase/migrations/20261102000000_create_profiles.sql`](./supabase/migrations/20261102000000_create_profiles.sql).
2. **Storage Bucket:** Create a public bucket named `profile-photos` with a 5 MB file size limit and allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).

---

## Implemented Features

### 1. Landing Experience
- Looping space background with responsive static fallback (`space-background.tsx`).
- Branded preloader with session caching (`intro-loader.tsx`).
- Liquid glass navbar with mobile drawer navigation (`site-header.tsx`).
- Interactive product preview, 6 platform feature cards, and AI workflow demo.
- WCAG AA compliant contrast, reduced motion support, and skip-to-content accessibility.

### 2. Authentication
- `/sign-in` and `/sign-up` with split-screen branding card.
- One-click **Continue with Google** and **Continue with GitHub** via Firebase popup and redirect fallbacks.
- Intelligent post-auth routing: users without a profile are automatically routed to `/profile/setup`; users with existing profiles proceed to `/profile`.

### 3. Student Profiles
- Routes: `/profile/setup` (first-time onboarding), `/profile` (profile viewer), `/profile/edit` (editor).
- 6-section structured form:
  - Photo picker with local preview and Supabase Storage upload.
  - Basic details (Full Name, Headline, University, Degree, Branch, Year, City).
  - Categorized skills with self-assessed familiarity levels.
  - Preferred team roles (multi-select + custom roles).
  - Interests & project goals.
  - Weekly availability & collaboration styles.
  - Portfolio, GitHub, and LinkedIn links.
- Real-time profile completion percentage indicator.
- Live companion preview card.
- Draft saving support (`Save draft` preserves progress before publishing).

## Getting Started

### Prerequisites

- **Node.js**: v20 or v24 (tested on Node v24.21.0)
- **npm**: v10+ (tested on npm 11.19.0)

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Static Verification

```bash
npm run build
npm run start
```

### Linting & Code Quality

```bash
npm run lint
```

---

## Project Structure

```
PulsePoint/
├── public/
│   ├── ASSETS.md               # Asset sources and licensing pre-publication notice
│   ├── images/
│   │   └── hero-poster.png     # Static fallback poster for hero planet
│   └── videos/
│       └── hero-space.mp4      # Looping decorative space video
├── src/
│   ├── app/
│   │   ├── globals.css         # Centralized design tokens, glassmorphism & buttons
│   │   ├── layout.tsx          # Root layout, meta tags, and body styling
│   │   ├── page.tsx            # Main landing page assembling all sections
│   │   ├── hackathons/page.tsx # Honest hackathons placeholder route
│   │   ├── sign-in/page.tsx    # Honest sign-in placeholder route
│   │   └── sign-up/page.tsx    # Honest sign-up placeholder route
│   └── components/
│       ├── landing/
│       │   ├── ai-preview.tsx       # AI assistance preview & interactive workflow
│       │   ├── features.tsx         # 6-card feature grid with development badge
│       │   ├── final-cta.tsx        # Pre-footer conversion section
│       │   ├── hero.tsx             # Main hero headline, CTAs, and value tags
│       │   ├── how-it-works.tsx     # 3-step guide with claymorphic detail
│       │   ├── intro-loader.tsx     # Session-aware branded preloader
│       │   ├── product-preview.tsx  # Glass-framed interactive workspace preview
│       │   ├── site-footer.tsx      # Footer with accessible draft policy modals
│       │   ├── site-header.tsx      # Floating frosted navbar & mobile drawer
│       │   └── space-background.tsx # Resilient video/poster space canvas
│       └── ui/
│           └── icons.tsx            # Bespoke SVG icons and PulsePoint signature mark
├── AGENTS.md                   # Environment rules
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and project scripts
├── tsconfig.json               # TypeScript path aliases (@/*) and settings
└── PulsePoint_Joint_Project_Roadmap.pdf # Project roadmap specification
```

---

## Asset Attribution & Pre-Publication Verification

- **Hero Video**: `public/videos/hero-space.mp4`
  - Source: `https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4b73c700-3112-4c07-bd48-0af2893dff7c.mp4`
- **Hero Poster**: `public/images/hero-poster.png`
  - Source: `https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/0bf7409c-9fa2-4bef-a49d-34903dcc91ad.png`

> **Notice**: These assets were supplied as reference media for prototype development. Asset-rights verification and licensing certification must be formally completed before deploying to public production environments.

---

## How to Customize

### 1. Changing Design Colors
All color tokens and glassmorphism properties are declared in [`src/app/globals.css`](file:///c:/Users/tiwar/Desktop/PROJECTS/PulsePoint/src/app/globals.css):
- Brand crimson accent: Edit `--crimson: #e11d48;` and `--crimson-hover: #f43f5e;`.
- Glow intensities: Edit `.btn-primary-glow` and `.btn-ai-glow`.
- Glass transparency: Adjust background opacity values in `.glass-panel` and `.glass-nav`.

### 2. Customizing Copy & Content
- **Hero headline & copy**: Edit [`src/components/landing/hero.tsx`](file:///c:/Users/tiwar/Desktop/PROJECTS/PulsePoint/src/components/landing/hero.tsx).
- **Workspace demo team and open roles**: Edit [`src/components/landing/product-preview.tsx`](file:///c:/Users/tiwar/Desktop/PROJECTS/PulsePoint/src/components/landing/product-preview.tsx).
- **Features & development labels**: Edit [`src/components/landing/features.tsx`](file:///c:/Users/tiwar/Desktop/PROJECTS/PulsePoint/src/components/landing/features.tsx).
- **AI capabilities & workflow steps**: Edit [`src/components/landing/ai-preview.tsx`](file:///c:/Users/tiwar/Desktop/PROJECTS/PulsePoint/src/components/landing/ai-preview.tsx).

### 3. Adjusting Intro Preloader Timing
Open [`src/components/landing/intro-loader.tsx`](file:///c:/Users/tiwar/Desktop/PROJECTS/PulsePoint/src/components/landing/intro-loader.tsx):
- `fadeTimer`: Currently set to `1100ms` (~1.1s). Adjust for shorter or longer display.
- `finishTimer`: Currently set to `1600ms` (~1.6s) to ensure the preloader is always removed before 1.8s.
- Clear tab session cache for testing: Run `sessionStorage.removeItem("pulsepoint_intro_seen_v1")` in browser DevTools.

---

## Roadmap Scope & Limitations

This milestone focuses strictly on the public presentation, accessibility, visual design, and navigation foundation:
- Backend databases (PostgreSQL/Supabase) are **not** connected yet.
- User accounts and authentication endpoints are **not** live.
- AI suggestions shown in the preview are curated demonstration content; actual model inference pipelines belong to Milestone 2.
- No third-party tracking, cookies, or monetization features are included.
