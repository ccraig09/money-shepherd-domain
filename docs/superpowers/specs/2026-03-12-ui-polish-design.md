# UI Polish & Navigation Redesign — Design Spec

**Status:** RESEARCH COMPLETE — component decisions finalized from Mobbin competitor analysis (2026-03-13)
**Date:** 2026-03-12
**Sub-project:** A + B (UI Polish + Navigation) from the master decomposition

## Context

Money Shepherd has strong functionality but looks like a developer tool, not a consumer app. The goal is to make it visually competitive with modern fintech apps (YNAB, Copilot, Monarch) while preserving the faith-rooted stewardship identity. The user's wife (and future users) should want to open it.

## Master Decomposition (All Sub-projects)

| # | Sub-Project | Status |
|---|-------------|--------|
| **A+B** | **UI Polish + Navigation Redesign** | **IN PROGRESS** |
| C | Couples Financial Model (personal/shared envelopes, paycheck splitting, huddle view) | Future — additive, no breaking changes |
| D | Transfer Edge Cases (joint accounts, cross-platform transfers) | Future — testing/validation |
| E | Tax Tracking (LLC, write-offs, joint filing) | Future — new data model fields |
| F | Email Integration & Receipt Matching | Future — new infrastructure |
| G | Purchase Analytics & Item Tracking | Future — builds on F |

## Decisions Made

### Visual Direction: Warm Premium + Playful
- Keep the gold/cream stewardship identity but elevate it
- Add celebratory energy — confetti on goals, sparkles on milestones, haptics
- Think: premium leather journal that throws confetti when you pay off debt

### Navigation Architecture: Top Bar + 4 Tabs + FAB

**Three-layer system:**

