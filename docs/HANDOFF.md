# Handoff Doc — Money Shepherd (2026-03-07)

> Pick this up on any machine. Read top to bottom before writing any code.

---

## 1. Repo & Branch

```bash
git clone git@github.com:ccraig09/money-shepherd-domain.git
cd money-shepherd-domain
git pull origin main   # should land on a0fd513 or later
npm install
```

Branch: **main** — all work commits directly to main, no feature branches.

---

## 2. What Just Happened (Last Session)

### Production Bug Fixed (commit `a0fd513`)

After Jackia connected her bank via Plaid, three bugs caused:
- **Available to Assign** to inflate from ~$10k → $28,799 (wrong)
- **Duplicate "Share Savings"** accounts to appear (3 copies)
- **Reconcile Budget button** to be permanently greyed out

**Fixes shipped:**

| Bug | File | Fix |
|-----|------|-----|
| Re-seed formula was additive instead of recalculating from truth | `apps/mobile/app/seed-budget.tsx` | Changed to `allDepositoryTotal - totalInEnvelopes` |
| Name-based account dedup matched across household members | `apps/mobile/src/infra/plaid/mapAccounts.ts` | Added `userOwnedAccountIds` param to scope matching per user |
| Caller wasn't passing userId scope | `apps/mobile/app/settings/connect-accounts.tsx` | Now loads user's existing tokens and passes `userOwnedAccountIds` |
| `canSeed` gate blocked reconcile when all accounts already seeded | `apps/mobile/app/seed-budget.tsx` | Re-seed mode now gates on `allDepository.length > 0` |
| Multi-user household test coverage | `apps/mobile/src/infra/plaid/__tests__/mapAccounts.test.ts` | Added 3 new tests (18 total, all pass) |

### Build Status

The bug fixes are pushed. **No new build has been deployed yet** to Jackia's phone or the other devices. The next step is to build on a working Mac (not the one with the macOS 26 codesign issue) and install on all three devices.

**Three devices to install on:**
1. Los's iPhone 16 Pro Max (name: "Loso")
2. Jackia's iPhone 17 Pro Max (name: "Jackia Ranae") — UDID: `00008150-001574D82112401C`
3. iPad mini (name: "Loso pad mini")

---

## 3. How to Build (on a working Mac)

### Prerequisites

```bash
# Install deps
npm install

# iOS build requires Xcode + CocoaPods
npx expo run:ios --device "Jackia Ranae"
npx expo run:ios --device "Loso"
npx expo run:ios --device "Loso pad mini"
```

> **Note:** If Jackia's device shows "isn't registered in your developer account", open Xcode → `apps/mobile/ios/` → Signing & Capabilities → click **Register Device**.

### macOS 26 + Xcode 26 codesign workaround (if needed)

If you see `errSecInternalComponent` / "unable to build chain to self-signed root":

```bash
# Download Apple Root CAs
curl -O https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer

# Import into login keychain (run each separately — no sudo)
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db AppleRootCA-G3.cer
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db AppleWWDRCAG3.cer

# Then retry the build
```

---

## 4. First Thing to Do After Installing the Build

On **any device**, go to: **Settings → Reconcile Budget**

The screen will show the re-seed option. Tap "Set Available to $X,XXX" to correct the inflated Available to Assign. This is a one-time fix and syncs to all devices via Firebase.

---

## 5. Current Ticket Status

### Active Phase: 27.6 — Multi-Device Account Merge Fix

```
[x] MS-27.6.1  Pull latest cloud state before importing Plaid accounts
[ ] MS-27.6.2  Verify fix with both-users-connect scenario (manual test)
```

**MS-27.6.2 is just a smoke test** — no code changes needed. Steps:
1. Los connects a bank on his phone → verify accounts sync to Firestore
2. Jackia connects her bank on her phone → verify both users' accounts preserved (not overwritten)

### Phase 27.6 Smoke Check

```
[ ] Los connects bank on Device A → state syncs to Firestore
[ ] Jackia connects bank on Device B → both Los's and Jackia's accounts preserved
```

### Next Phase After 27.6

Look at `PHASE_PLAN.MD` for what comes after. Run:

```bash
gh issue list --state open
```

---

## 6. Dev Workflow

```
/next   → start the next PHASE_PLAN.MD ticket (use Opus model)
/go     → implement after plan approved (use Sonnet model)
/done   → close GH issue, mark [x] in PHASE_PLAN.MD, commit, push
/fix    → debug failing checks (use Opus model)
```

**One ticket per session. Plan first, then implement.**

---

## 7. Required Checks Per Ticket

| What changed | Check to run |
|---|---|
| `packages/domain/**` | `npm test -w @money-shepherd/domain` |
| `apps/mobile/**` | `npm run lint -w @money-shepherd/mobile` |
| `apps/mobile/**` | `npx tsc -p apps/mobile/tsconfig.json --noEmit` |
| UI changes | `npx expo start --ios` (boot check) |

---

## 8. Skills Installed (on this machine at `~/.claude/skills/`)

All of these are already installed and ready:

**Project-relevant:**
- `react-native-architecture` — default for all mobile tickets
- `solid` — domain/engine tickets
- `firebase` — sync/auth tickets
- `plaid-fintech` — Plaid integration tickets
- `design-md` — design system work
- `git-pushing` — commit/push hygiene

**Workflow:**
- `find-skills` — discover new skills
- `using-gh-cli` — GitHub CLI patterns

**Custom slash commands** (at `~/.claude/commands/`):
- `done.md`, `go.md`, `next.md`, `fix.md`

### Skills NOT installed (but noted as missing in memory)

These were flagged as missing but **not critical for Phase 27.6**:
- `solid` — actually IS installed (checked above)
- `github-actions-templates` — not needed until CI work
- `context7-auto-research` — useful for unknown APIs
- `prisma-expert` — not used in this project
- `react-components` — not needed

To install a skill: visit [claude.ai/skills](https://claude.ai/skills) or ask Claude to `/find-skills`.

---

## 9. Key File Map

| File | Purpose |
|------|---------|
| `PHASE_PLAN.MD` | Living ticket checklist |
| `CLAUDE.md` | Agent rules — read this first |
| `DEV_CHEATSHEET.md` | Device UDIDs, Firebase project, Plaid sandbox creds |
| `apps/mobile/app/seed-budget.tsx` | Reconcile Budget screen (just fixed) |
| `apps/mobile/src/infra/plaid/mapAccounts.ts` | Plaid → domain account mapper (just fixed) |
| `apps/mobile/app/settings/connect-accounts.tsx` | Plaid Link UI (just fixed) |
| `apps/mobile/src/domain/engine.ts` | Central state coordinator |
| `apps/mobile/src/domain/commands.ts` | Pure AppState mutations |
| `apps/mobile/src/store/useAppStore.ts` | Zustand store |

---

## 10. Known Issues (Pre-existing, Not Regressions)

- TS error in `apps/mobile/src/infra/firebase/firebaseClient.ts`: `getReactNativePersistence` not exported from `firebase/auth` — **do not flag as a regression**, it's pre-existing and the app runs fine.

---

## 11. Plaid Notes

- Plaid access tokens are **device-local** (SecureStore/Keychain) — they do NOT sync via Firebase. This is intentional.
- Account data (balances, transactions) DOES sync via Firebase.
- Jackia must connect her banks from **her own device** — Los cannot do it for her.
- After the fixed build is installed, the account dedup bug is patched. Reconnecting banks will no longer create duplicates or merge across users.

---

*Generated 2026-03-07. Resume with: `cd money-shepherd-domain && git pull && claude`*
