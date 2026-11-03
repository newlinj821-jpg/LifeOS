# LifeOS — Everything, Organized

An ad-free, installable personal operating system for daily life. The front end is a zero-build PWA. Personal entries stay in your browser; only enabled reminder schedules and their brief descriptive details go to a Netlify-hosted push service.

## Included modules

Today dashboard, adaptive day planner, natural-language quick capture, personal automation rules, tasks and priorities, calendar, recurring routines, workout logging, food and water logging, bills and budgeting, household chores, pet care, wellness check-ins, projects, goals, personal notes, journal, reminders, insights and customizable settings.

Reminders support one-time, daily, weekday, weekly and monthly schedules; advance warnings at the exact scheduled time, 5, 10, 15, 30, 60 minutes or one day before; lock-screen privacy, quiet hours, normal/high priority, device-specific settings and a delivery test. The server evaluates schedules every five minutes. Device, browser and network conditions can cause delays.

## Keep everyday use simple

On a **new device with no saved LifeOS records**, a short, optional welcome setup asks how you want to use the app. Choose which areas matter to you, select a display mode, and tap **Start LifeOS** or **Skip setup**. LifeOS defaults to **Simple Mode**; existing personal records are preserved.

- **Simple (default):** a focused Today dashboard, a concise Tasks screen, a clean Reminders list, one-tap water logging, minimal entry forms, and selected favorite areas in the sidebar. An **All modules** screen keeps everything available without crowding the navigation.
- **Standard:** shows all selected favorite areas plus insights and the daily planning tools in navigation.
- **Advanced:** exposes all available modules, advanced automation and detailed settings. You can still use the same simple quick-entry shortcuts.

To change modes or favorite areas, open **Settings → Your experience**. Changing modes is **presentation-only**; it does not erase data or turn off alerts. You can reopen the optional setup any time.

The Today screen has quick shortcuts for tasks, meals, workouts, reminders and water. Use **Add new** for a short form; choose **More options** if an entry needs richer details such as instructions, priorities, nutritional information, costs or additional scheduling.

### Build and verify

LifeOS is a static Progressive Web App with Netlify Functions. `npm run build` writes the deployment-ready website to `dist/`, including all experience-mode scripts and styles. The checked-in Netlify configuration publishes that directory, and GitHub Actions checks the build and unit tests after changes.

## Public Reference Library and offline database

LifeOS now includes a searchable **Reference Library** for:

- **USDA FoodData Central:** real nutrition lookup with user-selected gram portions and source-linked entries
- **wger:** public exercise records with descriptions, equipment and muscle groups when supplied
- **Nager.Date:** holiday lookup by country and year, with calendar import
- **51 original offline LifeOS templates:** tasks and routines for everyday household, planning, pets, finances, movement, travel, and more

The app retains source labels and timestamps. Selected public references can be saved in **IndexedDB**, searched offline, and exported/restored separately from personal LifeOS data. The original personal database remains local-first; the public-reference backend does **not** synchronize accounts or upload private life records.

Open **All modules → Reference Library**, or use the reference-search shortcut in Food or Fitness. You can make the library a favorite area in Settings. Use the result action to explicitly add a food log, workout plan, calendar item or reusable task.

**Food lookup works with the built-in USDA demo key only at limited volume.** For sustained use, obtain your own free USDA FoodData Central API key and set `FDC_API_KEY` in LifeOS Netlify environment variables. This is not a subscription and no key is exposed to browsers. Exercise and holiday search require no user key.

Read the source, license, privacy, caching, and verification details in [Reference Database](docs/REFERENCE_DATABASE.md).

## Deploy via Netlify

1. Open Netlify > Add new project > Import an existing project > GitHub.
2. Select newlinj821-jpg/LifeOS, branch main.
3. Use the repository root as the base directory; netlify.toml runs npm run build, publishes only the dist folder, and loads server functions from netlify/functions. Leave the base directory at the repository root.
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

The scheduled Netlify Function checks every five minutes. It reads registered device schedules, uses the device's IANA timezone to calculate local time, and sends push payloads to the browser push service. Delivery is usually within several minutes of the scheduled time, not exact to the second.

Each device receives a random private management token on enrollment, allowing it to update or revoke its own subscription. Only selected reminder titles, schedule, optional brief context, timezone, priority, quiet hours, lock-screen privacy preference and encrypted browser push endpoint are stored on the server. The full journal, notes, finances and personal records are not uploaded.

A private lock-screen option hides detailed reminder titles and text. Normal reminders can be silenced during quiet hours; high-priority reminders bypass them. Suppressed notifications are not automatically replayed. Power-saving modes, Focus/Do Not Disturb, unavailable network, push provider outages or cron delays can affect delivery. Do not rely on web push alone for urgent medical or safety-critical alerts.

## Data and privacy

LifeOS saves personal records locally in the browser (localStorage). The complete JSON backup/export and import controls are in Settings. Each browser/device maintains separate local data; transferring a backup is the supported migration path. Exported backups can contain private details, so store them securely.

Disabling push from Settings revokes this device and deletes its schedules from the notification server. If you clear browser data first, you can lose the device management token. If that happens, reset the permission/subscription in browser settings and use the Repair push option.

The application contains no advertisements or analytics tracking. It is not an electronic health record, a financial account, or a substitute for professional medical advice.

## Developer notes

The front end includes index.html, app.js, enhancements.js, mode-core.js, simplicity.js, knowledge-bridge.js, reference-db.js, knowledge-core.mjs, knowledge-ui.mjs, styles.css, simplicity.css and knowledge.css, with sw.js, manifest.webmanifest, and icon.svg for PWA installation. Push service functions are in netlify/functions and shared logic in netlify/lib. The repository includes automated syntax checks and unit tests for reminder time calculations and notification wording.

Run: npm run build\nRun: npm run check\nRun: npm test

For notification issues review the Netlify Functions logs for push and check-reminders. Verify all three VAPID variables and redeploy after modifying them.
