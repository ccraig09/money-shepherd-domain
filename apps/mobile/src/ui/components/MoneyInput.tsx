import React from "react";
import { View, Text, TextInput, StyleSheet, type TextInputProps } from "react-native";

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
          placeholderTextColor="#bbb"
          keyboardType="decimal-pad"
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

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  inputRowError: { borderColor: "#d94f4f" },
  inputRowDisabled: { backgroundColor: "#f5f5f5" },
  prefix: { fontSize: 16, color: "#555", marginRight: 4 },
  prefixDisabled: { color: "#bbb" },
  input: { flex: 1, fontSize: 16, color: "#111", padding: 0 },
  inputDisabled: { color: "#aaa" },
  errorText: { fontSize: 13, color: "#d94f4f", marginTop: 4 },
});