| Layer | Elements | Behavior |
|-------|----------|----------|
| **Top Bar** | Logo + "Money Shepherd" (left), Inbox icon with red badge + Profile avatar (right) | Persistent on all tab screens |
| **Bottom Tabs** (Floating Pill) | Home, Envelopes, Activity, Insights | Dark warm bar (#2c2416), floating 12px from bottom, 24px radius. Gold pill highlight on active tab. |
| **FAB** | Gold ✦ button | 48px circle above tab bar right side. Opens Chat screen. |

**Tab changes:**
- Inbox tab → REMOVED. Becomes top-bar icon with badge. Same screen opens on tap.
- Transactions tab → RENAMED to "Activity". Same screen, better name.
- Settings tab → REMOVED. Opens from profile avatar in top bar. Same screens inside.
- Insights tab → NEW. Houses all analytics moved from Home screen.

### Home Screen: Dashboard Lite (5-8 cards max)

**Removed from Home (→ Insights tab):**
- SpendingDonutCard
- MonthlyTrendCard
- CashFlowForecastCard
- MonthlyReviewCard
- WeeklyNudgeCard
- "Ask Money Shepherd" card (replaced by FAB)
- Envelopes preview section (redundant with Envelopes tab)

**Kept on Home (redesigned):**
- Greeting + envelope health summary
- "Available to Assign" hero card (gradient, large number)
- Quick stats row: Income | Spent | Net (compact)
- Action nudges (unassigned txs, fill envelopes, seed budget)
- Quick actions: Expense, Income, Allocate (pill buttons)
- AccountsCard (collapsible, grouped by owner)
- ScriptureStrip (warm accent)
- Debt Freedom progress bar (compact)

### Tab Bar Style: Floating Pill
- Dark warm background (#2c2416)
- Floating 12px from bottom edge, 16px from sides
- 24px border radius
- Active tab: gold pill highlight (rgba(184,134,11,0.2)) + gold text
- Inactive tabs: muted text (#b5a898)
- Warm shadow: 0 8px 24px rgba(44,36,22,0.25)

### Screen Redesigns

**Insights (NEW):**
- All analytics in one scrollable screen
- Spending donut FIXED: center shows "$X of $Y" (not just "$X spent"), legend shows category + amount + %, footer shows "X% used · Y days remaining"
- Monthly trend bars, cash flow forecast, debt progress, monthly review

**Activity (was Transactions):**
- Filter chips: All | Expenses | Income | Transfers | Pending | Unassigned (with count)
- Month picker with arrows (← March 2026 →)
- Envelope name shown below merchant when assigned
- Search bar stays

**Envelopes:**
- Card-based rows (mini-cards, not flat list rows)
- Thicker progress bars (6px, gradient gold→green)
- Goal celebration: confetti on 100%
- Swipe-right to quick-allocate

**Chat (via FAB):**
- Full-screen modal, slides up from FAB with spring animation
- Chat history icon in header (not buried in Settings)
- Pill-shaped suggested chips with gold outline
- Animated gold dots typing indicator

**Inbox (Top Bar):**
- Same screen, new entry point (top-bar icon)
- Modal/sheet presentation from top-right
- Celebratory empty state: "All caught up! ✨"

## Competitor Research Findings (2026-03-13)

### YNAB (closest competitor model)
- **Tab bar**: Standard 5-tab bottom (Plan, Accounts, Transaction, Reflect, Help)
- **Envelope rows**: emoji + name LEFT | colored amount badge RIGHT | full-width progress bar BELOW row
- **Amount badge colors**: green pill = funded, gray = $0/unfunded, orange = needs attention
- **Hero card**: Full-width sticky banner: green when "Ready to Assign", red/pink when "Assigned Too Much"
- **Groups**: Collapsible with chevron, "Available to Spend" column header on right
- **Progress bar**: Medium thickness (~3-4px), full-width, below each row, solid green
- **Typography**: Clean, functional, cream/off-white background (#f5f0e8)

### Copilot (premium fintech benchmark)
- **Nav**: Horizontal scrollable top tabs (NOT bottom)
- **Budget visual**: Donut circles per category
- **Category rows**: dot + emoji + name | SPENT $ | thin horizontal bar | BUDGET $
- **Hero**: Large donut + "$X spent so far / $Y total budget"
- **Color**: Rich blue header (#1B4FD8) + white content cards

### Design Differentiation
- **Floating pill tab bar** — neither competitor does this (real differentiator)
- **Warm gold/cream palette** — YNAB uses cold blue/green, Copilot uses corporate blue
- **YNAB row pattern adopted** — emoji + name + badge + full-width bar below, but upgraded (6px, gradient)
- **Donut circles** → reserved for Insights tab (like Copilot), NOT envelope list

## Component Upgrades (FINALIZED)

### Buttons
- **Shape**: Pill (`borderRadius: 999`)
- **Primary**: Gold gradient fill (`#b8860b` → `#d4a017`) + white text
- **Secondary**: Warm cream fill (`#fdf6e3`) + dark gold text
- **Press animation**: `scale(0.97)` + shadow reduce
- **Shadow**: `0 2px 8px rgba(184,134,11,0.25)`

### Cards
- **Background**: Warm white (`#fdf9f0`) with subtle gradient
- **Border radius**: 18px (up from 14px)
- **Shadow**: `0 4px 16px rgba(44,36,22,0.10)`
- **Padding**: 20px (up from 16px)
- **Hero cards**: 2px gold gradient top border accent

### Envelope Rows (Envelopes screen)
- **Layout**: [emoji icon] [name] (left) | [amount badge] (right)
- **Sub-text**: "$X.XX more needed" OR "Funded" (warm muted, 12px)
- **Progress bar**: 6px height, full-width, below the row content, rounded ends
- **Bar fill**: Gradient `#b8860b` (gold) → `#2d8a4e` (green) as progress increases
- **Bar glow**: `0 1px 4px rgba(184,134,11,0.3)` on filled portion
- **Amount badge**: Pill shape — gold bg when funded, muted gray when $0

### Hero Card (Available to Assign)
- **State: Normal**: Warm gold gradient bg, large amount in cream/white, "Ready to Fill" label
- **State: Surplus**: Deeper gold, "✦ Ready to Fill" with animated sparkle
- **State: Over-assigned**: Soft red (`#e84040`), "Assigned Too Much" with warning icon
- **Tap target**: Full row → navigates to fill-envelopes flow

### Progress Bars (standalone)
- 6px height (from 3px)
- Gradient fill: gold → green as % increases
- Glow shadow on fill
- Animated entrance (width 0 → full on mount)

### Badges & Chips
- Pill-shaped with tinted semantic backgrounds
- Filter chips: dark warm active state (`#2c2416`) with gold text + gold border
- Category badges: emoji + name, warm cream bg

### Section Headers
- Uppercase label (11px, semibold, textMuted `#8a7a6a`, 1.5px letter-spacing)
- Optional: 24px gold gradient underline accent on primary sections

### Celebration Moments
- Envelope reaches goal → confetti burst + "Goal reached!" toast
- All inbox cleared → sparkle sweep animation + "All caught up!"
- Debt paid off → full-screen gold confetti shower
- First budget seeded → animated welcome card

## Build Method: Hand-built in React Native

- All final code uses existing design token system
- Stitch prototyping skipped — competitor research gave enough clarity to implement directly
- Implementation plan: `docs/superpowers/plans/2026-03-13-ui-polish-navigation.md`

## Implementation Phases

| Phase | Focus | Risk |
|-------|-------|------|
| A | Component upgrades (tokens, Button, Card, ProgressBar) | Low — foundational |
| B | Tab bar + Navigation wiring (floating pill, top bar, FAB) | Medium — structural |
| C | Home screen redesign (Dashboard Lite) | Medium — content shuffle |
| D | Envelopes screen (row upgrades, group headers) | Low — visual only |
| E | Activity screen (filter chips, month picker) | Low — visual only |
| F | Insights tab (new screen, analytics moved from Home) | Medium — new screen |
| G | Chat screen (FAB modal) | Low — entry point change |
| H | Celebrations + animations | Low — additive |

## Safety Guarantees

- No domain model changes (packages/domain untouched)
- No engine/commands changes
- All existing routes preserved — only entry points change
- Data flow unchanged: Engine → Commands → Store → UI
- Existing screens' functionality preserved — only visual treatment changes
