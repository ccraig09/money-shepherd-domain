# Money Shepherd — Google Sheets Budget Tool

**Date:** 2026-03-29
**Status:** Design approved, pending implementation plan

## Context

Carlos and his wife use Tiller to auto-import bank transactions into Google Sheets. The existing spreadsheet ("Craig Finances") has partially broken custom tabs from multiple AI agents that were applied without visual verification. Dashboard formulas are empty, Review Queue dates render as serial numbers, and 8,510 transactions sit unreviewed. The goal is to rebuild the Money Shepherd layer on top of Tiller as a clean, wife-friendly budget tool with separate mobile and desktop views.

**Spreadsheet:** `Craig Finances` (Google Sheets, Tiller Foundation Template)
**Accounts:** SoFi Checking/Savings (Shared), SoFi Robo (Carlos), Chime Checking/Savings (Carlos), Main Checking (Carlos), Visa Signature cashRewards Plus (Carlos), EveryDay Checking (Wife), Share Savings (Wife), Emergency Fund (Shared)
**Payday:** Bimonthly — 15th and last day of month

## Architecture

**Approach:** Apps Script + Smart Automation

- One comprehensive Google Apps Script handles all automation (auto-assignment, outlier detection, tab creation, triggers)
- Dashboard and mobile tabs use native Sheets formulas for live display
- The script writes to custom columns; formulas read from them
- Tiller's columns are never modified by the script

## Tab Structure

### Desktop Tabs (full detail)

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Month selector, income/spending/net, quick balances, budget progress bars, alerts, top merchants |
| **Review Queue** | Transactions needing attention — outliers first, then uncategorized, then unreviewed. Filterable. |
| **Budget** | Monthly targets per category with progress bars. Light envelope system. |
| **Trends** | Month-over-month spending charts (SPARKLINE). Category breakdown over time. |
| **Settings** | Account Map, category list, budget targets. All config in one place. |
| **Scripture** | Daily financial wisdom (10 verses, random display). |

### Mobile Tabs (phone-optimized)

| Tab | Purpose |
|-----|---------|
| **📱 Home** | 2 columns max. Hero net margin, quick balances (Carlos/Wife/Shared), budget health (🟢🟡🔴), alert count, payday |
| **📱 Review** | 3 columns: Date, Description (truncated), Amount. Large row height for tap-friendliness. |
| **📱 Budgets** | Category + spent/target + traffic light dots. Vertical scroll. |

### Deleted (broken from prior AI work)

- Old Dashboard, old Review Queue, Home, Inbox, Library, Review Mobile, old Account Map

### Hidden (Tiller system — never touched)

- Transactions, Accounts, Categories, Balance History, Spending Trends, Balances, Monthly Budget, Yearly Budget, Tiller.HiddenMetadata, Household Config

## Dashboard Layout (Desktop)

Top to bottom, columns B-D (A is left margin, E+ is unused):

1. **Scripture** — merged B2:D2, random verse from Scripture tab, gold border
2. **Month Selector + Payday** — side by side. Month is the ONLY editable cell (yyyy-MM format). Payday formula: days until the 15th or last day of month, whichever is sooner.
3. **Big Three** — Income | Spending | Net Margin in three cards. Net Margin uses gold background. All driven by SUMIFS against Transactions with date range from month selector.
4. **Quick Balances** — Los | Wife | Shared. Each shows combined balance from their accounts. Uses Tiller's hidden Balances sheet. Color-coded: green > $500, orange $100-500, red < $100.
5. **Budget Progress** — Top 6-8 categories with progress bars. Uses SPARKLINE for the bars. Conditional color: green < 70%, orange 70-100%, red > 100%.
6. **Alerts** — Count of outlier transactions, uncategorized, needs owner, over-budget categories.
7. **Top Merchants** — QUERY formula showing top 10 merchants by frequency this month.

### Key formulas

- **Income:** `=SUMIFS(Transactions!E:E, Transactions!A:A, ">="&DATEVALUE(monthCell&"-01"), Transactions!A:A, "<"&EDATE(DATEVALUE(monthCell&"-01"),1), Transactions!E:E, ">0", Transactions!V:V, "<>Yes")` (positive amounts, excluding transfers)
- **Spending:** Same pattern but `"<0"` and `ABS()` wrapper
- **Net Margin:** `=Income - Spending`
- **Balances:** `=SUMIFS(Balances!B:B, Balances!A:A, "*SoFi Checking*")` pattern against Tiller's hidden Balances sheet. Note: actual column layout of Balances sheet must be verified during implementation — Tiller's format may differ.
- **Date filtering:** Always use DATEVALUE with the month cell — never depend on Tiller's Month column format
- **Note:** Column letters in formulas above are illustrative. Implementation discovers columns by header name and computes letters dynamically.

## Mobile Home Layout (📱 Home)

Columns A-B only. All values right-aligned in column B.

