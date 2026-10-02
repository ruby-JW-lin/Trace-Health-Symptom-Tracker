# Trace

Trace is a private health-history app. Each person you care for has a separate profile, and each concern stays in its own case: timeline, patterns, and a doctor-ready summary.

This app was rebuilt from a Figma Make export (React, Vite, and Tailwind CSS).

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) on the computer running the app.

Anyone can try the hosted demo at [https://ruby-jw-lin.github.io/Trace-Health-Symptom-Tracker/?demo=1](https://ruby-jw-lin.github.io/Trace-Health-Symptom-Tracker/?demo=1). That link opens Trace with no account. Each browser keeps its own cases, and nothing is sent or shared.

Create an account on the first screen when you want a named profile on this device. Trace starts that profile with no cases, and each email keeps its own history in this browser. Passwords stay on this device and are not sent to a server.

Patterns and case summaries are written from that case’s timeline only. Trace does not send summaries, patterns, photos, or timeline entries anywhere. New photos have their location data removed before they are saved, unless you turn that off in Privacy settings.

```bash
npm run build
npm run preview
```
