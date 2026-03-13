# UI Polish Phase A: Foundational Component Upgrades

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade core design tokens and UI components (Button, Card, ProgressBar, SectionHeader, FilterChip) to match the finalized warm-premium visual direction — bigger radii, pill buttons, gradient progress bars, deeper shadows, and more generous padding.

**Architecture:** All changes are in `apps/mobile/src/ui/` only. Token values change in `tokens.ts`, then each component is updated to use the new tokens and add new visual features (gradients, press animations, glow shadows). No domain, engine, or navigation changes. Every existing component consumer keeps working — only visual output changes.

**Tech Stack:** React Native, Expo (no new dependencies — uses built-in Animated API for animations)

**Design spec:** `docs/superpowers/specs/2026-03-12-ui-polish-design.md`

**Testing policy:** UI-only polish — no automated tests required per CLAUDE.md. Verify visually via Expo dev server + iOS simulator.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/mobile/src/ui/tokens.ts` | Update Radius, Shadow values; add new color tokens |
| Modify | `apps/mobile/src/ui/components/Button.tsx` | Pill shape, press animation, warm shadow |
| Modify | `apps/mobile/src/ui/components/Card.tsx` | Larger radius, deeper shadow, more padding, hero variant |
| Modify | `apps/mobile/src/ui/components/ProgressBar.tsx` | 6px height, gradient fill, glow shadow, animated entrance |
| Modify | `apps/mobile/src/ui/components/SectionHeader.tsx` | Updated letter-spacing, muted color |
| Create | `apps/mobile/src/ui/components/FilterChip.tsx` | Reusable filter chip for Activity screen + anywhere else |
| Modify | `apps/mobile/src/ui/components/SuggestedChips.tsx` | Gold outline pill chips with press state |

---

## Chunk 1: Token & Component Upgrades

### Task 1: Update Design Tokens

**Files:**
- Modify: `apps/mobile/src/ui/tokens.ts`

- [ ] **Step 1: Update Radius values**

Change `Radius.xl` from 14 → 18 (new default card radius).

```typescript
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 18,       // was 14 — upgraded for cards
  hero: 20,
  pill: 999,
} as const;
```

- [ ] **Step 2: Update Shadow scale**

Deepen `Shadow.md` to match design spec card shadow (`0 4px 16px rgba(44,36,22,0.10)`).

```typescript
export const Shadow = {
  sm: {
    shadowColor: "#2c2416",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: "#2c2416",
    shadowOpacity: 0.10,        // was 0.08 — matches spec
    shadowRadius: 16,           // was 8 — matches spec "0 4px 16px"
    shadowOffset: { width: 0, height: 4 },  // was height: 2 — matches spec
    elevation: 5,               // was 4
  },
  lg: {
    shadowColor: "#2c2416",
    shadowOpacity: 0.12,        // was 0.1
    shadowRadius: 20,           // was 12 — deeper for hero cards
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,               // was 6
  },
} as const;
```

- [ ] **Step 3: Add new color tokens for gradients and components**

Add to both `lightColors` and `darkColors`:

```typescript
// In lightColors, add after existing colors:

// ── Gradient endpoints ─────────────────────
primaryGradientEnd: "#d4a017",       // gold gradient end (lighter gold)
successGradientStart: "#b8860b",     // progress bar gradient start (gold)
successGradientEnd: "#2d8a4e",       // progress bar gradient end (green — reuses success)

// ── Component-specific ─────────────────────
cardSurface: "#fdf9f0",             // warm white for upgraded cards
filterChipActive: "#2c2416",        // dark warm for active filter chips
filterChipActiveBorder: "#b8860b",  // gold border on active chips
heroOverAssigned: "#e84040",        // red for over-assigned hero state
```

```typescript
// In darkColors, add matching keys:
primaryGradientEnd: "#e8b830",
successGradientStart: "#d4a017",
successGradientEnd: "#4caf6a",
cardSurface: "#201c16",
filterChipActive: "#f0ebe4",
filterChipActiveBorder: "#d4a017",
heroOverAssigned: "#ef5350",
```

- [ ] **Step 4: Update the ColorTokens type**

The `ColorTokens` type is derived from `typeof lightColors`, so adding keys to `lightColors` automatically extends the type. Just ensure `darkColors` has all the same keys — TypeScript will error if not.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS (no errors — new keys are additive, `darkColors` has matching keys)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/ui/tokens.ts
git commit -m "feat(ui): upgrade design tokens for UI polish phase A

- Radius.xl: 14 → 18 for upgraded card radius
- Shadow.md/lg: deeper shadows for premium feel
- Add gradient color endpoints and component-specific tokens
- Both light and dark themes updated"
```