1. Scripture (merged A1:B1)
2. **Hero card** — Net margin in large font (gold background)
3. Income / Spending (small text below hero)
4. **Quick Balances** — Los, Wife, Shared — three rows with large font values
5. **Budget Health** — Category + 🟢🟡🔴 + spent/target. No progress bars (too small on phone).
6. **Alert pills** — "3 outliers · 12 uncategorized · 1 over budget"
7. **Payday** — "Next payday in X days"

Font sizes: hero = 24pt, balances = 18pt, budgets = 12pt.

## Auto-Assignment Pipeline

Five-step pipeline that runs on all transactions. Only writes to empty custom columns — never overwrites manual edits.

### Step 1: Owner Assignment

- Read Account column from each transaction
- Look up against Account Map (contains match, not exact)
- Write Owner: "Los", "Wife", or "Shared" (matches existing Account Map convention)

### Step 2: Transfer Detection

- If Plaid Category Hint contains `TRANSFER_IN` or `TRANSFER_OUT` → Transfer? = "Yes"
- Also check Description for "From Savings", "To Checking", "From checking balance", "To Emergency Fund"
- Both checks combined with OR logic

### Step 3: Category Assignment

Priority order (first match wins):
1. **AutoCat rules** — Description contains match (existing rules in AutoCat tab)
2. **Plaid Category Hint mapping** — 30+ mappings from Plaid's taxonomy to budget categories

Plaid → Budget category mapping (key examples):

| Plaid Category Hint | Budget Category |
|---------------------|----------------|
| INCOME: INCOME_WAGES | Income |
| FOOD_AND_DRINK: *_FAST_FOOD | Eating Out |
| FOOD_AND_DRINK: *_COFFEE | Eating Out |
| FOOD_AND_DRINK: *_GROCERIES | Groceries / Household |
| GENERAL_MERCHANDISE: * | Shopping / Misc |
| MEDICAL: PHARMACIES_AND_SUPPLEMENTS | Health / Pharmacy |
| ENTERTAINMENT: *_TV_AND_* | Subscriptions |
| ENTERTAINMENT: * | Entertainment |
| TRANSPORTATION: *_GAS | Gas / Auto |
| TRANSFER_OUT: * | Transfers |
| TRANSFER_IN: * | Transfers |
| RENT_AND_UTILITIES: * | Bills / Utilities |
| PERSONAL_CARE: * | Personal Care |
| TRAVEL: * | Travel |

If no match from AutoCat or Plaid hints, category is left blank for manual review.

### Step 4: Spend Type Derivation

- Transfer? = "Yes" → Spend Type = "Ignore"
- Category = "Income" → Spend Type = "Ignore"
- Owner = "Shared" → Spend Type = "Household"
- Owner = "Los" or "Wife" → Spend Type = "Personal"

### Step 5: Outlier Detection

- Group transactions by Description (normalized: trimmed, lowercased)
- Calculate median amount per merchant
- If |amount| > 3 × median AND |amount| > $50 (minimum threshold to avoid noise) → write "⚡ OUTLIER" to Notes column
- Outliers are NOT auto-marked as Reviewed — they bubble to top of Review Queue

### Safety Rules

1. **Never overwrite**: Skip any cell that already has a value
2. **Never touch Tiller columns**: Only write to Owner (T), Spend Type (U), Transfer? (V), Reviewed (W), Notes (X)
3. **Idempotent**: Safe to run multiple times. Tab creation checks for existing tabs. Column addition checks for existing headers.
4. **Batch processing**: Read all data with `getValues()`, process in memory, write back with `setValues()`. Avoids Apps Script 6-minute timeout on 8,500+ rows.
5. **Column discovery**: Find columns by header name, not position. If Tiller adds columns, the script adapts.

## Budget System (Light Envelopes)

The **Budget** tab contains:
- Column A: Category name
- Column B: Monthly target amount
- Column C: Actual spent this month (SUMIFS formula)
- Column D: Remaining (= target - spent)
- Column E: % used (= spent / target)
- Column F: SPARKLINE progress bar with conditional color

Users edit column B to set targets. Everything else is formula-driven.

The **📱 Budgets** mobile tab shows: Category | 🟢🟡🔴 | Spent / Target

Budget categories should initially include: Groceries / Household, Eating Out, Subscriptions, Health / Pharmacy, Shopping / Misc, Gas / Auto, Bills / Utilities, Entertainment, Personal Care, Income (tracked but not budgeted).

## Review Queue

### Desktop

Filtered view showing transactions needing attention, sorted by priority:
1. Outliers (⚡ in Notes) — always first
2. Missing Category — needs categorization
3. Missing Owner — needs ownership
4. Reviewed ≠ "Yes" — needs sign-off

Columns: Date (formatted), Description, Amount, Account, Category, Owner, Spend Type, Notes

