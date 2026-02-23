# DESIGN.md — Money Shepherd Visual Identity

> This document defines the visual personality of Money Shepherd. All new screens, components, and UI decisions should reference this guide.

---

## Brand Personality

**Money Shepherd** is a faith-informed stewardship app. It guides — it doesn't guilt. It celebrates good decisions and gently redirects poor ones. The visual language should feel like a trusted advisor, not a corporate dashboard.

**Voice:** Warm, confident, unhurried
**Feeling:** A well-lit study with leather and wood — not a fluorescent office

### Personality Attributes

| Attribute | Expression |
|-----------|------------|
| Trustworthy | Warm gold tones, consistent spacing, no visual tricks |
| Guided | Clear hierarchy — the most important number is always obvious |
| Celebratory | Acknowledge wins (funded envelopes, inbox zero) without being showy |
| Calm | Generous whitespace, muted surfaces, no competing focal points |
| Faith-rooted | Scripture integration, stewardship language, shepherding metaphor |

---

## Color System

### Primary: Warm Gold (`#b8860b`)

Gold communicates wisdom, value, and warmth. It has biblical connotations (stewardship of talents, the golden rule) and distinguishes Money Shepherd from the sea of blue fintech apps.

### Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#b8860b` | Buttons, hero card, active tab, brand accents |
| `primaryDark` | `#946b09` | Pressed states, emphasis |
| `success` | `#2d7a4f` | Positive balances, income, funded envelopes |
| `error` | `#c0392b` | Negative balances, expenses, destructive actions |
| `warning` | `#d4880f` | Nudges, pending states, attention without alarm |

### Surfaces

Warm cream tones replace pure white. The app should feel like parchment, not a spreadsheet.

| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#fdfbf7` | Page background |
| `surfaceLight` | `#f5f0e8` | Card insets, alternating rows |
| `primarySurface` | `#fdf6e3` | Tinted highlights, scripture strip, info notices |
| `successSurface` | `#eef7f1` | Success feedback areas |
| `errorSurface` | `#fdecea` | Error feedback areas |
| `warningSurface` | `#fef8ec` | Warning feedback areas |

### Text

Warm darks replace pure black. Text should feel ink-on-parchment.

| Token | Hex | Usage |
|-------|-----|-------|
| `textDark` | `#2c2416` | Primary content, headings |
| `textMid` | `#5c4e3c` | Secondary content, descriptions |
| `textMuted` | `#8a7e6e` | Tertiary, timestamps, metadata |
| `textSubtle` | `#b5a898` | Placeholders, disabled labels |
| `textOnColor` | `#fff` | Text on primary/hero backgrounds |

---

## Typography

- **Hero numbers** (44sp, extrabold): One per screen max — the number that matters most
- **Titles** (28sp, extrabold): Screen/section headers
- **Subtitles** (16sp, semibold): Card headers, row labels
- **Body** (15sp, medium): Primary content
- **Small** (13sp): Secondary content, metadata, scripture
- **Caption** (12sp): Timestamps, footnotes

Use `LineHeight` tokens for multi-line text blocks. Single-line labels don't need explicit line height.

---

## Spacing & Layout

- **4-point grid**: All spacing uses multiples of 4 (`Spacing.xs` through `Spacing.xl`)
- **Horizontal margins**: `Spacing.base` (16dp) for screen-edge content
- **Card padding**: `Spacing.base` internal, `Spacing.md` for compact cards
- **Generous vertical rhythm**: Prefer `Spacing.lg` (24dp) between sections over `Spacing.base`

---

## Shadows

Three levels, all warm-tinted (shadow color `#2c2416` instead of pure black):

| Token | Usage |
|-------|-------|
| `Shadow.sm` | Subtle card lift, input focus |
| `Shadow.md` | Floating cards, dropdowns |
| `Shadow.lg` | Toasts, modals, overlays |

---

## Component Patterns

### Buttons

Use the `Button` component for all interactive actions. Four variants:

| Variant | When to use |
|---------|-------------|
| `primary` | Main CTA per screen (Save, Assign, Allocate) |
| `secondary` | Secondary actions (Cancel, See All) |
| `destructive` | Delete, remove, reset actions |
| `outline` | Tertiary actions, filter toggles |

### Cards

- Warm `surface` background with `Shadow.sm`
- `Radius.lg` corners
- No heavy borders — shadow provides separation

### Notices (InlineNotice)

- Left border accent (3dp) for quick scanning
- Tinted surface background matching the variant
- Actionable notices include a bold text link

---

## Do's and Don'ts

### Do

- Use the gold primary for the single most important action on each screen
- Let whitespace do the work — don't fill every pixel
- Use warm surfaces instead of pure white
- Keep hierarchy clear: one hero number, one primary button
- Use scripture and stewardship language in empty states

### Don't

- Use pure black (`#000`) or pure white (`#fff`) for backgrounds (use `textDark` / `surface`)
- Add competing CTAs — one primary button per screen
- Use blue (#4f8ef7) — that's the old identity
- Over-animate — motion should be purposeful (future phase)
- Mix warm and cool tones in the same surface

---

## Future Considerations

- **Dark mode**: Invert the warm palette (dark warm grays, gold accents preserved)
- **Celebratory animations**: Confetti/glow for milestones (Phase 22)
- **Illustration style**: Line-art shepherding motifs if illustration is added
