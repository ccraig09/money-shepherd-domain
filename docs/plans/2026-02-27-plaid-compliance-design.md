# Phase 27.5: Plaid Compliance & Policies — Design

**Date:** 2026-02-27
**Status:** Approved
**Author:** Carlos Craig + Claude

## Context

Plaid's security questionnaire (completed 02/27/2026) generated 12 required attestations due 09/01/2026. The App Profile also requires a Website URL. These do not block production Plaid access but must be completed by the deadline.

### Current State

- **Company Profile:** Complete (CRAIG DEVELOPMENT LLC, address, billing contact)
- **App Profile:** Missing Website URL (required), placeholder icon
- **Data Security:** Questionnaire done; 12 remediation attestations pending

### Codebase Strengths (Already Passing)

- Plaid tokens encrypted at rest via `expo-secure-store` (iOS Keychain, AES-256)
- Access tokens never exposed client-side — token exchange in Cloud Functions only
- Plaid secrets in Firebase `defineSecret()`, never in client code
- App has PIN + biometric (Face ID/Touch ID) multi-factor authentication
- Privacy Policy and Data Retention Policy documents exist in repo
- Only requesting `[Products.Transactions]` — minimal data access

### Gaps Identified

1. No server-side `/item/remove` call when user disconnects bank
2. No explicit user consent dialog before opening Plaid Link
3. Privacy policy not published online or accessible in-app
4. No Information Security Policy, Access Control Policy, or Vulnerability Management Policy
5. No `onEvent` logging in Plaid Link for debugging
6. App icon placeholder on Plaid dashboard

## Approach

Single phase with 4 tiers, ordered by dependency. Policy docs live in repo root alongside existing `PRIVACY_POLICY.md` and `DATA_RETENTION_POLICY.md`. GitHub Pages hosts the public-facing versions.

## Tickets

### Tier 1 — Dashboard & Public Presence

| Ticket | What | Files |
|---|---|---|
| MS-27.5.1 | GitHub Pages site — host privacy policy + landing page, set URL in Plaid App Profile | gh-pages branch or new repo, Plaid dashboard |
| MS-27.5.2 | Verify 2FA on all internal services (GitHub, Firebase, Plaid, Apple Developer) | Policy doc only |
| MS-27.5.3 | App icon for Plaid dashboard (create/upload 1024x1024 PNG) | Asset file, Plaid dashboard |

### Tier 2 — Policy Documents

| Ticket | What | Files |
|---|---|---|
| MS-27.5.4 | Information Security Policy (ISP) — data handling, encryption, incident response | `INFORMATION_SECURITY_POLICY.md` |
| MS-27.5.5 | Access Control & Identity Management Policy — access grants/revokes, review cadence | `ACCESS_CONTROL_POLICY.md` |
| MS-27.5.6 | Vulnerability Management Policy — scanning, patching SLA, EOL, zero trust | `VULNERABILITY_MANAGEMENT_POLICY.md` |

### Tier 3 — Code Changes

| Ticket | What | Files |
|---|---|---|
| MS-27.5.7 | `/item/remove` Cloud Function — revoke Plaid access on disconnect | `functions/src/index.ts`, `connect-accounts.tsx` |
| MS-27.5.8 | Consent dialog before Plaid Link — data sharing explanation + privacy link | `connect-accounts.tsx` |
| MS-27.5.9 | In-app privacy & data policy screen in Settings | `app/settings/privacy.tsx` |
| MS-27.5.10 | Plaid Link `onEvent` logging — capture link_session_id + events | `plaidClient.ts` |

### Tier 4 — Attest on Dashboard

| Ticket | What |
|---|---|
| MS-27.5.11 | Check off all 12 attestations on Plaid Compliance Center |

## Attestation Mapping

| # | Attestation | Status | Unblocked By |
|---|---|---|---|
| 1 | MFA on consumer app | Attest NOW | PIN + biometric already implemented |
| 2 | Published privacy policy | After MS-27.5.1 | Need public URL |
| 3 | Information Security Policy | After MS-27.5.4 | Need ISP document |
| 4 | Centralized IAM | Attest NOW | Solo dev, single-account management |
| 5 | Automated de-provisioning | Attest NOW | Solo dev, N/A |
| 6 | Patches vulns within SLA | After MS-27.5.6 | Need written SLA |
| 7 | Vulnerability scanning | After MS-27.5.6 | Need documented process |
| 8 | EOL software monitoring | After MS-27.5.6 | Need documented process |
| 9 | Access control policy | After MS-27.5.5 | Need written policy |
| 10 | Periodic access reviews | After MS-27.5.5 | Need documented cadence |
| 11 | Zero trust architecture | After MS-27.5.6 | Need architecture documentation |
| 12 | MFA on internal systems | After MS-27.5.2 | Need to verify 2FA everywhere |

## References

- [Plaid Launch Checklist](https://plaid.com/docs/launch-checklist/)
- [Plaid Developer Policy](https://plaid.com/developer-policy/)
- [Plaid Security Questionnaire v6](https://gist.github.com/coolaj86/0c17836066362d812006314ffc36ef13)
- [HN: Plaid employee advice for solo devs](https://news.ycombinator.com/item?id=37617661)
