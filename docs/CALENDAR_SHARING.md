# LifeOS calendar connections: read-only sharing, import, and export

LifeOS is an installable iPhone/Android web app. Its Calendar can provide a **private, read-only subscription link** that a friend or partner adds to their own Apple Calendar, Google Calendar, or Outlook. No paid calendar provider, email address, or separate API key is needed for this functionality.

## Share your calendar

1. Open LifeOS from the installed Home Screen icon, then choose **Calendar**.
2. Under **Share your schedule**, decide what subscribers may see:
   - **Busy only (default)**: dates and time blocks, with no event names or locations.
   - **Show event titles**: event names become visible.
   - **Include event locations**: optional and available only when titles are enabled.
3. Select **Create a private calendar link**. LifeOS asks you to confirm before publishing.
4. Use **Copy link** or **Share link** and send the resulting HTTPS subscription URL to the intended person.
5. When you modify a LifeOS calendar event while your app is open and online, LifeOS automatically attempts to update the saved feed. You can also tap **Update shared calendar** manually.
6. Select **Turn off sharing** to revoke the link. Subscribers will no longer be able to fetch the events, subject to each calendar provider's cache/refresh policy.

**Important privacy notes:** The link is private by obscurity (a long unguessable token), not by account login. Anyone who receives or forwards the URL can subscribe. Only the explicitly selected calendar-event fields go to Netlify Blobs; financial entries, wellness entries, journal, notes, routine logs, and pet details are not uploaded for this feature. The default is Busy only.

The read-only subscription is **not shared editing**. Recipients cannot modify your LifeOS records. There is no automatic syncing of two people's private LifeOS accounts.

### Subscribe from Apple Calendar

On iPhone, open Calendar → Calendars → Add Calendar → **Add Subscription Calendar**. Paste the provided HTTPS URL and follow the subscription prompt. Apple's guide: https://support.apple.com/guide/iphone/iph3d1110d4/ios

### Subscribe from Google Calendar

In a **computer browser**, open Google Calendar → Other calendars → **+** → **From URL**. Paste the HTTPS calendar link, then choose Add calendar. The subscribed calendar will appear with your other calendars, including on the receiving person's phone if synced to that Google account. Official help: https://support.google.com/calendar/answer/37100

### Subscribe from Outlook

Open Outlook on the web → Calendar → Add calendar → **Subscribe from web**. Paste the HTTPS calendar URL. Official help: https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web

Calendar apps poll subscriptions on their own intervals. Changes are **not instant**. Some services take several hours or occasionally over a day to reflect updates.

## Import and export files

LifeOS also offers **Import .ics events** and **Download .ics** in Calendar. Importing creates **local** calendar events from a compatible file, without enabling reminders automatically. Existing events are not overwritten. Supported imports include common UTC, local-time, named-timezone, all-day and basic recurrence values (daily, weekly, monthly or yearly). Complex recurrence exceptions may not be fully represented; review imported events after importing.

A downloaded `.ics` file is a **one-time snapshot**. It will not refresh in someone else's calendar. Use the share/subscription link if you want their calendar to update when your events change.

## Device, persistence, and security

- The share-management token and its link are stored **locally on the LifeOS device/browser that created the link**. If you delete browser data or lose that device before revoking, LifeOS may be unable to revoke the existing share. **Turn off sharing before clearing or moving devices.**
- The calendar share backend is hosted in Netlify Functions with a Netlify Blobs public-feed store. Management requires a separate random token. Recipients only get read-only access.
- The backend currently has an **idle-expiry safeguard after 365 days without updating**. Active owners can keep the feed fresh by using LifeOS online.
- The saved feed is updated only while the owning LifeOS installation is online. A device offline or with LifeOS closed cannot upload its latest local changes until the app next opens and synchronizes.
- A read-only link is a subscription URL, not a sign-in page. It can be copied into any supported calendar provider. The recipient does not need a LifeOS account.
- There are no additional API keys or subscriptions for this calendar feature. General Netlify free-tier usage and rate limits still apply.

## iPhone and Android installation

LifeOS is a standalone Progressive Web App (PWA), not a native App Store / Play Store application.

- **iPhone:** Open the HTTPS LifeOS website in Safari → Share → Add to Home Screen → open LifeOS from its own icon.
- **Android:** Open the HTTPS site in Chrome → menu → Install app or Add to Home Screen.
- The installed version uses a proper 180px iPhone icon and 192px/512px Android icons, an Android maskable icon, safe-area-aware navigation, and no external ads.
- Personal LifeOS records remain local on the installing device. A calendar subscription is **not** a backup of all your LifeOS data.

## Validation

Node unit tests exercise calendar privacy, ICS formatting, all-day events, input validation, and mobile app bundling. GitHub Actions runs the production build and checks output assets. Actual subscriptions should still be confirmed once on the deployed HTTPS Netlify site, including a test on iPhone/Android and one external calendar client. 
