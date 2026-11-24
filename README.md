# RMB Garage Scheduler

An installable automotive appointment scheduler for RMB Garage. It runs as a Progressive Web App on iPhone and PC, stores appointments in SQLite, sends email reminders 48 and 2 hours before appointments, and lets customers confirm or decline from secure email links.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and configure SMTP plus `APP_BASE_URL`.
4. Run `npm start` and open `http://localhost:3000`.

For reliable email links, deploy behind HTTPS and set `APP_BASE_URL` to the public URL. The scheduler uses America/Chicago for Texas Central Time.

## Environment variables

See `.env.example`. SMTP is optional for local testing; without it, emails are logged to the server console.

## Install on iPhone or PC

Open the deployed HTTPS URL in Safari (iPhone) or Chrome/Edge (PC), then choose **Add to Home Screen** or **Install app**.
