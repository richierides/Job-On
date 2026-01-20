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
import { PRIORITIES, STATUSES, LOCATIONS, HouseholdMember } from "@shared/schema";

type PropertyType = "priority" | "status" | "location" | "effort" | "assignee";

interface PropertyPickerProps {
  visible: boolean;
  propertyType: PropertyType;
  currentValue: string | number;
  onSelect: (value: string | number) => void;
  onClose: () => void;
  members?: HouseholdMember[];
}

function getOptionsForType(type: PropertyType, members?: HouseholdMember[]): { value: string | number; label: string }[] {
  switch (type) {
    case "priority":
      return PRIORITIES.map(p => ({ value: p, label: p }));
    case "status":
      return STATUSES.map(s => ({ value: s, label: s }));
    case "location":
      return LOCATIONS.map(l => ({ value: l, label: l }));
    case "effort":
      return [1, 2, 3, 4, 5].map(e => ({ value: e, label: getEffortLabel(e) }));
    case "assignee":
      const assigneeOptions = [{ value: 0, label: "Unassigned" }];
      if (members) {
        members.forEach(m => assigneeOptions.push({ value: m.id, label: m.name }));
      }
      return assigneeOptions;
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
    case "assignee":
      return "Assign To";
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
  members,
}: PropertyPickerProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const options = useMemo(() => getOptionsForType(propertyType, members), [propertyType, members]);
  const title = useMemo(() => getTitleForType(propertyType), [propertyType]);

  const handleSelect = useCallback(
    (value: string | number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(value);
      onClose();
    },
    [onSelect, onClose]
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
              const isSelected = option.value === currentValue || 
                (propertyType !== "effort" && propertyType !== "assignee" && String(option.value) === String(currentValue));

              return (
                <Pressable
                  key={String(option.value)}
                  testID={`option-${option.value}`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: isSelected
                        ? theme.primary + "15"
                        : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      isSelected && { color: theme.primary, fontWeight: "600" },
                    ]}
                  >
                    {option.label}
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
