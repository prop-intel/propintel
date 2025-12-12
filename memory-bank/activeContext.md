# Active Context

## Current Focus
Developing the public-facing landing page to communicate the value proposition of PropIntel.

## Recent Changes
- Created `src/components/landing/navbar.tsx`: Sticky navigation.
- Created `src/components/landing/hero.tsx`: High-impact hero section with animated dashboard visualization.
- Created `src/components/landing/features.tsx`: Grid of core features.
- Created `src/components/landing/cta.tsx`: Call to action section.
- Created `src/components/landing/footer.tsx`: Site footer.
- Updated `src/app/page.tsx`: Assembled the landing page components.

## Next Steps
- Implement the actual dashboard functionality (Phase 5).
- Connect the "Get Started" flow to authentication.
- Refine mobile responsiveness if needed.

## Active Decisions
- Used `framer-motion` (v12 `motion/react`) for entrance animations to give a premium feel.
- Leveraged existing Shadcn/UI theme variables for consistency with the app.
- Kept the landing page in `src/app/page.tsx` as the main entry point.
