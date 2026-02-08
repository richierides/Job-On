# HomeFix AI

## Overview

HomeFix AI is a mobile-first application that helps homeowners document household repairs and maintenance tasks using voice and video. Users can record videos of issues around their home, and AI automatically transcribes the audio and generates structured "Job Cards" with titles, effort scores, locations, and priorities. The core interaction is "See it, Say it, Save it" - a hold-to-record camera interface that eliminates the need for manual data entry.

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
  - `householdMembers` - Members of households (name only, no authentication required)
  - `tasks` - Job cards with title, location, priority, effort score, status, householdId, assignedToId, estimatedMinutes, subtasks (JSONB), shoppingList (JSONB), completedAt
- **Migrations**: Managed via `drizzle-kit push`

### Household System (No Auth)
- Users create or join households using 6-character invite codes
- Members are identified by name only, stored locally via AsyncStorage
- Tasks belong to households and can be assigned to any household member
- Session data: `client/contexts/UserSessionContext.tsx` stores memberId, memberName, householdId, householdName, inviteCode
- Onboarding flow: `OnboardingScreen` handles household creation/joining and member setup

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
- Recording overlay: "What to mention" bullet points displayed over camera view, fades out during recording
- Materials List tab: Dashboard has Tasks/Materials List tabs; Materials List aggregates shopping items across all tasks with task attribution
- Plan My Work: Chat-based AI planning assistant (PlanScreen) with split layout - scrollable plan area above, chat input anchored at bottom. Backend POST /api/plan/chat endpoint uses GPT-4o to generate structured weekly plans. AI asks 2-3 setup questions (start date, availability per person) then generates collapsible week-by-week plan cards with task assignments, time estimates, and day scheduling. Users can refine plans through follow-up chat messages.

## Roadmap (Upcoming Features)
- Task dependencies (tag tasks that depend on others)
- Basic schedule of works view