# Access Control & Identity Management Policy

**Organization:** CRAIG DEVELOPMENT LLC
**Application:** Money Shepherd
**Effective Date:** March 4, 2026
**Last Reviewed:** March 4, 2026
**Next Review:** March 2027
**Owner:** Carlos Craig, Sole Developer & Owner

---

## 1. Purpose & Scope

This policy defines how access to systems, services, and data is granted, managed, reviewed, and revoked for Money Shepherd and all supporting infrastructure operated by CRAIG DEVELOPMENT LLC.

---

## 2. Access Control Principles

- **Least privilege:** Every account and service credential is granted the minimum permissions required for its function
- **Need-to-know:** Access to sensitive data (financial records, Plaid tokens) is restricted to systems that require it
- **Separation of duties:** Production secrets are managed through Firebase Secret Manager, not developer environment files
- **Defense in depth:** Multiple layers of authentication and authorization protect user data (see Section 7)

---

## 3. System Inventory

| System | Purpose | Auth Method | MFA |
|---|---|---|---|
| **GitHub** (ccraig09) | Source code, CI/CD, issue tracking | Password + 2FA | Yes |
| **Firebase / GCP** (money-shepherd) | Auth, Firestore, Cloud Functions, Secret Manager | Google account + 2FA | Yes |
| **Plaid** (CRAIG DEVELOPMENT LLC) | Bank data API, dashboard, compliance | Password + 2FA | Yes |
| **Apple Developer** | App Store distribution, signing certificates | Apple ID + 2FA | Yes |
| **Expo / EAS** | Build service, OTA updates | GitHub SSO | Yes (via GitHub) |
| **Domain registrar** | DNS for GitHub Pages | Password + 2FA | Yes |

---

## 4. Current Access Grants

CRAIG DEVELOPMENT LLC is a sole-developer organization. All system access is held by a single individual:

| Person | Role | Systems | Access Level |
|---|---|---|---|
| Carlos Craig | Owner / Sole Developer | All systems listed above | Administrator |

No other individuals, contractors, or automated systems have access to production systems or user data.

---

## 5. Access Provisioning Process

When a new team member or contractor requires access:

1. **Request:** Document the business justification and specific systems/permissions needed
2. **Approve:** Carlos Craig (owner) reviews and approves the request
3. **Grant:** Create accounts with the minimum required permissions
4. **Record:** Log the access grant in this policy document (Section 4) with the date, systems, and permission level
5. **Onboard:** Brief the new team member on this policy, the Information Security Policy, and acceptable use practices

### Service Account Provisioning

- Firebase service accounts use Google-managed keys (no manual key distribution)
- Plaid API credentials are stored in Firebase Secret Manager, not in code or environment files
- CI/CD (EAS Build) authenticates via project tokens with build-only permissions

---

## 6. Access Revocation Process

When an individual leaves the organization or no longer requires access:

1. **Immediate** (within 24 hours of departure):
   - Disable or delete accounts on all systems listed in Section 3
   - Rotate any shared secrets the individual had access to
   - Revoke SSH keys and API tokens associated with the individual
2. **Within 7 days:**
   - Audit recent activity logs for anomalies
   - Remove the individual from Section 4 of this document
   - Verify no orphaned permissions remain
3. **Document:** Record the revocation date and actions taken

### Automated De-provisioning

As a sole-developer operation, access management is currently manual. If the team grows beyond one person, CRAIG DEVELOPMENT LLC will implement:
- Centralized identity provider (Google Workspace or similar) for SSO
- Automated de-provisioning workflows triggered by offboarding

---

## 7. Periodic Access Review

Access reviews are conducted **quarterly** (January, April, July, October):

### Review Checklist

- [ ] Verify all accounts in Section 3 still have appropriate access levels
- [ ] Confirm no unauthorized accounts exist on any system
- [ ] Verify 2FA is enabled on all accounts
- [ ] Review Firebase IAM roles — confirm no overly permissive roles
- [ ] Review Plaid dashboard — confirm no unauthorized API keys
- [ ] Check GitHub repository access — confirm no unexpected collaborators
- [ ] Review Apple Developer team — confirm no unexpected members
- [ ] Verify Firestore security rules enforce per-user data isolation
- [ ] Check Cloud Functions for proper authentication enforcement
- [ ] Rotate any credentials approaching their rotation schedule

### Review Log

| Date | Reviewer | Findings | Actions Taken |
|---|---|---|---|
| March 4, 2026 | Carlos Craig | Initial policy creation | Verified 2FA on all services |
| _(next: June 2026)_ | | | |

---

## 8. Centralized Identity Management

All service accounts are managed through a single set of credentials controlled by Carlos Craig:

- **Primary identity:** Google account (used for Firebase/GCP, linked to Expo via GitHub SSO)
- **Secondary identities:** GitHub (ccraig09), Apple Developer, Plaid dashboard
- **Password management:** All passwords are unique, generated, and stored in a password manager
- **Session management:** Inactive sessions are automatically expired by each service's default policy

---

## 9. Policy Review

This policy is reviewed **annually** (or quarterly for the access review checklist) and updated whenever:
- A new team member joins or leaves
- A new system or service is added to the inventory
- A security incident reveals an access control gap
- The compliance environment changes

---

**Approved by:** Carlos Craig, Owner — CRAIG DEVELOPMENT LLC
**Date:** March 4, 2026
