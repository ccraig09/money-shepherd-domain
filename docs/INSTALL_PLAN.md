# Install Plan — How Jackia Gets the App

> This doc explains how to build, install, and update Money Shepherd on Jackia's phone.

## Delivery Method

**EAS Development Build** (recommended for MVP)

- Uses `expo-dev-client` — supports all native modules (Plaid Link, SecureStore, etc.)
- Internal distribution via EAS — no App Store review needed
- Jackia registers her device UDID once, then receives OTA-like install links

Why not Expo Go? Expo Go cannot run custom native modules (`expo-dev-client`, Plaid Link). A dev build is required.

---

## One-Time Setup (Jackia's Device)

### 1. Register Jackia's device

```bash
# From repo root — prompts Jackia to visit a URL on her phone
eas device:create
```

Jackia taps the link, installs a provisioning profile, and her device UDID is registered with Apple.

### 2. Build the app

```bash
# Development build (includes dev tools + all native modules)
cd apps/mobile
eas build --profile development --platform ios

# Or preview build (no dev tools, closer to production)
eas build --profile preview --platform ios
```

Wait for the build to complete (~10-15 min on EAS servers).

### 3. Install on Jackia's phone

After the build completes:

1. EAS provides an install URL
2. Send the URL to Jackia (text/AirDrop)
3. Jackia opens the URL on her phone → taps "Install"
4. The app appears on her home screen

---

## How to Update

### Code changes (JS-only)

For JavaScript-only changes (no new native modules):

```bash
# Push an OTA update via expo-updates (if configured)
npx expo publish

# Or: rebuild and reinstall (always works)
cd apps/mobile
eas build --profile development --platform ios
# Send new install link to Jackia
```

### Native changes

If a new native module is added (new plugin in `app.json`), a full rebuild is required:

```bash
cd apps/mobile
eas build --profile development --platform ios
# Jackia reinstalls from the new link
```

---

## Environment Configuration

All environment variables are in `apps/mobile/.env` and use the `EXPO_PUBLIC_` prefix (safe for client exposure):

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_PLAID_ENV` | Plaid environment (`sandbox` / `production`) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |

**No secrets are hardcoded in source.** Plaid `CLIENT_ID` and `SECRET` live only in Cloud Functions env config (never in the mobile app).

The `.env` file is loaded by Expo at build time. EAS builds pick it up automatically.

---

## Troubleshooting

### App won't install

- **"Unable to install"** → Device UDID not registered. Run `eas device:create` again.
- **Provisioning profile expired** → Rebuild with `eas build`.

### App crashes on launch

1. Check if `.env` is present and has all required variables
2. Try: Settings → Reset Local Storage → re-setup
3. If persistent: export data first, then reinstall

### Sync not working

1. Both devices must use the **same Household ID**
2. Check Settings → Sync → Status (should show "Up to date" or "Synced")
3. Tap "Sync now" in Settings
4. If stuck: check internet connection, try toggling Airplane Mode

### Data looks wrong

1. Settings → Export Data (save a backup first)
2. Settings → Reset Local Storage
3. Re-setup with same Household ID (data pulls from Firebase)
4. If still wrong: Settings → Import Data (paste the backup)

### PIN forgotten

There is no PIN recovery — the only option is:

1. Delete and reinstall the app
2. Re-setup with the same Household ID (data syncs from Firebase)
3. Set a new PIN

---

## Build Profiles Reference

| Profile | Use case | Distribution |
|---------|----------|-------------|
| `development` | Daily dev + testing, includes dev tools | Internal (registered devices) |
| `preview` | QA / Jackia install, no dev tools | Internal (registered devices) |
| `production` | App Store submission (future) | Store |

---

## Quick Reference

```bash
# Register a new device
eas device:create

# Build for Jackia (preview = cleaner, no dev tools)
cd apps/mobile && eas build --profile preview --platform ios

# Build for dev/testing
cd apps/mobile && eas build --profile development --platform ios

# Start local dev server (your phone, with dev client installed)
cd apps/mobile && npx expo start --dev-client
```
