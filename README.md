# Trace

Trace is a private health-history app. Each person you care for has a separate profile, and each concern stays in its own case: timeline, patterns, and a doctor-ready summary.

This app was rebuilt from a Figma Make export (React, Vite, and Tailwind CSS).

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Create an account on the first screen. Trace starts a profile in your name with no cases, and each email keeps its own history in this browser. Passwords stay on this device and are not sent to a server.

Patterns and case summaries are written from that case’s timeline only. Trace does not send summaries, patterns, photos, or timeline entries anywhere. New photos have their location data removed before they are saved, unless you turn that off in Privacy settings.

```bash
npm run build
npm run preview
```
