# Information Security Policy

**Organization:** CRAIG DEVELOPMENT LLC
**Application:** Money Shepherd
**Effective Date:** March 4, 2026
**Last Reviewed:** March 4, 2026
**Next Review:** March 2027
**Owner:** Carlos Craig, Sole Developer & Owner

---

## 1. Purpose & Scope

This policy establishes information security requirements for the development, operation, and maintenance of Money Shepherd, a personal envelope budgeting application. It applies to all systems, data, and services operated by CRAIG DEVELOPMENT LLC.

---

## 2. Data Classification

| Classification | Description | Examples |
|---|---|---|
| **Sensitive** | Financial data that could identify a user's spending or accounts | Bank account balances, transaction history, account names |
| **Confidential** | Credentials and tokens that grant access to systems or user data | Plaid access tokens, Firebase service account keys, API secrets |
| **Internal** | Application data that supports budgeting functionality | Envelopes, budget allocations, transaction assignments, user preferences |
| **Public** | Information intentionally published | Privacy policy, landing page, app store listing |

### Data We Handle

- **Financial transaction data** retrieved via Plaid (account names, balances, transaction amounts, merchant names, dates)
- **Budgeting data** created by the user (envelopes, allocations, assignments)
- **Authentication tokens** for Plaid and Firebase (stored securely, never exposed to client)
- **Anonymous session identifiers** for Firebase multi-device sync (no PII collected)

### Data We Do NOT Handle

- Bank login credentials (handled exclusively by Plaid)
- Social Security numbers, dates of birth, or government IDs
- Email addresses, names, or other personally identifiable information
- Credit scores or financial assessments

---

## 3. Encryption Standards

### At Rest

| Data | Storage | Encryption |
|---|---|---|
| Plaid access tokens | iOS Keychain via `expo-secure-store` | AES-256 (hardware-backed on iOS) |
| App budgeting data (local) | AsyncStorage | iOS Data Protection (file-level encryption) |
| Cloud-synced data | Google Firestore | AES-256 (Google-managed encryption at rest) |
| API secrets (Plaid, Firebase) | Firebase `defineSecret()` | Google Secret Manager (AES-256, envelope encryption) |

### In Transit

- All network communication uses **TLS 1.2+** (enforced by Firebase, Plaid, and Apple App Transport Security)
- Plaid Link uses its own encrypted channel for bank credential exchange
- Firebase Firestore connections use gRPC with TLS
- No unencrypted HTTP endpoints exist in the application

---

## 4. Incident Response Procedure

### 4.1 Detection

- Monitor GitHub Dependabot alerts for dependency vulnerabilities
- Monitor Firebase console for unusual authentication patterns
- Monitor Plaid dashboard for unexpected API activity
- Review `npm audit` output on every dependency update

### 4.2 Classification

| Severity | Definition | Response Time |
|---|---|---|
| **Critical** | Active data breach, credential compromise, or unauthorized data access | Immediate (within 1 hour) |
| **High** | Exploitable vulnerability in production, exposed secret | Within 24 hours |
| **Medium** | Vulnerability with no evidence of exploitation | Within 7 days |
| **Low** | Informational finding, best-practice deviation | Next development cycle |

### 4.3 Containment

1. Revoke compromised credentials immediately (rotate Plaid secrets, Firebase keys)
2. If Plaid tokens are compromised: call `/item/remove` for affected items
3. If Firebase is compromised: disable affected authentication providers
4. Deploy patched code via EAS Update (OTA) for client-side fixes

### 4.4 Notification

- **Users affected by a data breach:** Notify within 72 hours via app update and/or App Store release notes
- **Plaid:** Notify via developer support if Plaid-related data is involved
- **Apple:** Follow App Store data breach notification requirements

### 4.5 Recovery

1. Confirm the vulnerability is patched and the attack vector is closed
2. Audit logs to determine scope of impact
3. Document the incident: timeline, root cause, remediation, lessons learned
4. Update this policy if the incident reveals a gap

---

## 5. Developer Security Practices

CRAIG DEVELOPMENT LLC is a sole-developer operation. The following practices apply to Carlos Craig:

### Device Security

- Development machines use FileVault (full-disk encryption)
- Devices are protected with strong passwords and biometric authentication
- Automatic screen lock is enabled (5-minute timeout)
- macOS firewall is enabled

### Code Security

- All code is hosted on GitHub with 2FA enabled on the account
- Secrets are never committed to the repository (enforced via `.gitignore` and `.env` patterns)
- Plaid API secrets are stored exclusively in Firebase Secret Manager
- Code changes are reviewed before merging to `main`

### Account Security

- All critical services use unique, strong passwords managed by a password manager
- Multi-factor authentication (2FA) is enabled on: GitHub, Firebase/GCP, Plaid, Apple Developer
- See `ACCESS_CONTROL_POLICY.md` for the full system inventory and access review schedule

---

## 6. Third-Party Services

| Service | Purpose | Security Posture |
|---|---|---|
| **Plaid** | Bank account connection and transaction retrieval | SOC 2 Type II certified, PCI DSS compliant, ISO 27001 |
| **Google Firebase** | Anonymous authentication, Firestore database, Cloud Functions, Secret Manager | SOC 1/2/3, ISO 27001/27017/27018, FedRAMP |
| **Apple** | App distribution (App Store), device security (Keychain, Secure Enclave) | SOC 2, ISO 27001, hardware-backed encryption |
| **GitHub** | Source code hosting, CI/CD, dependency scanning (Dependabot) | SOC 1/2, ISO 27001 |
| **Expo/EAS** | Build service and OTA updates | SOC 2 Type II |

All third-party services are evaluated for:
- Industry-standard security certifications
- Data encryption at rest and in transit
- Incident notification practices
- Data processing agreements where applicable

---

## 7. Policy Review

This policy is reviewed **annually** or whenever a significant change occurs to:
- The application's data handling practices
- The third-party services used
- The regulatory or compliance environment
- The team structure (e.g., hiring additional developers)

---

**Approved by:** Carlos Craig, Owner — CRAIG DEVELOPMENT LLC
**Date:** March 4, 2026
