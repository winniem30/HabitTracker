# HabitFlow

A polished, responsive habit tracker built with React + Vite.

## Features

- Daily dashboard with completion percentage
- Habit schedules: daily, weekdays, weekends, or custom days
- Start/end dates and optional reminders/targets
- One-click daily completion tracking
- Monthly history calendar with completion bars
- Current and best streaks
- 7-day analytics
- Habit-level performance
- Local persistence using browser localStorage
- Responsive mobile layout
- Add, edit and delete habits

## Run

Requirements: Node.js 18+

```bash
npm install
npm run dev
```

Open the local URL Vite gives you.

For production:

```bash
npm run build
npm run preview
```

## Data

This first version intentionally uses localStorage so it works immediately with no account or backend. The state model is already structured so Firebase/Supabase can be added later for authentication, cloud sync, push notifications, and multi-device access.
