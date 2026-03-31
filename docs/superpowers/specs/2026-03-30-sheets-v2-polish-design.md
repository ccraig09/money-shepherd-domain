# Money Shepherd Sheets v2 — EZ View, Category Fix, Mobile Polish

**Date:** 2026-03-30
**Status:** Design approved

## Context

Money Shepherd Sheets v1 is working: auto-categorization, per-company bill tracking, budget progress with last-month comparison, Paycheck Planner, and Category Detail tab. Three improvements are needed before real daily use.

## 1. Wife's EZ View Tab (Scorecard)

New tab: **📱 EZ View** — the simplest possible summary for the wife.

**Layout (2 columns, A+B, no scrolling on phone):**

| Row | A | B |
|-----|---|---|
| 1 | MARCH 2026 | (merged) |
| 2-3 | **$6,218** (gold, 28pt) | cash on hand |
| 4 | Safe to spend | **$XXX** (green, bold) |
| 5 | | |
| 6 | Money in | $3,138 |
| 7 | Money out | $6,184 |
| 8 | Bills left | $150 |
| 9 | Her balance | $23 |
| 10 | His balance | $11 |
| 11 | | |
| 12 | Tax fund (don't touch) | $6,218 (gray) |
| 13 | | |
| 14 | Payday in X days | (blue) |

**Formulas:**
- Cash on hand: `=Dashboard!C14` (Shared account = SoFi Checking + Savings + Emergency)
- Safe to spend: `=(Dashboard!C12 + Dashboard!C13)` minus total unpaid bills from Paycheck Planner. This is Navy Fed (Los) + Wife checking, minus bills still owed. The REAL spending number.
- Money in/out: `=Dashboard!B8` / `=Dashboard!C8`
- Bills left: reference Paycheck Planner "TOTAL STILL OWED" cell
- Her balance: `=Dashboard!C13`
- His balance: `=Dashboard!C12`
- Tax fund: `=Dashboard!C14` (shown in gray, muted — clearly labeled "don't touch")
- Payday: same formula as Mobile Home

**Design rules:**
- Column A: 160px, labels, left-aligned
- Column B: 160px, values, right-aligned
- Read-only (protected)
- No emojis except payday clock
- Large font for hero (28pt), medium for list (14pt), small for tax fund (10pt)
- Background: light gray (#F8F9FA), hero card: gold (#C5A059)

## 2. Category Fine-Tuning

### Fix rent date
The March 2 PMI charge ($2,522.95) was actually paid Feb 28 — bank delayed posting. The deploy script should fix this:
- Find transaction where Description contains "Pmi Green Countr" AND Amount = -2522.95 AND Date = March 2, 2026
- Change the Date to February 28, 2026
- This drops March spending by ~$2,523 and corrects February totals

### Category editing workflow
No new features needed. The workflow is:
1. Open **Category Detail** tab to see what's in each bucket
2. Find something wrong → go to **Transactions** tab → Ctrl+F the merchant → edit Category column (D)
3. All dashboards update instantly

The deploy script should NOT clear/re-categorize existing data anymore (the "Step 8: Clear old categories" block should be removed after this deploy). Future deploys should only assign categories to NEW transactions with empty Category cells.

## 3. Mobile Polish

### Fix fragile row references
The 📱 Home tab hardcodes `Dashboard!C12`, `Dashboard!C13`, `Dashboard!C14` for balance rows. If Dashboard layout changes, mobile breaks. Fix: use named ranges or add a hidden lookup row on Dashboard that mobile can reference safely.

**Pragmatic fix:** Add row-reference comments in the code, and use a constant at the top of `buildMobileHome_` that maps owner → Dashboard row. If Dashboard changes, only one place to update.

### Fix "Left Over" text cutoff
Dashboard column D (90px) is too narrow for "-$5,568". Widen to 110px.

### Fix scripture not showing
Dashboard row 2 has the scripture but it scrolls off. The frozen rows should be set to row 5 (after month selector) so scripture + month are always visible.

### Fix "1 days" grammar
Payday formula: `IF(days=1, "1 day", days&" days")` — handle singular.

### Remove the re-categorize step
Remove the "Step 8: Clear old categories" block from `deployMoneyShepherd()`. Future deploys should preserve existing category assignments and only fill empty cells.

## Tab Order After Changes

Desktop: Dashboard, Review Queue, Budget, Category Detail, Trends, Settings, Scripture
Mobile: 📱 Home, 📱 EZ View, 📱 Review, 📱 Budgets

EZ View goes right after Home in the mobile section.

## Verification

1. Deploy script → check 📱 EZ View tab shows correct numbers
2. Verify "Safe to spend" = Los + Wife cash minus unpaid bills
3. Verify tax fund shows SoFi balance in gray
4. Check March spending dropped after rent date fix
5. Verify frozen rows on Dashboard (scripture + month visible on scroll)
6. Verify "1 day" singular on payday
7. Open Google Sheets app on phone → check 📱 EZ View readability
