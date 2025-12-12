# System Patterns

## Architecture
The application uses the T3 Stack pattern (Next.js, tRPC, Tailwind, Drizzle).

### Frontend
- **Components**: Built with Shadcn/UI (Radix Primitives + Tailwind).
- **Animation**: `framer-motion` for complex interactions, `tailwindcss-animate` for simple transitions.
- **State Management**: React Query (via tRPC) for server state.

### Backend
- **Database**: PostgreSQL with Drizzle ORM.
- **API**: tRPC for type-safe client-server communication.
- **Authentication**: NextAuth.js.

## Design Patterns
- **Landing Page**: Component-based architecture in `src/components/landing/`.
- **Dashboard**: Layout-based architecture with `app-sidebar` and feature-specific sub-pages.
