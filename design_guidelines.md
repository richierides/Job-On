# HomeFix AI Design Guidelines

## Brand Identity

**Purpose**: HomeFix AI empowers homeowners to capture and manage household repairs effortlessly. The app transforms casual video observations into professional maintenance records.

**Aesthetic Direction**: **Capable & Trustworthy** — A blueprint-inspired design that feels professional and approachable. Clean lines, confident typography, with a bright blue primary color (evoking blueprints, reliability, and clarity) and warm amber/orange as an action accent. The design prioritizes speed and clarity over decoration.

**Memorable Element**: The **pulsing record button** — a large, unmissable circular button in warm amber/orange that pulses when held. This is the heart of the "See it, Say it, Save it" experience.

---

## Navigation Architecture

**Root Navigation**: Stack-based with floating action
- No tab bar (only 2-3 feature areas)
- Main screen is the Task Dashboard
- Floating record button triggers camera modal
- Settings accessible via header button

**Screen List**:
1. **Task Dashboard** (Main) - View all job cards, initiate recording
2. **Camera/Recording Modal** - Capture video while holding button
3. **Task Detail** - View/edit job card details
4. **Settings** - Profile, preferences, app info

---

## Screen Specifications

### 1. Task Dashboard (Main Screen)
**Purpose**: Central hub showing all maintenance tasks; primary access point for recording.

**Layout**:
- **Header**: Transparent background, app title "HomeFix" in bold custom font (left), settings icon button (right)
- **Main Content**: 
  - Scrollable list (FlatList) of job cards
  - Safe area insets: top = headerHeight + 24px, bottom = 100px (room for floating button)
- **Floating Elements**:
  - Large circular record button (80px diameter) positioned bottom-center, 32px above screen bottom edge
  - Safe area: bottom = insets.bottom + 32px

**Components**:
- Job Cards (each card shows: thumbnail image, title, location tag, effort score indicator, priority badge, status toggle)
- Empty state illustration (when no tasks exist)
- Floating record button with pulse animation

### 2. Camera/Recording Modal
**Purpose**: Capture video/audio of household issue while holding button.

**Layout**:
- **Full-screen native modal** (covers entire screen including status bar)
- Camera viewfinder fills screen
- **Overlay Elements**:
  - Close button (top-left, white X icon)
  - Recording indicator (top-center): red dot + timer when active
  - Hold-to-record button (bottom-center, 100px diameter): Amber with white camera icon, glowing border when pressed
  - Instruction text above button: "Hold to record your task"

**Safe Area**: All overlay elements respect safe area insets

### 3. Task Detail Screen
**Purpose**: View and edit job card details.

**Layout**:
- **Header**: Standard navigation with back button (left), "Edit" text button (right)
- **Main Content**: Scrollable form
  - Top inset: 24px
  - Bottom inset: insets.bottom + 24px
- **Form Fields** (all inline editable):
  - Large thumbnail image (16:9 ratio)
  - Title text field (large, bold)
  - Location dropdown
  - Priority segmented control (Low/Medium/High)
  - Effort score (1-5 stars, non-editable)
  - Status toggle (Pending/Completed)
  - Delete button (bottom, destructive style)

### 4. Settings Screen
**Purpose**: User profile and app preferences.

**Layout**:
- **Header**: Standard with back button, "Settings" title
- **Main Content**: Scrollable list of sections
  - Profile section: Avatar (generated preset), display name field
  - Preferences: Theme toggle (Light/Dark)
  - About: Version, privacy policy, terms (placeholder links)
- Safe area insets: top = 24px, bottom = insets.bottom + 24px

---

## Color Palette

**Primary**: `#2D8CFF` (Blueprint Blue) — Structure, reliability, clarity  
**Primary Dark**: `#1A6FD4`  
**Accent**: `#FF8C2E` (Amber Orange) — Action, record button, highlights  
**Background**: `#F5F8FC` (Light mode), `#121820` (Dark mode)  
**Surface**: `#FFFFFF` (Light), `#1C2530` (Dark)  
**Text Primary**: `#1A1A1A` (Light), `#FAFAFA` (Dark)  
**Text Secondary**: `#666666` (Light), `#A0A0A0` (Dark)  
**Border**: `#D4DFEC` (Light), `#2E3B4D` (Dark)  
**Success**: `#34C759`  
**Warning**: `#F5A623`  
**Error**: `#EF4444`

---

## Typography

**Primary Font**: **Manrope** (Google Font) — Modern, geometric, highly legible  
**Fallback**: System default (SF Pro on iOS, Roboto on Android)

**Type Scale**:
- **Title**: 28px, Bold — Screen headers  
- **Heading**: 20px, Bold — Card titles  
- **Body**: 16px, Regular — Descriptions, labels  
- **Caption**: 14px, Regular — Metadata, tags  
- **Button**: 16px, SemiBold — CTAs

---

## Visual Design

- **Icons**: Use Feather icons from @expo/vector-icons (minimalist, consistent stroke width)
- **Card Style**: Subtle border (1px), no shadow, 12px corner radius
- **Floating Record Button**: Drop shadow with shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 8
- **Press Feedback**: All touchables scale to 0.95 on press, 100ms duration
- **Recording Indicator**: Pulsing animation (scale 1.0 to 1.1, opacity 0.8 to 1.0, repeat)

---

## Assets to Generate

1. **icon.png** — App icon featuring a house outline with a video camera symbol inside, amber and white color scheme. **WHERE USED**: Device home screen.

2. **splash-icon.png** — Simplified version of app icon for launch screen. **WHERE USED**: App launch splash screen.

3. **empty-tasks.png** — Illustration of a toolbox with a video camera, neutral gray with amber accent. Simple line art style. **WHERE USED**: Task Dashboard when user has no tasks.

4. **ai-processing.png** — Abstract illustration of a brain with circuit patterns, amber/gray palette. **WHERE USED**: Loading overlay during AI processing ("Generating Task..." screen).

5. **default-avatar.png** — Circular avatar with house icon, neutral colors. **WHERE USED**: Settings screen profile section.