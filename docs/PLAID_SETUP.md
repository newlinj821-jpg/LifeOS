# Connect Plaid to LifeOS — Netlify + iPhone / Android

LifeOS Money keeps manual income, expenses, savings transfers, and savings goals unchanged. Plaid is an **optional read-only banking connection** with accounts, transaction history, paycheck recognition, and carefully limited notifications.

**Important:** This feature has been implemented and unit-tested in the repository, but it is not connected to your Plaid account or live bank until you configure the site and complete Plaid Link. Never put a Plaid secret, owner key, or encryption key in GitHub.

## Step 1 — Check your Plaid account

1. Open https://dashboard.plaid.com and verify that you have **Trial or Production access**.
2. Use **Production** for your real checking/savings accounts. Sandbox is only for test banks; it does not access real money.
3. In Plaid Dashboard, find your **client ID** and **Production secret** in the API keys area.
4. Confirm the **Transactions** product is available. LifeOS reads accounts and transactions; it does not use Transfer or Auth/routing-number access.

The free Trial for eligible new US/Canada Plaid teams supports up to 10 production Items. A connected financial institution is an Item, and disconnecting it does **not** replenish the ten-Item lifetime allotment. Confirm the terms in your dashboard before linking repeatedly: https://plaid.com/docs/account/billing/

## Step 2 — Add the private environment variables to Netlify

Open your **LifeOS** site in Netlify, then **Project configuration → Environment variables**. Add these variables to the site's Functions and build environment; never put the values into frontend code, GitHub, or a screenshot.

| Variable | Required? | Value |
| --- | --- | --- |
| `PLAID_CLIENT_ID` | Yes | Client ID from Plaid Dashboard |
| `PLAID_SECRET` | Yes | **Production secret** from Plaid Dashboard; sandbox secret only for testing |
| `PLAID_ENV` | Yes | `production` for live bank data or `sandbox` for a test bank |
| `LIFEOS_BANK_SETUP_KEY` | Yes | Your **own random private owner key**, at least 24 characters; do not use your bank password |
| `LIFEOS_BANK_ENCRYPTION_KEY` | Yes | A random **64-character hexadecimal key** (32 bytes) to encrypt tokens and data at rest |
| `PLAID_WEBHOOK_URL` | Strongly recommended | `https://YOUR-LIFEOS-DOMAIN/.netlify/functions/plaid-webhook` |
| `PLAID_REDIRECT_URI` | Recommended for OAuth banks | `https://YOUR-LIFEOS-DOMAIN/`; register exactly this URL in Plaid |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For notifications | The same matching VAPID keys used by the regular LifeOS reminder system |

To generate the two LifeOS-only private values on a computer, use:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use the first output as the `LIFEOS_BANK_SETUP_KEY` and the second as `LIFEOS_BANK_ENCRYPTION_KEY`. Both should remain private. The second key must be exactly 64 hexadecimal characters. **Keep a safe copy of the encryption key:** changing or losing it after linking can make your encrypted bank vault unreadable.

If your Netlify site uses a custom domain, use the same origin consistently for redirects and webhooks. All services require HTTPS. After saving environment variables, **trigger a new Netlify deploy**.

## Step 3 — Register the OAuth redirect

For institutions that use OAuth (for example several large US banks), register the exact `PLAID_REDIRECT_URI` at **Plaid Dashboard → Build → API → Allowed Redirect URIs**. The URL passed to Link must be allowlisted.

**iPhone note:** For an OAuth bank, begin the connection in Safari using your LifeOS website URL. When redirected back, Plaid Link can resume in that same browser. The installed Home Screen PWA may use separate storage from Safari and may not recover the same Link session after an external bank-app redirect. Once the bank is connected server-side, you can open the installed LifeOS app and unlock the bank dashboard with your LifeOS owner key.

For simpler institutions, the Home Screen PWA may complete Plaid Link without leaving the app.

Plaid OAuth docs: https://plaid.com/docs/link/oauth/

## Step 4 — Connect accounts in LifeOS

1. Open **LifeOS → Money → Bank connection**.
2. Enter the `LIFEOS_BANK_SETUP_KEY` (not your Plaid API secret) to unlock your bank dashboard.
3. Select **Connect bank**, then complete the secure Plaid Link flow for your checking and/or savings institution.
4. When the bank is connected, choose **Refresh data**. Account details may arrive before transaction history.
5. You can review checking and savings balances, posted transactions, deposits, and paycheck history without modifying your manual budget.
6. To recover a bank that requires renewed permission, choose **Manage → Reconnect** rather than repeatedly removing and re-adding it.

LifeOS keeps the bank's encrypted access token on the Netlify server so background sync can continue when your phone is closed. The Money view itself uses a short-lived protected session and may ask you to unlock again after 12 hours.

## Step 5 — Set your exact paycheck amount

1. In **Money → Bank connection → Paychecks** (or **Alerts**), find **Your expected paycheck amount**.
2. Type the exact posted amount, down to the cent, and select **Save paycheck and alert settings**.
3. A posted incoming credit of **exactly that amount** qualifies as a paycheck. A larger or smaller credit is an **ordinary deposit**. Identified transfers and refunds are excluded.
4. LifeOS recognizes deposit descriptions including **VACP TREAS 310** and **XXVA BENEF**, but these labels do **not** override your exact amount.
5. The amount is separate from your manually entered **monthly income**. LifeOS will not double-count it in budget projections.

Example: if your expected paycheck is `$2,150.75`, a posted `$2,150.75` credit counts as pay; `$2,250.75` is a deposit.

## Step 6 — Enable paycheck notifications (optional)

1. Install LifeOS to your iPhone/Android Home Screen and open it as a standalone app.
2. Go to **LifeOS Settings → Notifications**, choose **Enable notifications**, and verify that your phone is connected. Use **Send a test** and confirm it appears on your phone.
3. Go back to **Money → Bank connection → Alerts**, choose **Connect this phone for bank alerts**.
4. Keep **Notify me when that paycheck is detected** on. Other-deposit alerts, large purchases, and low-balance alerts are **off by default**.
5. Set the expected paycheck amount and save the settings.

Paycheck notifications are triggered **only for newly detected posted deposits**, never for historical backfill or pending transactions. Bank notifications have **quiet hours of 10 PM–8 AM** and a limit of **two bank alerts per day**; the lock screen hides amounts unless you enable them. Turning off bank alerts does not disconnect your bank.

Web Push provider acceptance means a notification was accepted for delivery, **not guaranteed displayed**. iPhone Web Push requires an installed Home Screen PWA with permission. Real bank posting and Plaid's transaction availability can be delayed. LifeOS checks its Plaid webhook as new data becomes available and also has an approximately four-hour scheduled fallback; neither can force immediate posting.

## What remains manual or limited

- Checking/savings balances come from Plaid and may be delayed, especially for institutions with limited refresh.
- Manual bills, income, and savings planning are not overwritten by bank data.
- LifeOS does not initiate transfers, withdrawals, payments, or movement to savings.
- Advanced bank classification beyond the configured paycheck amount is an estimate. A merchant credit sharing the exact amount can still require your review.
- Free Plaid Trial status depends on your account's eligibility and Item usage. Do not assume all bank connections are available under your current plan.

If anything fails, open **Netlify → Deploys** and **Logs → Functions**, then review the logs for `plaid`, `plaid-webhook`, and `check-banks`. Look for error codes such as `INVALID_CREDENTIALS`, `ITEM_LOGIN_REQUIRED`, or `PRODUCT_NOT_READY`. Never send screenshots containing the actual secret, owner key, encryption key, or access token.
