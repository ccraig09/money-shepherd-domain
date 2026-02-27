import React from "react";
import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { Spacing, Radius, FontSize, FontWeight, type ColorTokens } from "../tokens";
import { useThemedStyles, useTheme } from "../ThemeProvider";

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  error: string | null;
  onErrorClear: () => void;
  label?: string;
  placeholder?: string;
  editable?: boolean;
  accessibilityLabel?: string;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
};

/**
 * Controlled money amount input with inline validation error.
 *
 * - Always uses decimal-pad keyboard (iOS/Android)
 * - Shows optional $ prefix
 * - Clears error on any text change (caller controls when to re-validate)
 * - Never stores floats; caller owns raw string + parsed cents
 */
export const MoneyInput = React.forwardRef<TextInput, Props>(function MoneyInput(
  {
    value,
    onChangeText,
    error,
    onErrorClear,
    label,
    placeholder = "e.g. 10.50",
    editable = true,
    accessibilityLabel = "Amount in dollars",
    returnKeyType = "done",
    onSubmitEditing,
  },
  ref,
) {
  const styles = useThemedStyles(createStyles);
  const { colors, isDark } = useTheme();

  function handleChange(v: string) {
    if (error) onErrorClear();
    onChangeText(v);
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          error ? styles.inputRowError : null,
          !editable ? styles.inputRowDisabled : null,
        ]}
      >
        <Text style={[styles.prefix, !editable && styles.prefixDisabled]}>$</Text>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
          keyboardAppearance={isDark ? "dark" : "light"}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          style={[styles.input, !editable && styles.inputDisabled]}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

const createStyles = (c: ColorTokens) => StyleSheet.create({
  label: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
    color: c.textMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    backgroundColor: c.surface,
  },
  inputRowError: { borderColor: c.error },
  inputRowDisabled: { backgroundColor: c.surfaceLight },
  prefix: { fontSize: FontSize.subtitle, color: c.textMid, marginRight: 4 },
  prefixDisabled: { color: c.textSubtle },
  input: { flex: 1, fontSize: FontSize.subtitle, color: c.textDark, padding: 0 },
  inputDisabled: { color: c.textDisabled },
  errorText: { fontSize: FontSize.small, color: c.error, marginTop: Spacing.xs },
});