---

### Task 2: Upgrade Button Component

**Files:**
- Modify: `apps/mobile/src/ui/components/Button.tsx`

- [ ] **Step 1: Add press animation with Animated API**

Replace `Pressable` with `Animated.createAnimatedComponent(Pressable)` and add scale animation on press. Use React Native's built-in `Animated` (not reanimated — simpler, no extra dep for this).

```typescript
import React, { useRef } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Spacing, Radius, FontSize, FontWeight, Shadow, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Variant = "primary" | "secondary" | "destructive" | "outline";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const bgMap: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.primarySurface,
    destructive: colors.error,
    outline: "transparent",
  };

  const textMap: Record<Variant, string> = {
    primary: colors.textOnColor,
    secondary: colors.primary,
    destructive: colors.textOnColor,
    outline: colors.primary,
  };

  const borderMap: Record<Variant, string | undefined> = {
    primary: undefined,
    secondary: undefined,
    destructive: undefined,
    outline: colors.primary,
  };

  const bg = bgMap[variant];
  const textColor = textMap[variant];
  const border = borderMap[variant];

  const containerStyle: (ViewStyle | undefined)[] = [
    styles.base,
    { backgroundColor: bg },
    border ? { borderWidth: 1.5, borderColor: border } : undefined,
    variant === "primary" || variant === "destructive" ? styles.shadow : undefined,
    disabled ? styles.disabled : undefined,
    style,
  ];

  const labelStyle: (TextStyle | undefined)[] = [
    styles.label,
    { color: textColor },
    disabled ? styles.labelDisabled : undefined,
  ];

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[{ transform: [{ scale: scaleAnim }] }, ...containerStyle.filter(Boolean)]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={labelStyle.filter(Boolean) as TextStyle[]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    base: {
      borderRadius: Radius.pill,           // was Radius.lg (12) — now pill (999)
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    shadow: {
      shadowColor: c.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    label: {
      fontSize: FontSize.body,
      fontWeight: FontWeight.bold,
    },
    disabled: {
      opacity: 0.5,
    },
    labelDisabled: {
      opacity: 0.7,
    },
  });
```

Key changes from current:
- `borderRadius: Radius.lg` → `Radius.pill` (12 → 999)
- Added press scale animation (0.97 on press)
- Added warm shadow on primary/destructive variants (tinted with `c.primary`)
- Secondary bg changed from `surfaceLight` → `primarySurface` (warmer cream)
- Secondary text changed from `textDark` → `primary` (gold text on cream)
- Border width on outline: 1 → 1.5 for more presence

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint -w @money-shepherd/mobile`
Expected: PASS (no new lint issues)

- [ ] **Step 4: Visual check — boot Expo**

Run: `npm run dev:mobile`
Navigate to any screen with buttons (e.g., Settings → buttons, Home → quick actions). Verify:
- Buttons are pill-shaped (fully rounded ends)
- Press animation shows subtle scale-down
- Primary buttons have warm gold shadow
- Secondary buttons have cream bg with gold text

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/components/Button.tsx
git commit -m "feat(ui): upgrade Button to pill shape with press animation

- borderRadius: pill (999) for fully rounded ends
- scale(0.97) press animation via Animated API
- Warm primary shadow on solid variants
- Secondary: cream bg + gold text for warmer feel"
```

---

### Task 3: Upgrade Card Component

**Files:**
- Modify: `apps/mobile/src/ui/components/Card.tsx`

- [ ] **Step 1: Add shadow, padding prop, and hero variant**

