# LifeOS — Everything, Organized

An ad-free, installable personal operating system for daily life. The front end is a zero-build PWA. Personal entries stay in your browser; only enabled reminder schedules and their brief descriptive details go to a Netlify-hosted push service.

## Included modules

Today dashboard, tasks and priorities, calendar, recurring routines, workout logging, food and water logging, bills and budgeting, household chores, pet care, wellness check-ins, projects, goals, personal notes, journal, reminders, insights and customizable settings.

Reminders support one-time, daily, weekday, weekly and monthly schedules; advance warnings at the exact scheduled time, 5, 10, 15, 30, 60 minutes or one day before; lock-screen privacy, quiet hours, normal/high priority, device-specific settings and a delivery test. The server evaluates schedules every minute. Device, browser and network conditions can cause delays.

## Deploy via Netlify

1. Open Netlify > Add new project > Import an existing project > GitHub.
2. Select newlinj821-jpg/LifeOS, branch main.
3. Use the repository root as the base directory; netlify.toml supplies the build command, publish folder and function path.
4. Deploy. The main app works locally in the browser even if notification keys have not been configured.
5. For push that works with the app closed, in the LifeOS Netlify site add the following environment variables, then redeploy:

- VAPID_PUBLIC_KEY: base64url public VAPID key.
- VAPID_PRIVATE_KEY: matching private VAPID key. Keep it secret; do not commit it to GitHub.
- VAPID_SUBJECT: a contact value, for example mailto:you@example.com.

Generate a matching pair using the web-push CLI: npx web-push generate-vapid-keys. Keep both keys in Netlify environment variables, not in repository files.

This backend uses Netlify Functions, Netlify Blobs and standards-based web push. No separate Supabase account or external notification service is required.

## Turn on iPhone notifications

1. Open the deployed HTTPS LifeOS site in Safari on iOS 16.4 or newer.
2. Tap Share > Add to Home Screen.
3. Open the installed Home Screen icon, not just the Safari page.
4. Open Settings > Detailed push notifications > Enable background push.
5. Allow notifications. Tap Send a test to verify device delivery.
6. Create a dated reminder with Send a detailed reminder enabled.

On Android and desktop, follow your browser's notification permission prompt.

## How alerts work

The scheduled Netlify Function checks every minute. It reads registered device schedules, uses the device's IANA timezone to calculate local time, and sends push payloads to the browser push service. Delivery is generally close to the scheduled minute, not exact to the second.

Each device receives a random private management token on enrollment, allowing it to update or revoke its own subscription. Only selected reminder titles, schedule, optional brief context, timezone, priority, quiet hours, lock-screen privacy preference and encrypted browser push endpoint are stored on the server. The full journal, notes, finances and personal records are not uploaded.

A private lock-screen option hides detailed reminder titles and text. Normal reminders can be silenced during quiet hours; high-priority reminders bypass them. Suppressed notifications are not automatically replayed. Power-saving modes, Focus/Do Not Disturb, unavailable network, push provider outages or cron delays can affect delivery. Do not rely on web push alone for urgent medical or safety-critical alerts.

## Data and privacy

LifeOS saves personal records locally in the browser (localStorage). The complete JSON backup/export and import controls are in Settings. Each browser/device maintains separate local data; transferring a backup is the supported migration path. Exported backups can contain private details, so store them securely.

Disabling push from Settings revokes this device and deletes its schedules from the notification server. If you clear browser data first, you can lose the device management token. If that happens, reset the permission/subscription in browser settings and use the Repair push option.

The application contains no advertisements or analytics tracking. It is not an electronic health record, a financial account, or a substitute for professional medical advice.

## Developer notes

The front end is index.html + styles.css + app.js, with sw.js, manifest.webmanifest, and icon.svg for PWA installation. Push service functions are in netlify/functions and shared logic in netlify/lib. The repository includes automated syntax checks and unit tests for reminder time calculations and notification wording.

Run: node --check app.js
Run: node --test tests/*.test.mjs

For notification issues review the Netlify Functions logs for push and check-reminders. Verify all three VAPID variables and redeploy after modifying them.
