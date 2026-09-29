# Smart Life: an AI-powered life organiser

**An all-in-one personal organiser that brings together tasks, notes, calendar, contacts, expenses, fitness, recipes, shopping lists, meeting recordings, and an AI assistant in one installable app.**

[![Live app](https://img.shields.io/badge/live-smart--life--app.pages.dev-f97316?style=flat-square)](https://smart-life-app.pages.dev/)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=flat-square&logo=shadcnui&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white)

**Live:** [smart-life-app.pages.dev](https://smart-life-app.pages.dev/)

---

## Screenshots

<!-- Add images to docs/screenshots/ and uncomment. -->
<!--
| Home | Smart Agent | Recordings | Calendar |
|---|---|---|---|
| ![](docs/screenshots/home.png) | ![](docs/screenshots/agent.png) | ![](docs/screenshots/recordings.png) | ![](docs/screenshots/calendar.png) |
-->

_Screenshots coming soon. For now, see the [live app](https://smart-life-app.pages.dev/)._

---

## Features

| Area | What you can do |
|---|---|
| **Smart Agent** | An AI assistant (Gemini, with Groq as a fallback) that answers questions and can create tasks for you |
| **Productivity** | Tasks, notes with a rich editor, follow-ups, and a unified timeline |
| **Calendar & booking** | Calendar, availability, public booking links, and booking pages |
| **Recordings** | Record meetings in the browser and get AI meeting summaries |
| **Life admin** | Contacts, expenses, shopping lists, and recipes |
| **Health** | Fitness tracking |
| **Utilities** | A media and file converter (ffmpeg.wasm) and screen mirror |
| **Platform** | Push notifications, a PWA, an admin panel, and automatic 90-day data clean-up |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, Recharts |
| Backend | Firebase Auth and Firestore, plus Cloud Functions (scheduled clean-up) |
| AI | Google Gemini, with Groq as a fallback |
| Media | ffmpeg.wasm (file conversion) |
| Hosting | Cloudflare Pages (Firebase Hosting redirects there) |

---

## Getting started

```bash
git clone https://github.com/dean1234533/smart-life-app.git
cd smart-life-app
npm install
npm run dev
```

Add your Firebase web config to the environment, then deploy the backend:

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

```bash
npm run build      # production build
npm run lint       # ESLint
```

---

## Project structure

```
src/
  pages/        Home, SmartAgent, Tasks, Notes, CalendarPage, Recordings, Expenses, Fitness, Recipes …
  components/   UI components (shadcn/ui)
  services/     Gemini and other service integrations
  lib/          Firebase + Firestore service, auth context
functions/      Cloud Functions (scheduled 90-day clean-up)
workers/        Cloudflare workers
```

---

## Author

Built by **Dean Da Dev**, a UK full-stack developer building web apps, websites,
and AI tools.

🌐 [dean-da-dev.co.uk](https://www.dean-da-dev.co.uk/) · 💼 [More projects](https://www.dean-da-dev.co.uk/portfolio) · 🐙 [GitHub](https://github.com/dean1234533)