```typescript
import React from "react";
import { View, Pressable, Animated, StyleSheet, type ViewStyle } from "react-native";
import { Spacing, Radius, Shadow, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
  /** Hero cards get a gold top border accent */
  hero?: boolean;
  /** Override default padding (default: 20) */
  padding?: number;
};

export function Card({ children, onPress, accessibilityLabel, style, hero, padding }: Props) {
  const styles = useThemedStyles(createStyles);

  const cardStyles: ViewStyle[] = [
    styles.card,
    hero ? styles.heroAccent : undefined,
    padding !== undefined ? { padding } : styles.defaultPadding,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...cardStyles, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    card: {
      marginHorizontal: Spacing.base,
      borderRadius: Radius.xl,                 // was 14, now 18
      backgroundColor: c.cardSurface,          // warm white (#fdf9f0)
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderLight,
      overflow: "hidden",
      // Deeper shadow for premium feel
      ...Shadow.md,
    },
    defaultPadding: {
      padding: 20,                             // was 0 (no default padding) — now 20
    },
    heroAccent: {
      borderTopWidth: 2,
      borderTopColor: c.primary,               // gold top border
    },
    pressed: {
      opacity: 0.85,
    },
  });
```

Key changes:
- `borderRadius: Radius.xl` — now 18 (was 14 before token update)
- `backgroundColor: c.cardSurface` — warm white (#fdf9f0) instead of plain surface
- Added `Shadow.md` spread for depth
- New `hero` prop for gold top border accent
- New `padding` prop with 20px default
- Existing consumers still work — `style` prop can override anything

- [ ] **Step 2: Check for consumers that set their own padding**

The Card previously had NO default padding — children provided their own. Adding `padding: 20` as default will affect spacing on existing screens. To be safe, check which screens use `<Card>` and whether they already apply internal padding.

Run grep to find all Card usages:

```bash
grep -rn "<Card" apps/mobile/app/ apps/mobile/src/ui/components/ --include="*.tsx" | head -30
```

If many consumers already handle their own padding, set `padding={0}` as default and let the new components opt in. **Alternatively**, keep the default as `padding: 0` and let Phase C/D/E screens explicitly set `padding={20}` when they're redesigned. This is safer.

**Decision:** Keep default `padding: 0` (no breaking change). Add the `padding` prop for new/upgraded uses. Remove the `defaultPadding` style — just support the prop.

Updated approach:

```typescript
const cardStyles: ViewStyle[] = [
  styles.card,
  hero ? styles.heroAccent : undefined,
  padding !== undefined ? { padding } : undefined,
  style,
].filter(Boolean) as ViewStyle[];
```

Remove `defaultPadding` from StyleSheet. This way, existing Card consumers are unaffected.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 4: Visual check**

Boot Expo, navigate through screens. Cards should now have:
- Slightly larger corner radius (18 vs 14)
- Visible warm shadow (was no shadow before)
- Warm white background (slightly different from page surface)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/components/Card.tsx
git commit -m "feat(ui): upgrade Card with shadow, warm bg, hero variant

- borderRadius: 18 (was 14)
- backgroundColor: cardSurface (warm white)
- Shadow.md for depth
- New hero prop for gold top border accent
- New padding prop (no default — backwards compatible)"
```

---

### Task 4: Upgrade ProgressBar Component

**Files:**
- Modify: `apps/mobile/src/ui/components/ProgressBar.tsx`

- [ ] **Step 1: Check if expo-linear-gradient is available**

Run: `grep -r "expo-linear-gradient\|react-native-linear-gradient" apps/mobile/package.json`

If not installed, we'll simulate gradient with two overlapping views (gold left, green right, masked by width). This avoids adding a new dependency for a small visual effect.

**Gradient simulation approach:** Use a View with `overflow: hidden` clipped to the progress width, containing a full-width inner view with two halves (gold left, green right). This creates a gradient-like appearance without a gradient library.

- [ ] **Step 2: Rewrite ProgressBar with 6px height, gradient simulation, and glow**

```typescript
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Radius, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Props = {
  /** Current balance in cents */
  balance: number;
  /** Optional goal/target in cents — enables ratio-based progress */
  goal?: number;
};

export function ProgressBar({ balance, goal }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const widthAnim = useRef(new Animated.Value(0)).current;

  const isNegative = balance < 0;

  let ratio: number;
  if (goal && goal > 0) {
    ratio = Math.max(0, Math.min(1, balance / goal));
  } else {
    if (isNegative) ratio = 1;
    else if (balance === 0) ratio = 0;
    else ratio = 1;
  }

  // Animated entrance: width grows from 0 to final ratio
  useEffect(() => {
    widthAnim.setValue(0);
    Animated.timing(widthAnim, {
      toValue: ratio,
      duration: 600,
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [ratio]);

  // Color: red if negative, otherwise gradient gold→green based on ratio
  const fillColor = isNegative
    ? colors.error
    : ratio >= 0.7
      ? colors.success
      : ratio >= 0.3
        ? colors.primary
        : colors.warning;

  const glowColor = isNegative ? colors.error : colors.primary;

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.track}>
      {ratio > 0 && (
        <Animated.View
          style={[
            styles.fill,
            {
              width: animatedWidth,
              backgroundColor: fillColor,
              // Glow shadow on filled portion
              shadowColor: glowColor,
              shadowOpacity: 0.3,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            },
          ]}
        />
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    track: {
      height: 6,                  // was 3 — doubled for premium feel
      borderRadius: Radius.pill,
      backgroundColor: c.borderLight,
      overflow: "hidden",
    },
    fill: {
      height: 6,                  // match track
      borderRadius: Radius.pill,
    },
  });
```

Key changes from current:
- Height: 3 → 6 (doubled)
- Animated entrance: width grows from 0 to target over 600ms
- Color progression: warning (low) → primary/gold (mid) → success/green (high)
- Glow shadow on fill bar (subtle gold/error glow) — iOS only; Android gets basic elevation fallback
- Same props interface — all consumers work unchanged

**Note:** The spec calls for a true linear gradient (gold→green). This implementation uses stepped color thresholds as a pragmatic approach that avoids adding `expo-linear-gradient` as a dependency. Can be upgraded to a true gradient in a future pass if desired.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 4: Visual check**

Boot Expo, navigate to Envelopes tab. Progress bars should now:
- Be visibly thicker (6px vs 3px)
- Animate in when screen loads
- Show warm gold color for mid-progress, green for high-progress
- Have subtle glow shadow

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ui/components/ProgressBar.tsx
git commit -m "feat(ui): upgrade ProgressBar with 6px height, animation, glow

- Track height: 3px → 6px for premium feel
- Animated entrance (600ms width grow)
- Color progression: warning → gold → green based on ratio
- Subtle glow shadow on filled portion"
```

---

### Task 5: Upgrade SectionHeader Component

**Files:**
- Modify: `apps/mobile/src/ui/components/SectionHeader.tsx`

- [ ] **Step 1: Update letter-spacing and color**

```typescript
const createStyles = (c: ColorTokens) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 11,                           // was FontSize.small (13) — smaller, tighter
    fontWeight: FontWeight.semibold,
    color: c.textMuted,                     // was c.textMid — more muted per spec
    textTransform: "uppercase",
    letterSpacing: 1.5,                     // was 0.5 — wider tracking per spec
  },
  action: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.primary,
  },
});
```

Changes:
- Font size: 13 → 11 (smaller, more refined label)
- Color: `textMid` → `textMuted` (more subtle)
- Letter-spacing: 0.5 → 1.5 (wider tracking for uppercase labels)

- [ ] **Step 2: Run typecheck + lint**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit && npm run lint -w @money-shepherd/mobile`
Expected: PASS

- [ ] **Step 3: Visual check**

Verify section headers on Home, Envelopes, and Transactions tabs look smaller, more refined, with wider letter-spacing.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/ui/components/SectionHeader.tsx
git commit -m "feat(ui): refine SectionHeader with tighter size and wider tracking

- Font size: 13 → 11 for more refined label
- Letter-spacing: 0.5 → 1.5 for wider uppercase tracking
- Color: textMid → textMuted for subtler appearance"
```

---

### Task 6: Create FilterChip Component

**Files:**
- Create: `apps/mobile/src/ui/components/FilterChip.tsx`

- [ ] **Step 1: Create the FilterChip component**

This will be used on the Activity screen (Phase E) for filter chips like "All | Expenses | Income | Transfers | Pending | Unassigned". Build it now as a foundational component.

```typescript
import React from "react";
import { Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles } from "../ThemeProvider";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Optional count badge (e.g., "5") shown after label */
  count?: number;
  style?: ViewStyle;
};

export function FilterChip({ label, active, onPress, count, style }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, style]}
      accessibilityLabel={`${label}${count !== undefined ? `, ${count}` : ""}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.label, active && styles.labelActive]}>
        {label}
        {count !== undefined ? ` ${count}` : ""}
      </Text>
    </Pressable>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: c.borderLight,
      backgroundColor: c.surface,
    },
    chipActive: {
      backgroundColor: c.filterChipActive,
      borderColor: c.filterChipActiveBorder,
    },
    label: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.medium,
      color: c.textMid,
    },
    labelActive: {
      color: c.primary,
      fontWeight: FontWeight.semibold,
    },
  });
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/ui/components/FilterChip.tsx
git commit -m "feat(ui): add FilterChip component for filter pill buttons