### Mobile (📱 Review)

Same data, fewer columns: Date | Description (truncated to 25 chars) | Amount
Row height increased for tap-friendliness.

## Trends Tab

- Month-over-month total spending (SPARKLINE line chart)
- Category breakdown: Last 3-6 months of spending per budget category
- Uses SUMIFS with varying month ranges
- Income vs Expenses trend line

## Settings Tab

Consolidates configuration:
- **Account Map** section: Account Name (contains) → Owner mapping
- **Budget Targets** section: Category → Monthly target amount
- **Category List**: Reference list of valid categories (used by data validation dropdowns)

This replaces the separate Account Map tab and centralizes config.

## Script Structure

```
moneyShepherd.gs
├── deployMoneyShepherd()      — Main entry: creates tabs, sets formulas, runs assignment
├── autoAssignTransactions()   — The 5-step pipeline
├── runAutoAssignNew()         — Trigger handler: only processes un-assigned rows
├── buildDashboard_(ss, col)   — Desktop Dashboard formulas
├── buildMobileHome_(ss, col)  — Mobile Home formulas
├── buildReviewQueue_(ss, col) — Review Queue filter formulas
├── buildBudget_(ss, col)      — Budget tab with targets + SUMIFS
├── buildMobileBudgets_(ss)    — Mobile budget view
├── buildTrends_(ss, col)      — Trends with SPARKLINE charts
├── buildSettings_(ss)         — Settings consolidation
├── detectOutliers_(data, col) — Median calculation + flagging
├── plaidToCategory_(hint)     — Category Hint → budget category mapping
├── onOpen()                   — Custom 🐑 Money Shepherd menu
├── refreshScripture()         — Force re-roll of scripture verse
└── helpers: colLetter_(), numToLetter_(), cardCell_(), styleSheet_()
```

## Custom Menu

The 🐑 Money Shepherd menu (appears on sheet open):
- **Deploy / Redeploy** — Full rebuild (creates tabs, sets formulas, runs assignment)
- **Auto-Assign New** — Process only unassigned transactions
- **Refresh Scripture** — Re-roll the daily verse
- **Re-run Outlier Check** — Recalculate outliers (useful after manual edits)

## Trigger

- **Time-driven trigger**: Every 4 hours, runs `runAutoAssignNew()` to process any new transactions Tiller synced.
- Created by `deployMoneyShepherd()` if not already present.

## Edge Cases & Risk Mitigation

| Edge Case | Mitigation |
|-----------|-----------|
| Tiller changes column order | Script discovers columns by header name, not position |
| Tiller adds new columns | Custom columns are always appended to the right; script re-reads headers |
| Transaction amount is $0 | Skip outlier detection (division by zero) |
| Merchant seen only once | No median to compare → skip outlier check for that merchant |
| Category Hint is empty | Fall through to AutoCat rules, then leave blank for manual review |
| Multiple Category Hints match | First match wins (AutoCat > Plaid hint) |
| Script timeout (6 min) | Batch reads/writes; 8,500 rows fits in one pass |
| Re-running on already-assigned data | Skip cells that already have values (idempotent) |
| Wife's balance goes low | Orange/red color on Quick Balances card (threshold: orange < $500, red < $100) |
| T-Mobile $800 one-time fee | Outlier detection flags it; user reviews and marks "Reviewed = Yes" |
| New account added to Tiller | User adds it to Account Map → next auto-assign picks it up |
| Payday falls on weekend | Formula shows actual date (no business day adjustment — keeps it simple) |

## Protection

- All formula cells are protected (only month selector is editable on Dashboard)
- Mobile tabs are fully protected (read-only views)
- Transactions custom columns use data validation dropdowns (prevents typos)
- Script runs with sheet owner permissions

## Verification Plan

1. **Pre-deployment**: Take a backup copy of the sheet (File → Make a copy)
2. **Deploy script**: Paste into Apps Script editor (Extensions → Apps Script), run `deployMoneyShepherd()`
3. **Verify tabs created**: Dashboard, Review Queue, Budget, Trends, Settings, Scripture, 📱 Home, 📱 Review, 📱 Budgets
4. **Verify auto-assignment**: Check Transactions tab — Owner, Spend Type, Transfer?, Notes should be populated
5. **Verify Dashboard**: Income, Spending, Net Margin should show real numbers. Quick Balances should show account totals.
6. **Verify mobile**: Open Google Sheets app on phone → tap 📱 Home → confirm readable at arm's length
7. **Verify Review Queue**: Should show dramatically fewer items (only true exceptions, not 8,500)
8. **Verify outliers**: Check Notes column for ⚡ OUTLIER flags — confirm they make sense
9. **Verify trigger**: Check Apps Script triggers — should see a 4-hour time-driven trigger for `runAutoAssignNew`
10. **Test month change**: Change month selector to 2026-02 → verify all dashboard numbers update
