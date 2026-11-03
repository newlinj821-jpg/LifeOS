# LifeOS reference database — sources, licensing, and practical use

This documentation covers the **public reference database** included in LifeOS. It is intentionally separated from the user's personal tasks, journal, expense records, and notification subscriptions.

## How it works

1. The **Reference Library** is accessible from **All modules**, and it can be selected as a favorite area in Settings.
2. **51 original offline LifeOS starter templates** are bundled with the app and indexed in an on-device IndexedDB database. They include planning, household routines, pets, finances, meals, movement, travel, projects, and personal habits. These are original editable examples, not official guidance.
3. Food, exercise, and public holiday searches use **Netlify Functions** to query vetted public sources. No browser API keys or secrets are exposed.
4. A shared **Netlify Blobs cache** stores only source-derived public reference records and refresh times. A separate browser **IndexedDB** stores cached reference records and saved references for offline access.
5. A result shows its source, available details, and a **Use template**, **Log food**, **Add workout**, or **Add to calendar** action. Actions explicitly create entries in the local LifeOS personal database. They never import an entire reference corpus into the user's account or automatically schedule push notifications.
6. Search failures show a clear error and any cached local result; the UI never substitutes invented numbers. The library includes an independent reference export/restore control.

## Verified sources

### USDA FoodData Central — Food

Official website: https://fdc.nal.usda.gov/

API reference: https://fdc.nal.usda.gov/api-guide/

License: **CC0 1.0 / public domain**. USDA requests attribution to FoodData Central.

LifeOS uses the `/fdc/v1/foods/search` endpoint and normalizes calorie, protein, fat, carbohydrate, fiber, and sodium values where supplied. The standard display uses **per-100 g reference values**. Logging food requires the user to enter a portion in grams; LifeOS calculates the corresponding values. Verify record source, weight basis, and food preparation method. Missing nutrient fields remain unknown rather than being filled with zero.

**No paid subscription is required**, but production search benefits from a **free USDA API key**. Set `FDC_API_KEY` on the LifeOS Netlify site. Without it, LifeOS uses USDA's `DEMO_KEY`, officially restricted to **30 requests per IP per hour and 50 per IP per day**, so it is not intended for routine production use. Repeated queries can be served from a seven-day cache. A free personal key has its own published limits and is not unlimited.

### wger — Exercises

Official project: https://wger.de/

Official API docs: https://wger.readthedocs.io/en/latest/api/api.html

wger permits **anonymous public reads** from its `/api/v2/` exercise catalog. LifeOS uses wger's documented \`name__search\` filter with bounded result pages (up to 100 records per search), and extracts English titles, descriptions, equipment, categories, and muscles when provided. Search results may still be incomplete due to language and source filtering. A public-source link remains available and the app does not claim to provide expert exercise prescriptions.

wger exercise content and associated images may have licenses distinct from the software; this implementation **does not download or redistribute exercise images**. Users should consult the upstream project for its data licensing details before republishing any content.

### Nager.Date — Public holidays

Official API reference: https://nagerholidays.com/api

LifeOS uses the free Community API to look up a selected country/year. Holiday dates, countries, and national/regional status are retained. Local holiday coverage and jurisdictional observances should be confirmed with the relevant authority. The display date is used to create a LifeOS calendar entry; any time displayed in the Calendar is a placeholder, not a real holiday start time. Provider usage terms apply.

## Data isolation and security

- The public Netlify Blobs cache does **not** receive any LifeOS journal, medical, pet, spending, or other personal records.
- Public reference searches **do** send the user-entered lookup term to the requested external source, via the LifeOS server.
- Local personal data remains stored in the browser using the original LifeOS storage mechanism. The reference IndexDB database is **not cloud account synchronization**.
- Reference backups are separate from the existing LifeOS personal-record JSON backup. Keep both as needed.
- If browser storage is cleared, saved reference favorites and the local cache can be lost unless the reference backup is exported. Published offline starter templates remain available after reinstallation.
- All external endpoints are fixed in server-side code. User input is validated and cannot specify arbitrary upstream URLs.
- Cached public references carry source and retrieval timestamps. Stale information may appear if a public source is temporarily down.
- Netlify free-plan limits, external API rate limits, and provider availability can affect online lookups.

## Deployment and verification

The Netlify build exports the reference UI, style, offline starter data and reference database scripts to `dist/`, and bundles `netlify/functions/knowledge.mjs` with the site's Netlify Functions.

No API variables are required for wger or Nager.Date. To support frequent USDA searches, use the optional **free** `FDC_API_KEY` variable.

The GitHub CI workflow tests schema normalization, provenance, source import fields, reference search filtering, and the production build manifest. **Real upstream API availability and real-device usability must be verified on the deployed Netlify site**; successful syntax and unit tests do not prove network availability.