- Pill-shaped with active/inactive states
- Active: dark warm bg + gold text + gold border
- Optional count badge after label
- Ready for Activity screen filter bar (Phase E)"
```

---

### Task 7: Upgrade SuggestedChips Component

**Files:**
- Modify: `apps/mobile/src/ui/components/SuggestedChips.tsx`

- [ ] **Step 1: Add gold outline and improved press state**

Update the styling to match the finalized chip design:

```typescript
const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: Spacing.base,
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      borderWidth: 1.5,                        // was 1 — slightly thicker
      borderColor: c.primary,
      backgroundColor: "transparent",           // was primarySurface — cleaner outline look
    },
    chipPressed: {
      backgroundColor: c.primarySurface,        // was c.primary — softer press feedback
    },
    chipText: {
      fontSize: FontSize.small,
      fontWeight: FontWeight.semibold,          // was medium — slightly bolder
      color: c.primary,
    },
  });
```

Changes:
- Border: 1 → 1.5 for more presence
- Default bg: `primarySurface` → `transparent` (cleaner outline-only)
- Pressed bg: `primary` → `primarySurface` (softer, not full inversion)
- Text weight: medium → semibold

- [ ] **Step 2: Run typecheck + lint**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit && npm run lint -w @money-shepherd/mobile`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/ui/components/SuggestedChips.tsx
git commit -m "feat(ui): refine SuggestedChips with gold outline style

