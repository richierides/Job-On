import React, { useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { PRIORITIES, STATUSES, LOCATIONS } from "@shared/schema";

type PropertyType = "priority" | "status" | "location" | "effort";

interface PropertyPickerProps {
  visible: boolean;
  propertyType: PropertyType;
  currentValue: string | number;
  onSelect: (value: string | number) => void;
  onClose: () => void;
}

function getOptionsForType(type: PropertyType): (string | number)[] {
  switch (type) {
    case "priority":
      return [...PRIORITIES];
    case "status":
      return [...STATUSES];
    case "location":
      return [...LOCATIONS];
    case "effort":
      return [1, 2, 3, 4, 5];
    default:
      return [];
  }
}

function getTitleForType(type: PropertyType): string {
  switch (type) {
    case "priority":
      return "Priority";
    case "status":
      return "Status";
    case "location":
      return "Location";
    case "effort":
      return "Effort Score";
    default:
      return "";
  }
}

function getEffortLabel(effort: number): string {
  const labels = ["Easy", "Simple", "Moderate", "Hard", "Complex"];
  return `${effort} - ${labels[effort - 1] || ""}`;
}

export function PropertyPicker({
  visible,
  propertyType,
  currentValue,
  onSelect,
  onClose,
}: PropertyPickerProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const options = useMemo(() => getOptionsForType(propertyType), [propertyType]);
  const title = useMemo(() => getTitleForType(propertyType), [propertyType]);

  const handleSelect = useCallback(
    (value: string | number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(value);
      onClose();
    },
    [onSelect, onClose]
  );

  const getDisplayLabel = useCallback(
    (option: string | number): string => {
      if (propertyType === "effort" && typeof option === "number") {
        return getEffortLabel(option);
      }
      return String(option);
    },
    [propertyType]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundDefault,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.optionsList}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => {
              const isSelected =
                propertyType === "effort"
                  ? option === currentValue
                  : String(option) === String(currentValue);

              return (
                <Pressable
                  key={String(option)}
                  testID={`option-${option}`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: isSelected
                        ? theme.primary + "15"
                        : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleSelect(option)}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      isSelected && { color: theme.primary, fontWeight: "600" },
                    ]}
                  >
                    {getDisplayLabel(option)}
                  </ThemedText>
                  {isSelected ? (
                    <Feather name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingTop: Spacing.sm,
    maxHeight: "60%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.15)",
  },
  title: {
    ...Typography.h4,
  },
  optionsList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  optionText: {
    ...Typography.body,
  },
});
