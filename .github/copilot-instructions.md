# Copilot Instructions for OpenClaw Hub

This repository contains **OpenClaw Hub** — the MoltBot Showcase Dashboard and operational center for the Wallestars infrastructure.

## Project Overview

### Technology Stack
- **Frontend:** React 19 + React Router 7, Tailwind CSS with glassmorphism theme, Framer Motion, Shadcn/ui, Lucide Icons
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** Supabase (PostgreSQL)
- **Platform:** PhantomChat integration

### Repository Structure
```
openclaw-hub/
├── frontend/          # React SPA (CRA + CRACO)
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   └── lib/         # Utilities
│   └── public/
├── phantomchat/       # PhantomChat platform
├── supabase/          # Edge Functions & migrations
└── README.md
```

## Code Style & Conventions

- Use **functional components** with React hooks
- Follow Tailwind CSS utility-first approach with custom glassmorphism classes
- Use `cn()` utility for conditional class merging (clsx + tailwind-merge)
- Prefer Shadcn/ui components for consistency
- Use Framer Motion for all animations — prefer `motion.div` wrappers
- Keep components small and focused; extract reusable logic into custom hooks
- Use Sonner for toast notifications

## Common Patterns

### Component Structure
```jsx
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ComponentName({ className, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("base-classes", className)}
      {...props}
    >
      {/* content */}
    </motion.div>
  );
}
```

### Supabase Edge Functions
- Edge Functions are in `supabase/functions/`
- Written in TypeScript for Deno runtime
- Use `Deno.serve()` pattern with CORS headers
- Always handle errors gracefully and return proper HTTP status codes

## Security Guidelines

- Never commit `.env` files or API keys
- Use Supabase RLS policies for data access control
- Validate all user inputs on both client and server
- Use environment variables for all secrets

## Testing

- Run frontend tests with `npm test` in the `frontend/` directory
- Test Edge Functions locally with `supabase functions serve`
- Verify builds with `npm run build` before pushing

## When Making Changes

1. Create a feature branch from `main`
2. Follow the existing code patterns and naming conventions
3. Test locally before creating a PR
4. Include clear commit messages in conventional format (feat:, fix:, chore:)
