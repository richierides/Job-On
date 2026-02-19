# Home DIY Tracker

## Overview

Home DIY Tracker is a mobile-first application that helps homeowners document household repairs and maintenance tasks using voice and video. Users can record videos of issues around their home, and AI automatically transcribes the audio and generates structured "Job Cards" with titles, effort scores, locations, and priorities. The core interaction is "See it, Say it, Save it" - a hold-to-record camera interface that eliminates the need for manual data entry.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation with Native Stack Navigator (no tab bar, stack-based with floating action button)
- **State Management**: TanStack React Query for server state synchronization
- **Styling**: Custom theme system with light/dark mode support, no Tailwind/NativeWind
- **Animations**: React Native Reanimated for smooth gesture and UI animations
- **Key Screens**: Task Dashboard (card-based layout with filtering), Recording Modal (camera capture), Task Detail (edit with completion tracking), Settings
- **Components**: TaskCard (large task cards with thumbnail, chips, footer), FilterBar (expandable filter panel), Chip (color-coded property badges), PropertyPicker (bottom sheet for inline editing)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints under `/api/` prefix
- **File Handling**: Multer for multipart form-data video uploads (100MB limit)
- **AI Processing Pipeline**:
  1. Video uploaded from mobile device
  2. Audio extracted and sent to OpenAI Whisper for transcription
  3. Transcript analyzed by GPT-4o to generate structured Job Card data
  4. First video frame extracted as thumbnail

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Main Tables**:
  - `households` - Household groups with 6-character invite codes for sharing
  - `householdMembers` - Members of households (name, optional email/passwordHash for account claiming)
  - `tasks` - Job cards with title, location, priority, effort score, status, householdId, assignedToId, estimatedMinutes, subtasks (JSONB), shoppingList (JSONB), completedAt
- **Migrations**: Managed via `drizzle-kit push`

### Household System (Optional Email Auth)
- Users create or join households using 6-character invite codes
- Members can optionally attach an email and password to their profile via Settings > "Save My Account"
- Returning users can sign in with email/password from the onboarding screen to restore their session on any device
- Session data: `client/contexts/UserSessionContext.tsx` stores memberId, memberName, householdId, householdName, inviteCode
- Onboarding flow: `OnboardingScreen` handles household creation/joining, member setup, and email sign-in
- Auth endpoints: POST /api/auth/register (attach email to existing member), POST /api/auth/login (sign in, returns member + household)

### Project Structure
- `client/` - React Native frontend code (components, screens, hooks, navigation)
- `server/` - Express backend (routes, database, AI integrations)
- `shared/` - Shared TypeScript types and Drizzle schemas
- `server/replit_integrations/` - Pre-built AI utilities (audio, chat, image, batch processing)

### Key Design Patterns
- Path aliases: `@/` maps to `client/`, `@shared/` maps to `shared/`
- Theming: Centralized in `client/constants/theme.ts` with Colors, Typography, Spacing, BorderRadius
- Error handling: ErrorBoundary component wraps the app
- API requests: Centralized through `client/lib/query-client.ts` with automatic base URL detection

## External Dependencies

### AI Services
- **OpenAI API** (via Replit AI Integrations): Whisper for speech-to-text, GPT-4o for task analysis
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Schema-first approach with Zod validation

### Mobile Capabilities
- **expo-camera**: Video recording with hold-to-record gesture
- **expo-av**: Audio recording/playback
- **expo-video-thumbnails**: Extract first frame for Job Card thumbnails
- **expo-file-system**: Local file management for uploads
- **expo-haptics**: Tactile feedback for interactions

### Fonts
- Google Fonts: Manrope and Nunito loaded via `@expo-google-fonts`

## Recent Changes
- Design refresh: Updated color palette from orange primary to blueprint blue (#2D8CFF) with amber/orange accent (#FF8C2E) to match new app icon. Updated all theme colors, Chip variants, backgrounds, borders. Record button uses accent orange. App icon, splash, favicon all updated.
- Recording overlay: "What to mention" bullet points displayed over camera view, stays visible (dimmed to 60% opacity) during recording
- Materials List tab: Dashboard has Tasks/Materials List tabs; Materials List aggregates shopping items across all tasks with task attribution
- Plan My Work: Chat-based AI planning assistant (PlanScreen) with split layout - scrollable plan area above, chat input anchored at bottom. Backend POST /api/plan/chat endpoint uses GPT-4o to generate structured weekly plans. AI asks 2-3 setup questions (start date, availability per person) then generates collapsible week-by-week plan cards with task assignments, time estimates, and day scheduling. Users can refine plans through follow-up chat messages.
- Plan screen split-panel: Plan and chat are now in separate independently-scrollable panels. Top panel shows the generated plan (or empty state), bottom panel shows chat conversation. Both visible simultaneously so the plan stays in view while chatting.
- Expandable plan tasks: Each task in a generated plan can be tapped to reveal full details (location, priority, effort score, subtasks with progress bar, shopping list) by matching to actual task data.
- Save Plan: "Save Plan" button appears in plan panel header when a plan is generated. Saves to `saved_plans` table via POST /api/plans. Button changes to "Saved" with checkmark after saving.
- Saved Plans screen: Accessible from dashboard via archive icon button next to "Plan My Work". Shows saved plans with week/task breakdowns, stats (weeks, tasks, total time), and delete functionality (DELETE /api/plans/:id).
- Keyboard dismiss: Swiping down the chat panel in Plan screen dismisses the keyboard; tapping the chat ribbon reopens the panel.
- Video playback: Recorded videos are saved to disk (uploads/videos/) and served via /uploads static route. Task detail screen shows play button overlay on thumbnail; tapping opens inline video player using expo-video with native controls, fullscreen, and PiP support.
- Auth system: Apple Sign-In (iOS), Google Sign-In (OAuth), and email signup/login. Auth-first onboarding flow. Database tracks authProvider and authProviderId on householdMembers.
- Onboarding progress bar: Thin 3-segment blue strip at top of onboarding screen showing Step 1 (Account) → Step 2 (Household) → Step 3 (Invite). Labels below bar indicate current step.
- Invite sharing: After household creation in onboarding, users see an "invite-success" screen with Share Invite (native share sheet), Copy Code (clipboard), and Continue buttons. Also available from Settings → Household → Invite Members modal.
- Household management: Settings → Household section with Switch, Create, Join, and Invite Members options using modals. PATCH /api/members/:id endpoint for updating member auth info. GET /api/members/:id/households for fetching all households a member belongs to.
- Task generation timing: Server-side performance monitoring logs timing for each phase (audio extraction, Whisper transcription, GPT-4o structuring, total). Timings returned in API response as `_timings` field.
- Performance audit (Feb 2025): TaskDashboardScreen uses FlatList (not ScrollView) for virtualized task rendering. TaskCard wrapped in React.memo. Video file operations use fs.renameSync (not copy+delete). JSON body parser limit reduced to 5MB (multer handles video uploads). Dead code removed (no-op middleware, unused MemStorage class, inline require). Shared utility functions extracted to `client/lib/utils.ts` (formatMinutes, getPriorityColor, findMatchingTask, formatDuration).
- Task generation speed (Feb 2025): Audio extracted as compressed MP3 (not WAV) for faster Whisper upload. GPT structuring uses gpt-4o-mini (not gpt-4o) for faster response. File saving (video + thumbnail) runs in parallel with GPT structuring via Promise.all.

## Roadmap (Upcoming Features)
- Task dependencies (tag tasks that depend on others)
- Basic schedule of works view