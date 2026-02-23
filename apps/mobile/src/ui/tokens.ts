/**
 * UI Tokens — single source of truth for spacing, typography, radius, and color.
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

/** Font weights — use string literals for StyleSheet compatibility */
export const FontWeight = {
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

/** Semantic color palette */
export const Color = {
  // ── Brand ──────────────────────────────────
  primary: "#4f8ef7",
  success: "#2d9e6b",
  error: "#d94f4f",
  warning: "#f59e0b",

  // ── Text ───────────────────────────────────
  textDark: "#111",
  textMid: "#555",
  textMuted: "#888",
  textSubtle: "#bbb",
  textDisabled: "#aaa",
  /** Text on solid colored backgrounds (buttons, hero card) */
  textOnColor: "#fff",

  // ── Surfaces ───────────────────────────────
  surface: "#fff",
  surfaceLight: "#f5f5f5",

  // ── Tinted surfaces ────────────────────────
  primarySurface: "#eef4ff",
  successSurface: "#edfaf3",
  errorSurface: "#fdeaea",
  warningSurface: "#fff8e1",

  // ── Borders ────────────────────────────────
  border: "#ddd",
  borderLight: "#eee",
  borderWarning: "#ffe082",
} as const;
