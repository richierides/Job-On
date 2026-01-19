import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

type ChipVariant = "default" | "primary" | "success" | "warning" | "error" | "muted";

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const variantColors = {
  default: { bg: "rgba(0,0,0,0.06)", text: undefined },
  primary: { bg: "rgba(255,107,53,0.12)", text: "#FF6B35" },
  success: { bg: "rgba(16,185,129,0.12)", text: "#10B981" },
  warning: { bg: "rgba(245,158,11,0.12)", text: "#D97706" },
  error: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
  muted: { bg: "rgba(0,0,0,0.04)", text: undefined },
};

const darkVariantColors = {
  default: { bg: "rgba(255,255,255,0.08)", text: undefined },
  primary: { bg: "rgba(255,107,53,0.2)", text: "#FF8A5C" },
  success: { bg: "rgba(16,185,129,0.2)", text: "#34D399" },
  warning: { bg: "rgba(245,158,11,0.2)", text: "#FBBF24" },
  error: { bg: "rgba(239,68,68,0.2)", text: "#F87171" },
  muted: { bg: "rgba(255,255,255,0.06)", text: undefined },
};

export function getChipVariantForPriority(priority: string): ChipVariant {
  switch (priority) {
    case "High":
      return "error";
    case "Medium":
      return "warning";
    case "Low":
      return "success";
    default:
      return "default";
  }
}

export function getChipVariantForStatus(status: string): ChipVariant {
  switch (status) {
    case "Completed":
      return "success";
    case "Pending":
      return "primary";
    default:
      return "default";
  }
}

export function getChipVariantForEffort(effort: number): ChipVariant {
  if (effort >= 4) return "error";
  if (effort >= 2) return "warning";
  return "success";
}

export function Chip({ label, variant = "default", onPress, style, testID }: ChipProps) {
  const { isDark, theme } = useTheme();
  const colors = isDark ? darkVariantColors : variantColors;
  const variantStyle = colors[variant];

  const content = (
    <ThemedText
      style={[
        styles.label,
        { color: variantStyle.text || theme.text },
      ]}
    >
      {label}
    </ThemedText>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: variantStyle.bg },
          pressed && styles.pressed,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      style={[
        styles.chip,
        { backgroundColor: variantStyle.bg },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
});
