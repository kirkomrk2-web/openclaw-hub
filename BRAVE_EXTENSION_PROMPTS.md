# Brave Browser + Claude Extension Prompts for OpenClaw Hub

Detailed, copy-paste-ready prompts for developing and extending OpenClaw Hub using the Claude extension in Brave browser. Each prompt is self-contained with full context so Claude can execute immediately.

---

## Table of Contents

1. [Backend Integration](#1-backend-integration)
2. [Authentication & Security](#2-authentication--security)
3. [Real-Time Features](#3-real-time-features)
4. [Testing Infrastructure](#4-testing-infrastructure)
5. [Performance & Optimization](#5-performance--optimization)
6. [New Pages & Features](#6-new-pages--features)
7. [UI/UX Improvements](#7-uiux-improvements)
8. [DevOps & Deployment](#8-devops--deployment)
9. [Data Layer & State Management](#9-data-layer--state-management)
10. [Accessibility & i18n](#10-accessibility--i18n)

---

## 1. Backend Integration

### Prompt 1.1 — Connect Dashboard to Live n8n API

```
I have a React 19 dashboard (OpenClaw Hub) at frontend/src/pages/DashboardPage.jsx that currently uses hardcoded mock data for stats (agents, n8n workflows, Supabase tables, Airtop sessions) and a static activity feed.

The backend URL is in .env as REACT_APP_BACKEND_URL.

Replace the mock data with real API calls:
1. Create a new file frontend/src/services/api.js using axios (already installed) with a base instance configured from REACT_APP_BACKEND_URL
2. Add these endpoints:
   - GET /api/stats → returns { agents: number, workflows: { active, total }, tables: number, sessions: number }
   - GET /api/activity?limit=20 → returns array of { id, type, message, timestamp, severity }
3. In DashboardPage.jsx, use React useEffect + useState to fetch on mount
4. Add loading skeletons using the existing glassmorphism card style (bg-white/5 backdrop-blur-xl)
5. Add error states with a retry button
6. Keep the existing Framer Motion animations for when data arrives

Use async/await pattern. Handle network errors gracefully with toast notifications via sonner (already configured in App.js).
```

### Prompt 1.2 — Wire Up Playground API Tester to Real HTTP Requests

```
In frontend/src/pages/PlaygroundPage.jsx, the API Tester tab currently returns mock responses after a 1000ms setTimeout.

Make it functional:
1. Replace the mock sendRequest function with real axios calls
2. The user enters a URL, selects HTTP method (GET/POST/PUT/PATCH/DELETE), and optionally provides a JSON body
3. Capture and display: status code, response headers, response body (pretty-printed JSON), and request duration in milliseconds
4. Add a CORS proxy toggle — when enabled, prepend "https://corsproxy.io/?" to the URL
5. Add request history (last 10 requests) saved to localStorage, with a button to replay any previous request
6. Keep the existing UI styling (glassmorphism cards, monospace font for response body, Tailwind classes)
7. Show proper error states for network failures, timeouts (add a 30s timeout), and invalid JSON bodies

The component already uses tabs via Radix UI. Only modify the API Tester tab section.
```

### Prompt 1.3 — Supabase Integration for SQL Console

```
The Playground page (frontend/src/pages/PlaygroundPage.jsx) has a SQL Console tab that currently runs mock queries.

Connect it to a real Supabase instance:
1. Install @supabase/supabase-js if not already present
2. Create frontend/src/services/supabase.js with client initialization using env vars REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
3. Replace the mock executeQuery function with supabase.rpc() for read-only queries
4. Display results in the existing table format with proper column headers from the response
5. Add query execution time measurement
6. Add a schema explorer sidebar that lists all tables and their columns using supabase.from('information_schema.columns')
7. Add syntax highlighting for SQL keywords (SELECT, FROM, WHERE, JOIN, etc.) using regex-based coloring — no external library needed, just span elements with Tailwind text colors
8. Save query history to localStorage (last 20 queries)
9. Keep all existing glassmorphism styling and Framer Motion animations
```

---

## 2. Authentication & Security

### Prompt 2.1 — Add Supabase Auth with Protected Routes

```
OpenClaw Hub (React 19 + React Router 7 with HashRouter) needs authentication.

Current structure:
- App.js has HashRouter with routes: /, /calendar, /resources, /watchtower, /playground
- CommandNavbar.jsx is the top navigation bar
- All pages are in frontend/src/pages/

Implement Supabase Auth:
1. Create frontend/src/contexts/AuthContext.jsx with React Context providing:
   - user object, session, loading state
   - signIn(email, password), signUp(email, password), signOut(), signInWithOAuth(provider)
   - Auto-refresh session on mount using supabase.auth.onAuthStateChange
2. Create frontend/src/pages/LoginPage.jsx with:
   - Email/password form using react-hook-form (already installed) + zod validation
   - OAuth buttons for GitHub and Google
   - Glassmorphism card centered on screen matching the existing design system
   - Framer Motion fade-in animation
3. Create a ProtectedRoute wrapper component that redirects to /login if not authenticated
4. Wrap all existing routes in ProtectedRoute in App.js
5. Add user avatar and sign-out button to CommandNavbar.jsx
6. Show loading spinner during auth state resolution

Use the existing Tailwind theme variables (--glass-bg, --glass-blur, etc.) and shadcn/ui button/input components.
```

### Prompt 2.2 — Role-Based Access Control

```
Extend the existing AuthContext (frontend/src/contexts/AuthContext.jsx) with role-based access:

1. Define 3 roles in a new file frontend/src/lib/roles.js:
   - admin: full access to all pages
   - operator: access to Dashboard, Calendar, Resources, Watchtower (no Playground)
   - viewer: read-only access to Dashboard and Calendar only

2. Create a usePermissions() hook that returns:
   - role: string
   - canAccess(page: string): boolean
   - canEdit: boolean
   - canExecute: boolean (for Playground actions)

3. Fetch user role from Supabase profiles table (user_id, role, display_name)

4. Update the ProtectedRoute component to accept a requiredRole prop and show a 403 "Access Denied" glassmorphism card with the user's current role if unauthorized

5. In CommandNavbar.jsx, conditionally render navigation links based on role — grey out and disable links the user cannot access

6. In ResourcesPage.jsx, hide the "Test Connection" and credential reveal buttons for viewers

Keep all existing styling patterns. Use the Badge component from shadcn/ui to show the user's role in the navbar.
```

---

## 3. Real-Time Features

### Prompt 3.1 — WebSocket Activity Feed

```
The Dashboard page (frontend/src/pages/DashboardPage.jsx) has a static activity feed with hardcoded events.

Add real-time updates:
1. Create frontend/src/hooks/useWebSocket.js — a custom hook that:
   - Connects to ws://REACT_APP_BACKEND_URL/ws/activity (convert http to ws protocol)
   - Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - Returns { messages, connectionStatus, sendMessage }
   - Handles heartbeat/ping-pong to detect stale connections

2. Create frontend/src/hooks/useActivityFeed.js that:
   - Uses useWebSocket for live events
   - Maintains a rolling buffer of last 50 events
   - Merges initial HTTP fetch with WebSocket stream
   - Deduplicates by event ID

3. Update DashboardPage.jsx:
   - Replace static activityFeed array with useActivityFeed()
   - Add a connection status indicator (green dot = connected, yellow = reconnecting, red = disconnected) next to the "Activity Feed" heading
   - Animate new events sliding in from the top using Framer Motion's AnimatePresence and layout animations
   - Add a subtle pulse animation on the newest event for 2 seconds after it arrives
   - Add a "Live" badge that blinks when connected

Keep the existing event format: { id, type, message, time, severity } with severity colors (success=green, info=blue, warning=orange, error=red).
```

### Prompt 3.2 — Live Airtop Session Monitoring

```
The Watchtower page (frontend/src/pages/WatchtowerPage.jsx) has mock Airtop browser sessions.

Make the Live View functional:
1. When a session is selected, connect to a WebSocket at ws://REACT_APP_BACKEND_URL/ws/airtop/{sessionId}
2. Display incoming log messages in real-time in the session log panel, auto-scrolling to bottom
3. Add session status transitions with animated state badges:
   - initializing (yellow pulse) → running (green) → completed (blue) → failed (red)
4. Add a screenshot preview area that updates every 5 seconds via polling:
   GET /api/airtop/{sessionId}/screenshot → returns base64 image
5. Add session controls: Pause, Resume, Stop, Extend (add 5 min)
6. Show real-time metrics: duration, pages visited, actions performed, credits consumed
7. Use Framer Motion for smooth transitions between session states

Keep the existing glassmorphism card layout and Lucide icons. Use sonner toasts for session status change notifications.
```

---

## 4. Testing Infrastructure

### Prompt 4.1 — Set Up Testing Framework

```
OpenClaw Hub (frontend/) uses craco with React Scripts 5. There are currently no tests.

Set up a complete testing infrastructure:
1. Install and configure: @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, msw (Mock Service Worker for API mocking)

2. Create frontend/src/setupTests.js with jest-dom extensions and MSW server setup

3. Create frontend/src/mocks/handlers.js with MSW handlers for:
   - GET /api/stats
   - GET /api/activity
   - All endpoints used by the app

4. Write tests for each page component:
   - frontend/src/__tests__/DashboardPage.test.jsx — renders stats cards, displays activity feed, quick actions are clickable
   - frontend/src/__tests__/CalendarPage.test.jsx — renders calendar grid, can add events, persists to localStorage
   - frontend/src/__tests__/ResourcesPage.test.jsx — tabs switch correctly, skills are searchable, credential tree expands
   - frontend/src/__tests__/PlaygroundPage.test.jsx — terminal accepts input, API tester sends requests, SQL console executes queries
   - frontend/src/__tests__/WatchtowerPage.test.jsx — sessions list renders, can create new session, live view shows logs

5. Write unit tests for utility functions in frontend/src/lib/utils.js

6. Add a test script to package.json: "test:ci": "craco test --watchAll=false --coverage"

Use React Testing Library best practices: query by role/text, not test IDs. Each test file should have at least 3 test cases.
```

### Prompt 4.2 — E2E Tests with Playwright

```
Set up Playwright end-to-end tests for OpenClaw Hub:

1. Install @playwright/test and configure playwright.config.js at the project root:
   - Base URL: http://localhost:3000
   - Browsers: chromium only for speed
   - Screenshots on failure
   - HTML reporter

2. Create e2e/ directory with these test files:

   e2e/navigation.spec.js:
   - Test all navbar links navigate to correct pages
   - Test mobile hamburger menu opens and closes
   - Test active link highlighting
   - Test scroll-to-top on navigation

   e2e/dashboard.spec.js:
   - Test all 4 stat cards render with numbers
   - Test activity feed shows events
   - Test quick action buttons are interactive
   - Test mesh network visualization renders

   e2e/calendar.spec.js:
   - Test month/week/day view switching
   - Test adding a new event via the modal
   - Test event persists after page reload (localStorage)
   - Test navigating between months

   e2e/playground.spec.js:
   - Test terminal accepts commands and shows output
   - Test API tester sends a request and shows response
   - Test tab switching between Terminal, API Tester, SQL Console

3. Add scripts to package.json:
   "test:e2e": "playwright test"
   "test:e2e:ui": "playwright test --ui"

4. Create a CI-ready script that starts the dev server and runs tests.
```

---

## 5. Performance & Optimization

### Prompt 5.1 — Code Splitting & Lazy Loading

```
OpenClaw Hub loads all 5 page components eagerly in App.js. Optimize with code splitting:

1. In frontend/src/App.js:
   - Convert all page imports to React.lazy() with dynamic imports
   - Wrap Routes in React.Suspense with a loading fallback
   - Create a LoadingFallback component with:
     - The OpenClaw Hub logo (🦞) centered
     - A shimmer animation using the existing CSS keyframe
     - Glassmorphism background matching the app theme
     - "Зареждане..." text with typing animation

2. In each page component, identify heavy sub-components that can be lazy loaded:
   - DashboardPage: lazy load the Tailscale mesh network visualization (it uses canvas/SVG)
   - PlaygroundPage: lazy load each tab panel (Terminal, API Tester, SQL Console)
   - CalendarPage: lazy load the event creation modal

3. Create a frontend/src/components/ui/LazyLoad.jsx wrapper that:
   - Accepts a fallback prop (defaults to shimmer skeleton)
   - Shows skeleton with matching dimensions to prevent layout shift
   - Uses Framer Motion for fade-in when the component loads

4. Add React.memo() to expensive pure components:
   - GlassCard (renders frequently as a wrapper)
   - Activity feed items (re-render on new items)
   - Stat cards (only update on data change)

Keep all existing functionality working. No visual changes except smoother loading states.
```

### Prompt 5.2 — Bundle Size Optimization

```
Analyze and optimize the frontend bundle of OpenClaw Hub:

1. Add webpack-bundle-analyzer to devDependencies and configure in craco.config.js:
   - Add "analyze" script to package.json: "analyze": "REACT_APP_ANALYZE=true craco build"
   - Conditionally add BundleAnalyzerPlugin when REACT_APP_ANALYZE is set

2. Optimize large dependencies:
   - recharts: import only used chart types (AreaChart, BarChart) instead of the full library
   - lucide-react: verify tree-shaking is working (each icon should be individual import)
   - framer-motion: use the lazy motion variant where full features aren't needed
   - date-fns: ensure only used functions are imported (not the entire library)

3. Optimize Tailwind CSS output:
   - Review tailwind.config.js content paths to ensure only used classes are included
   - Check for any unused custom CSS in index.css that can be removed
   - Ensure purging is working correctly for production builds

4. Add these optimizations to craco.config.js:
   - Enable gzip compression for production
   - Configure image optimization
   - Set up proper caching headers for static assets

5. Create a performance budget in a comment at the top of craco.config.js:
   - Main JS bundle: < 200KB gzipped
   - CSS: < 30KB gzipped
   - Largest Contentful Paint: < 2s

Report the before/after bundle sizes.
```

---

## 6. New Pages & Features

### Prompt 6.1 — Settings Page

```
Add a Settings page to OpenClaw Hub:

1. Create frontend/src/pages/SettingsPage.jsx with these sections in tabs (use existing shadcn Tabs component):

   General Tab:
   - App name display (OpenClaw Hub)
   - Language selector (Bulgarian / English) — store in localStorage
   - Dashboard refresh interval (15s, 30s, 60s, 5min) — store in localStorage
   - Default landing page selector (dropdown of all 5 pages)

   Appearance Tab:
   - Theme toggle: Dark (default) / Light / System
   - Accent color picker: 6 preset colors (blue, purple, cyan, green, orange, pink) that update CSS --primary variable
   - Glass effect intensity slider (0-100%) that adjusts --glass-blur
   - Animation toggle: Enable/Disable all Framer Motion animations
   - Font size: Small / Medium / Large

   Connections Tab:
   - Backend URL input (pre-filled from .env)
   - Supabase URL + anon key inputs
   - n8n URL input
   - "Test Connection" button for each service with status indicator
   - Save to localStorage

   About Tab:
   - Version number
   - Build date
   - Links: GitHub repo, documentation
   - Credits and tech stack list
   - "Молти 🦞" mascot with a short description

2. Add Settings link (Lucide Settings icon) to CommandNavbar.jsx
3. Add route /settings in App.js
4. Use react-hook-form + zod for all form validation
5. Apply glassmorphism card styling to each section
6. Add Framer Motion page transition animation matching other pages
7. Create a useSettings() hook in frontend/src/hooks/useSettings.js that reads from localStorage and provides reactive updates across the app
```

### Prompt 6.2 — Logs & Monitoring Page

```
Create a comprehensive Logs page for OpenClaw Hub:

1. Create frontend/src/pages/LogsPage.jsx with:

   Log Viewer:
   - Virtual scrolling list displaying log entries (for performance with 1000+ entries)
   - Each log entry shows: timestamp, severity (debug/info/warn/error/critical), source service, message
   - Color-coded severity: debug=gray, info=blue, warn=yellow, error=red, critical=red+pulse
   - Monospace font (JetBrains Mono, already configured in Tailwind)
   - Auto-scroll to bottom with a "Jump to latest" button when scrolled up

   Filters Bar (sticky top):
   - Severity multi-select checkboxes
   - Source service dropdown: All, MoltBot, n8n, Supabase, Airtop, Tailscale, System
   - Date range picker (today, last 24h, last 7d, custom)
   - Full-text search input with debounced filtering (300ms)
   - "Clear filters" button

   Statistics Panel (collapsible right sidebar):
   - Log volume chart (last 24h, grouped by hour) using Recharts AreaChart
   - Severity distribution pie chart
   - Top error messages (grouped and counted)
   - Alerts: highlight if error rate exceeds threshold

2. Add route /logs in App.js
3. Add "Logs" link with Lucide ScrollText icon to CommandNavbar.jsx
4. Initially populate with 200 mock log entries spanning the last 24 hours
5. Support exporting filtered logs as JSON or CSV
6. Use react-resizable-panels for the log viewer / stats panel split
7. All glassmorphism styling, Framer Motion transitions
```

### Prompt 6.3 — Command Palette (Cmd+K)

```
Add a global command palette to OpenClaw Hub, triggered by Cmd+K (Mac) / Ctrl+K (Windows):

The project already has cmdk (v1.1) installed.

1. Create frontend/src/components/CommandPalette.jsx using cmdk:

   Structure:
   - Full-screen overlay with backdrop blur
   - Centered dialog (max-w-lg) with glassmorphism styling
   - Search input at top with autofocus
   - Grouped results below

   Command Groups:
   - Navigation: Go to Dashboard, Calendar, Resources, Watchtower, Playground, Settings, Logs
     (with matching Lucide icons and keyboard shortcut hints)
   - Actions: Create Event, New Airtop Session, Run Workflow, Open Terminal, Test API
   - Quick Settings: Toggle Theme, Toggle Animations
   - Recent: Last 5 visited pages (stored in localStorage)

   Behavior:
   - Fuzzy search across all commands
   - Keyboard navigation (up/down arrows, Enter to select, Escape to close)
   - Navigate to page on selection using react-router useNavigate
   - Close on backdrop click or Escape
   - Show "No results" state with suggestion text

2. Add CommandPalette to App.js (rendered once, globally)
3. Add global keydown listener for Cmd/Ctrl+K in a useEffect
4. Add a search icon button in CommandNavbar.jsx that also opens the palette
5. Animate open/close with Framer Motion (scale from 0.95 + opacity)

Style with existing Tailwind theme: bg-background/80, backdrop-blur-xl, border-white/10, ring-primary/50.
```

---

## 7. UI/UX Improvements

### Prompt 7.1 — Responsive Design Audit & Fixes

```
Audit and fix responsive design across all OpenClaw Hub pages. The app uses Tailwind CSS.

Check and fix each page at these breakpoints: 320px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop):

1. DashboardPage.jsx:
   - Stats grid: 1 col on mobile, 2 on tablet, 4 on desktop
   - Activity feed and Quick Actions: stack vertically on mobile, side-by-side on desktop
   - Mesh network visualization: hide on mobile, show simplified version on tablet
   - Ensure all text is readable without horizontal scrolling

2. CalendarPage.jsx:
   - Calendar grid cells: smaller on mobile with abbreviated day names (П, В, С...)
   - Event indicators: dots only on mobile, full text on desktop
   - Event creation modal: full-screen on mobile, centered dialog on desktop
   - Week/Day views: horizontal scroll on mobile if needed

3. ResourcesPage.jsx:
   - Skills grid: 1 col mobile, 2 tablet, 3 desktop
   - Credential tree: full-width on mobile with larger touch targets
   - MCP servers: card layout on mobile instead of grid
   - Tab navigation: scrollable horizontal on mobile

4. WatchtowerPage.jsx:
   - Session list and live view: tabbed on mobile (don't show side-by-side)
   - Session log: full-width on mobile
   - Controls: wrap to multiple rows on mobile

5. PlaygroundPage.jsx:
   - Terminal: full-width, minimum height 300px on mobile
   - API Tester: stack URL/method vertically on mobile
   - Tabs: horizontal scroll if needed on mobile

6. CommandNavbar.jsx:
   - Verify hamburger menu works correctly on all mobile sizes
   - Ensure logo + status indicator don't overflow

Test each fix and make sure existing desktop layout is not broken.
```

### Prompt 7.2 — Micro-Interactions & Polish

```
Add micro-interactions and polish to OpenClaw Hub to elevate the UX:

1. Button interactions (apply to all shadcn/ui buttons):
   - Subtle scale down (0.97) on mousedown, back to 1 on mouseup
   - Ripple effect on click using CSS pseudo-element animation
   - Haptic-like feedback: 1px translate on click

2. Card hover effects (GlassCard component):
   - Tilt effect on hover: subtle 3D perspective transform following cursor position
   - Gradient border that follows cursor position (conic gradient)
   - Smooth shadow elevation transition

3. Page transitions:
   - Add Framer Motion AnimatePresence to App.js route transitions
   - Pages slide in from the right and fade in (x: 20, opacity: 0 → x: 0, opacity: 1)
   - Exit animation: fade out to the left
   - Duration: 200ms with ease-out

4. Loading states:
   - Skeleton screens for all data-dependent content using shimmer animation
   - Skeleton should match the exact layout of the loaded content

5. Number animations:
   - Dashboard stat numbers should count up from 0 to final value on mount
   - Use requestAnimationFrame for smooth 60fps counting
   - Duration: 800ms with ease-out curve

6. Navbar:
   - Active link has an animated underline that slides to the active item
   - Logo 🦞 has a subtle bounce on hover
   - Status dot has a smooth pulse (not harsh blink)

Use only Framer Motion and CSS animations. No additional animation libraries.
```

### Prompt 7.3 — Dark/Light Theme System

```
OpenClaw Hub currently has a dark theme only. Add full dark/light theme support:

The project already has next-themes (v0.4) installed but not configured.

1. Configure ThemeProvider:
   - Wrap App in ThemeProvider from next-themes in frontend/src/index.js
   - Set attribute="class", defaultTheme="dark", storageKey="openclaw-theme"

2. Update frontend/tailwind.config.js:
   - Add darkMode: "class"
   - Define light theme color values for all CSS custom properties

3. Create light theme values in frontend/src/index.css:
   - :root (light) and .dark selectors
   - Light glassmorphism: bg-white/70 instead of bg-white/5, darker text, lighter borders
   - Adjust shadows for light mode (softer, more diffused)
   - Keep gradient accents vibrant in both themes

4. Update all page components with dark: prefix where needed:
   - Text colors: text-gray-900 dark:text-white
   - Backgrounds: bg-gray-50 dark:bg-background
   - Borders: border-gray-200 dark:border-white/10
   - Cards: bg-white/80 dark:bg-white/5

5. Add theme toggle to CommandNavbar.jsx:
   - Sun/Moon icon button using Lucide
   - Smooth icon rotation animation on toggle (180deg)
   - System preference detection

6. Update GlassCard.jsx for dual-theme support:
   - Light: frosted white glass with subtle shadow
   - Dark: existing dark glass with glow

Ensure all 5 existing pages look polished in both themes. No broken contrast or unreadable text.
```

---

## 8. DevOps & Deployment

### Prompt 8.1 — Docker Setup

```
Create a complete Docker setup for OpenClaw Hub:

1. Create frontend/Dockerfile:
   - Multi-stage build
   - Stage 1 (build): node:20-alpine, yarn install, yarn build
   - Stage 2 (serve): nginx:alpine, copy build output to /usr/share/nginx/html
   - Copy custom nginx.conf for SPA routing (all routes → index.html)
   - Expose port 80
   - Health check endpoint

2. Create frontend/nginx.conf:
   - Gzip compression for JS, CSS, HTML, JSON, SVG
   - Cache static assets (js, css, images) for 1 year with immutable
   - Cache HTML for 1 hour (no-cache for index.html)
   - SPA fallback: try_files $uri $uri/ /index.html
   - Security headers: X-Frame-Options, X-Content-Type-Options, CSP

3. Create docker-compose.yml at project root:
   - frontend service: builds from frontend/Dockerfile, ports 3000:80
   - Environment variables passed from .env
   - Restart policy: unless-stopped
   - Network: openclaw-network

4. Create docker-compose.dev.yml:
   - Mount source code as volume for hot-reload
   - Use node:20-alpine with yarn start
   - Expose port 3000

5. Create .dockerignore in frontend/:
   - node_modules, build, .git, *.md, .env.local

6. Add scripts to root package.json or Makefile:
   - docker:build, docker:up, docker:down, docker:logs

Test that the production build serves correctly on port 3000.
```

### Prompt 8.2 — GitHub Actions CI/CD

```
Set up GitHub Actions CI/CD for OpenClaw Hub:

1. Create .github/workflows/ci.yml:

   Trigger: push to main, pull requests to main

   Jobs:

   lint:
   - Checkout code
   - Setup Node 20
   - Install dependencies (yarn install --frozen-lockfile)
   - Run ESLint (npx eslint frontend/src/)

   test:
   - Checkout code
   - Setup Node 20
   - Install dependencies
   - Run unit tests (yarn test:ci)
   - Upload coverage report as artifact

   build:
   - Checkout code
   - Setup Node 20
   - Install dependencies
   - Run production build (yarn build)
   - Upload build artifact
   - Report bundle size in PR comment using actions/github-script

   e2e:
   - Depends on: build
   - Download build artifact
   - Install Playwright browsers
   - Start static server serving build/
   - Run Playwright tests
   - Upload test results and screenshots on failure

2. Create .github/workflows/deploy.yml:

   Trigger: push to main (only after CI passes)

   Jobs:

   deploy:
   - Download build artifact from CI
   - Deploy to Netlify using netlify-cli
   - Post deployment URL as commit status

3. Add status badges to README.md

4. Create .github/dependabot.yml for automated dependency updates (weekly, npm ecosystem)

All jobs should use caching for node_modules (actions/cache with yarn.lock hash).
```

---

## 9. Data Layer & State Management

### Prompt 9.1 — Global State with Zustand

```
OpenClaw Hub currently has no global state management — each page component manages its own state with useState.

Add Zustand for lightweight global state:

1. Install zustand

2. Create these stores in frontend/src/stores/:

   useAppStore.js:
   - sidebarCollapsed: boolean
   - commandPaletteOpen: boolean
   - currentPage: string
   - notifications: array (unread count badge for navbar)
   - actions: toggleSidebar, openCommandPalette, closeCommandPalette, addNotification, clearNotifications

   useDashboardStore.js:
   - stats: { agents, workflows, tables, sessions }
   - activityFeed: array
   - isLoading: boolean
   - error: string | null
   - actions: fetchStats, fetchActivity, addActivity (for WebSocket)
   - Use zustand middleware: persist (to localStorage for offline support)

   useSettingsStore.js:
   - theme: 'dark' | 'light' | 'system'
   - language: 'bg' | 'en'
   - refreshInterval: number
   - animationsEnabled: boolean
   - glassIntensity: number (0-100)
   - actions: updateSetting (generic), resetToDefaults
   - persist middleware with localStorage

3. Refactor DashboardPage.jsx to use useDashboardStore instead of local state
4. Refactor CommandNavbar.jsx to use useAppStore for active page and notifications
5. Create a useHydration hook to handle SSR-safe store hydration

Use zustand's immer middleware for immutable updates. Keep stores small and focused.
```

### Prompt 9.2 — React Query for Server State

```
Add TanStack React Query for server state management in OpenClaw Hub:

1. Install @tanstack/react-query and @tanstack/react-query-devtools

2. Create frontend/src/providers/QueryProvider.jsx:
   - Configure QueryClient with defaults: staleTime 30s, retry 2, refetchOnWindowFocus true
   - Add ReactQueryDevtools in development only

3. Wrap App with QueryProvider in index.js

4. Create query hooks in frontend/src/hooks/:

   useStats.js:
   - useQuery for GET /api/stats
   - Refetch every 30s (configurable from settings)
   - Placeholder data from localStorage cache

   useActivity.js:
   - useInfiniteQuery for paginated activity feed
   - GET /api/activity?page=N&limit=20
   - Load more on scroll

   useWorkflows.js:
   - useQuery for GET /api/workflows (list)
   - useMutation for POST /api/workflows/:id/run (trigger workflow)
   - Optimistic update: show "running" status immediately
   - Invalidate workflow list on mutation success

   useSessions.js:
   - useQuery for GET /api/airtop/sessions
   - useMutation for POST /api/airtop/sessions (create)
   - useMutation for DELETE /api/airtop/sessions/:id (stop)

5. Refactor DashboardPage to use useStats and useActivity
6. Refactor ResourcesPage n8n tab to use useWorkflows
7. Refactor WatchtowerPage to use useSessions

Add loading, error, and empty states using the existing glassmorphism design.
```

---

## 10. Accessibility & i18n

### Prompt 10.1 — Accessibility Audit & Fixes

```
Perform an accessibility audit of OpenClaw Hub and fix all issues:

1. Semantic HTML:
   - Ensure each page has exactly one <main> landmark
   - Add <nav> landmark to CommandNavbar if missing
   - Add <header>, <footer>, <section> where appropriate
   - Replace generic <div> with semantic elements where content warrants it

2. ARIA attributes:
   - Add aria-label to icon-only buttons (all Lucide icon buttons in navbar and pages)
   - Add aria-live="polite" to the activity feed for screen reader announcements
   - Add aria-current="page" to active navigation link
   - Add role="status" to connection status indicators
   - Add aria-expanded to all collapsible sections (credential tree, accordion)

3. Keyboard navigation:
   - Ensure all interactive elements are focusable (tabIndex where needed)
   - Add visible focus styles: ring-2 ring-primary/50 ring-offset-2 ring-offset-background
   - Ensure Tab order is logical on each page
   - Add Escape key handler to close all modals/overlays
   - Calendar: arrow key navigation between dates

4. Color contrast:
   - Check all text/background combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large)
   - Fix any failing combinations — especially light text on glass backgrounds
   - Ensure severity colors (green, yellow, red) have sufficient contrast
   - Add text labels alongside color-only indicators

5. Screen reader support:
   - Add visually-hidden text (sr-only class) for icon-only elements
   - Add alt text to any images or visual indicators
   - Ensure form inputs have associated labels
   - Add descriptive aria-label to the Tailscale mesh network visualization

6. Motion:
   - Respect prefers-reduced-motion: disable Framer Motion animations and CSS animations
   - Add a Tailwind media query utility: motion-safe: and motion-reduce:

Test with keyboard-only navigation across all pages.
```

### Prompt 10.2 — Internationalization (Bulgarian + English)

```
The OpenClaw Hub UI currently mixes Bulgarian and English text. Add proper i18n support:

1. Install react-i18next and i18next

2. Create frontend/src/i18n/ directory:

   config.js:
   - Initialize i18next with React bindings
   - Default language: bg (Bulgarian)
   - Fallback: en
   - Load from local JSON files
   - Detect language from localStorage, then browser

   locales/bg.json:
   - Extract ALL existing Bulgarian text from all components
   - Organize by page: dashboard, calendar, resources, watchtower, playground, common
   - Include: page titles, button labels, status messages, error messages, placeholders

   locales/en.json:
   - English translations for all keys
   - Same structure as bg.json

3. Replace all hardcoded strings in components with t() function:
   - DashboardPage: "Агенти" → t('dashboard.agents'), "Активност" → t('dashboard.activity'), etc.
   - CalendarPage: month names, day names, event types
   - ResourcesPage: tab names, skill categories, status labels
   - WatchtowerPage: session states, control labels
   - PlaygroundPage: terminal commands and responses, tab names
   - CommandNavbar: navigation labels, status text

4. Add language switcher:
   - In Settings page or navbar dropdown
   - Flag icons or language codes (BG / EN)
   - Persist selection to localStorage

5. Handle pluralization and date formatting:
   - Use i18next pluralization for counts (1 агент, 2 агента, 5 агенти)
   - Use date-fns locales (bg, enUS) matching the selected language

6. Update document title dynamically based on current page and language

Ensure the app works fully in both languages with no untranslated strings.
```

---

## Quick Reference — Single-Line Prompts

For smaller, targeted tasks you can paste these one-liners:

```
Add a favicon and custom meta tags (Open Graph, Twitter Card) to frontend/public/index.html for OpenClaw Hub with the 🦞 lobster theme.
```

```
Add keyboard shortcuts to OpenClaw Hub: 1=Dashboard, 2=Calendar, 3=Resources, 4=Watchtower, 5=Playground. Show a shortcuts cheat sheet on "?" key press. Use a glassmorphism modal.
```

```
Add a notification bell icon to CommandNavbar.jsx with a dropdown panel showing the last 10 notifications. Badge shows unread count. Store in localStorage. Use shadcn/ui Popover + glassmorphism styling.
```

```
Create a reusable ErrorBoundary component in frontend/src/components/ErrorBoundary.jsx that catches React errors, shows a glassmorphism "Something went wrong" card with error details and a "Reload" button, and logs errors to console.
```

```
Add export functionality to CalendarPage.jsx: an "Export" button that downloads all events as .ics (iCalendar format) file compatible with Google Calendar and Apple Calendar.
```

```
Optimize all images and SVGs in the project. Add loading="lazy" to any img tags. Convert any large PNGs to WebP. Add proper width/height attributes to prevent layout shift.
```

```
Add a "System Health" widget to the Dashboard that pings all configured services (n8n, Supabase, Airtop, Tailscale) and shows their status as green/yellow/red dots with response time in ms.
```

```
Refactor all color values in frontend/src/index.css to use HSL format and CSS custom properties. Create a consistent color token system: --color-success, --color-warning, --color-error, --color-info with both light and dark variants.
```
