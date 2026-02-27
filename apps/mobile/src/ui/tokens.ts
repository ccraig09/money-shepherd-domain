/**
 * UI Tokens — single source of truth for spacing, typography, radius, color, and shadow.
 *
 * Screens and components should import from here instead of using magic numbers.
 * Keep this file small and stable. Do not add one-off values.
 */

/** 4-point spacing scale (in dp) */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  /** Standard scroll-view bottom padding */
  bottomPad: 40,
} as const;

/** Border radius scale */
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  hero: 20,
  /** True pill / full-round */
  pill: 999,
} as const;

/** Font sizes (in sp) */
export const FontSize = {
  caption: 12,
  small: 13,
  body: 15,
  subtitle: 16,
  title: 28,
  hero: 44,
} as const;

/** Line height scale — pair with FontSize for readable text blocks */
export const LineHeight = {
  caption: 16,
  small: 18,
  body: 22,
  subtitle: 24,
  title: 34,
} as const;

/** Font weights — use string literals for StyleSheet compatibility */
export const FontWeight = {
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

/** Semantic color palette — light theme (warm gold stewardship identity) */
export const lightColors = {
  // ── Brand ──────────────────────────────────
  primary: "#b8860b",
  primaryDark: "#946b09",
  success: "#2d7a4f",
  error: "#c0392b",
  warning: "#d4880f",

  // ── Text ───────────────────────────────────
  textDark: "#2c2416",
  textMid: "#5c4e3c",
  textMuted: "#8a7e6e",
  textSubtle: "#b5a898",
  textDisabled: "#c4b9ab",
  /** Text on solid colored backgrounds (buttons, hero card) */
  textOnColor: "#fff",

  // ── Surfaces ───────────────────────────────
  surface: "#fdfbf7",
  surfaceLight: "#f5f0e8",

  // ── Tinted surfaces ────────────────────────
  primarySurface: "#fdf6e3",
  successSurface: "#eef7f1",
  errorSurface: "#fdecea",
  warningSurface: "#fef8ec",

  // ── Borders ────────────────────────────────
  border: "#ddd0bf",
  borderLight: "#ebe3d5",
  borderWarning: "#f0d68a",

  // ── Semantic text (for notices, nudges, status) ──
  infoText: "#5c4e3c",
  infoSurface: "#fdf6e3",
  warningText: "#7a5c00",
  warningAction: "#c27a00",
  errorText: "#8b1a1a",
  pendingText: "#92400e",

  // ── Hero negative ──────────────────────────
  heroNegative: "#ffcdd2",

  // ── Giving ───────────────────────────────────
  giving: "#8e6bbf",
  givingSurface: "#f3eef9",

  // ── Debt ─────────────────────────────────────
  debt: "#c0392b",
  debtSurface: "#fdecea",

  // ── Nudge ──────────────────────────────────
  nudgeText: "#795548",
} as const;

/** Color token shape — used by ThemeProvider. Keys match lightColors, values are hex strings. */
export type ColorTokens = { readonly [K in keyof typeof lightColors]: string };

/** Semantic color palette — dark theme */
export const darkColors: ColorTokens = {
  // ── Brand ──────────────────────────────────
  primary: "#d4a017",
  primaryDark: "#b8860b",
  success: "#4caf6a",
  error: "#e57373",
  warning: "#f0b840",

  // ── Text ───────────────────────────────────
  textDark: "#f0ebe4",
  textMid: "#c8bfb2",
  textMuted: "#9e9488",
  textSubtle: "#6e6358",
  textDisabled: "#4e4640",
  textOnColor: "#fff",

  // ── Surfaces ───────────────────────────────
  surface: "#1a1612",
  surfaceLight: "#252019",

  // ── Tinted surfaces ────────────────────────
  primarySurface: "#2a2210",
  successSurface: "#1a2e20",
  errorSurface: "#2e1a18",
  warningSurface: "#2a2410",

  // ── Borders ────────────────────────────────
  border: "#3e3628",
  borderLight: "#322c22",
  borderWarning: "#5a4a1a",

  // ── Semantic text (for notices, nudges, status) ──
  infoText: "#c8bfb2",
  infoSurface: "#2a2210",
  warningText: "#f0b840",
  warningAction: "#e0a020",
  errorText: "#ef9a9a",
  pendingText: "#f0b840",

  // ── Hero negative ──────────────────────────
  heroNegative: "#ef9a9a",

  // ── Giving ───────────────────────────────────
  giving: "#b39ddb",
  givingSurface: "#2a2238",

  // ── Debt ─────────────────────────────────────
  debt: "#e57373",
  debtSurface: "#2e1a18",

  // ── Nudge ──────────────────────────────────
  nudgeText: "#c8bfb2",
} as const;

/**
 * Backward-compatible alias — screens that haven't migrated to useTheme()
 * still import `Color` and get light-mode values.
 */
export const Color = lightColors;

/** Shadow scale — use with StyleSheet spread */
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
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  lg: {
    shadowColor: "#2c2416",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;
