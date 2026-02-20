# Plaid Integration Strategy

**Ticket:** MS-15.1
**Date decided:** 2026-02-20
**Status:** Adopted for Phase 15

---

## Decision

**Option chosen: Firebase Cloud Functions as minimal backend proxy ("A½")**

Mobile app → Cloud Functions → Plaid API → Firestore (access token, server-side only)

---

## Why not pure frontend-only (Option A)?

Plaid's `/link/token/create` endpoint requires `PLAID_SECRET`, a server-side credential. Embedding it in the mobile bundle would expose it to anyone who extracts the app binary. Plaid's own documentation prohibits this. Pure frontend-only is not viable even for MVP.

## Why not a full standalone backend (Option B)?

A dedicated Express/Node server is operationally heavier: separate deployment, separate hosting cost, separate auth layer. We already have Firebase in the project. Two Cloud Functions achieve the same security boundary with zero new infrastructure.

## Why Firebase Cloud Functions?

- Already using Firebase for auth + Firestore — no new infrastructure.
- Secrets stay in Cloud Functions environment config, never on the device.
- Access token stored in Firestore server-side (not readable by the mobile client via security rules).
- Migration to a standalone backend later is a URL swap — the mobile contract doesn't change.

---

## Architecture for Phase 15

```
Mobile App (react-native-plaid-link-sdk)
    │
    ├── calls  → Cloud Function: createLinkToken
    │                └── Plaid /link/token/create  (secret stays server-side)
    │                └── returns { link_token } to mobile
    │
    ├── opens  → Plaid Link UI (SDK handles OAuth + institution selection)
    │                └── on success: onSuccess({ public_token, metadata })
    │
    └── calls  → Cloud Function: exchangePublicToken
                     └── Plaid /item/public_token/exchange
                     └── stores access_token in Firestore (households/{id}/plaidItems/{itemId})
                     └── returns { item_id, institution_name } to mobile (NOT the access_token)
```

### What lives where

| Data | Location | Accessible to mobile? |
|------|----------|-----------------------|
| `PLAID_SECRET` | Cloud Functions env config | No |
| `PLAID_CLIENT_ID` | Cloud Functions env config | No |
| `access_token` | Firestore `plaidItems` (server-write only) | No (rules block read) |
| `item_id` | Firestore `plaidItems` | Yes (used for display) |
| `institution_name` | Firestore `plaidItems` | Yes |
| Mapped accounts | Firestore `households/{id}/accounts` | Yes |
| Mapped transactions | Firestore `households/{id}/transactions` | Yes |

### Cloud Functions in scope for Phase 15

| Function | Plaid endpoint | Purpose |
|----------|---------------|---------|
| `createLinkToken` | `/link/token/create` | Generates short-lived token for Link UI |
| `exchangePublicToken` | `/item/public_token/exchange` | Swaps public_token for access_token; persists to Firestore |
| `fetchAccounts` | `/accounts/get` | Pulls accounts for mapping |
| `syncTransactions` | `/transactions/sync` | Incremental transaction pull |

---

## Mobile SDK

`react-native-plaid-link-sdk` — Plaid's official React Native package. Handles the Link UI, OAuth redirect, and returns `public_token` + `metadata` via `onSuccess` callback.

Do NOT use a WebView-based approach or call Plaid's HTTP API directly from mobile.

---

## Plaid environment

- **Phase 15 (development):** `sandbox` environment, test credentials only.
- **Before production:** Switch to `production`. Requires Plaid approval.
- Environment is controlled by Cloud Functions env config (`PLAID_ENV=sandbox|development|production`).

---

## Transaction sync strategy

Use `/transactions/sync` (cursor-based, incremental) rather than `/transactions/get` (date-range polling). Store the cursor in Firestore alongside the item. This is more efficient and is Plaid's recommended approach for ongoing sync.

Webhooks (`TRANSACTIONS_SYNC_UPDATES_AVAILABLE`) will be wired in a later phase. For Phase 15, the user triggers sync manually (pull-to-refresh).

---

## Item error handling

When Plaid returns `ITEM_LOGIN_REQUIRED` (e.g., user changed their bank password), put the user through Link update mode with the existing `item_id`. This is handled by passing `access_token` from Cloud Functions back into a new `createLinkToken` call with `access_token` set.

---

## Multi-bank support (multi-item)

The Firestore schema (`plaidItems/{itemId}`) is a collection and supports multiple bank connections per household from day one. Both Los and Jackia can each connect multiple banks — each connection is a separate Plaid Item and a separate document.

**Phase 15:** Wires one connect flow (the architecture handles any number).
**Phase 15 stretch / Phase 16:** "Add another bank" UI — list all connected items, add/remove individual connections. No architectural rework required; UI only.

---

## Dev build requirement

`react-native-plaid-link-sdk` is a third-party native module and cannot run in Expo Go. A custom Expo dev client is required before MS-15.4 (Link flow) can be tested on device.

**This setup belongs in MS-15.2** alongside env + safety work:

1. `npm install expo-dev-client -w @money-shepherd/mobile`
2. Add `"expo-dev-client"` to `plugins` array in `app.json`
3. Run `eas build --platform ios --profile development` (one-time)
4. Install the `.ipa` on both devices (Los + Jackia)
5. Use `expo start --dev-client` for all subsequent development

After this one-time setup, day-to-day development works identically to before. Both devices share the same dev build output.

---

## Out of scope for Phase 15

- Webhooks (planned for Phase 17 sync work)
- Plaid Identity / Auth (ACH) — not needed yet
- Production Plaid environment — sandbox only
- Plaid webhook signature verification — deferred to Phase 19 hardening

---

## Future migration path (Option B)

If a full standalone backend becomes necessary (e.g., multi-tenant SaaS, cost control, custom auth), the mobile contract stays identical — only the Cloud Function URLs change to point at an Express server. The Firestore data model and domain mapping layer do not change. Estimated migration effort: 1–2 days.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Plaid sandbox rate limits during dev | Use test credentials; don't loop sync calls |
| Firestore rules must block direct client reads of `access_token` | Write rules in MS-15.2 before any token storage |
| `react-native-plaid-link-sdk` native module requires bare workflow or dev build | Confirm Expo dev build is configured (not Expo Go) |
| Cloud Functions cold start adds latency to Link flow | Acceptable for MVP; can warm with min-instances later |