- Border: 1 → 1.5 for more presence
- Transparent bg with cream fill on press
- Bolder text weight (semibold)"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
Expected: PASS — all token references resolve, no type errors

- [ ] **Step 2: Run lint**

Run: `npm run lint -w @money-shepherd/mobile`
Expected: PASS

- [ ] **Step 3: Boot Expo and visual smoke test**

Run: `npm run dev:mobile`

Check these screens in the iOS simulator:
1. **Home tab** — Cards have shadows, rounded corners (18px). Quick action buttons are pill-shaped. Progress bars are thicker (6px) with animation.
2. **Envelopes tab** — Envelope progress bars are 6px with gold/green color. Section headers are smaller with wider tracking.
3. **Transactions tab** — No visual regressions.
4. **Settings tab** — Buttons are pill-shaped with press animation.
5. **Chat screen** — Suggested chips have gold outline with transparent bg.

- [ ] **Step 4: Commit any remaining fixes**

If any visual issues found, fix and commit individually.

---

## What's Next (Future Plans)

This plan covers **Phase A only**. Subsequent phases will be written as separate plans:

| Phase | Plan File | Depends On |
|-------|-----------|------------|
| **B** | `2026-03-XX-ui-polish-phase-b.md` | Phase A (tokens + components) |
| **C** | `2026-03-XX-ui-polish-phase-c.md` | Phase A + B (navigation in place) |
| **D–H** | Individual plan files | Phase A + B |

Phase B (Tab bar + Navigation) should be planned next — it restructures the tab layout from 5 tabs to 4 tabs + top bar + FAB, which is the most structural change in the redesign.
