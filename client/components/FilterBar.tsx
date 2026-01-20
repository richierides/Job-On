import React from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { PRIORITIES, STATUSES, LOCATIONS } from "@shared/schema";

export interface FilterState {
  status: string | null;
  priority: string | null;
  location: string | null;
  assignedToId: number | null;
}

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? theme.primary : theme.backgroundSecondary,
          borderColor: isActive ? theme.primary : theme.border,
        },
      ]}
      onPress={onPress}
    >
      <ThemedText
        style={[
          styles.chipText,
          { color: isActive ? "#FFFFFF" : theme.text },
        ]}
      >
        {label}
      </ThemedText>
      {isActive ? (
        <Feather name="x" size={12} color="#FFFFFF" style={styles.chipIcon} />
      ) : null}
    </Pressable>
  );
}

interface FilterSectionProps {
  title: string;
  options: readonly string[];
  activeValue: string | null;
  onSelect: (value: string | null) => void;
}

function FilterSection({ title, options, activeValue, onSelect }: FilterSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {options.map((option) => (
          <FilterChip
            key={option}
            label={option}
            isActive={activeValue === option}
            onPress={() => onSelect(activeValue === option ? null : option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  memberOptions?: { id: number; name: string }[];
}

export function FilterBar({ filters, onFilterChange, memberOptions = [] }: FilterBarProps) {
  const { theme } = useTheme();

  const activeFilterCount = [
    filters.status,
    filters.priority,
    filters.location,
    filters.assignedToId,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFilterChange({
      status: null,
      priority: null,
      location: null,
      assignedToId: null,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="filter" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Filters
          </ThemedText>
          {activeFilterCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.badgeText}>{activeFilterCount}</ThemedText>
            </View>
          ) : null}
        </View>
        {activeFilterCount > 0 ? (
          <Pressable onPress={clearAllFilters} hitSlop={8}>
            <ThemedText style={[styles.clearText, { color: theme.primary }]}>
              Clear all
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <FilterSection
        title="Status"
        options={STATUSES}
        activeValue={filters.status}
        onSelect={(value) => onFilterChange({ ...filters, status: value })}
      />

      <FilterSection
        title="Priority"
        options={PRIORITIES}
        activeValue={filters.priority}
        onSelect={(value) => onFilterChange({ ...filters, priority: value })}
      />

      <FilterSection
        title="Location"
        options={LOCATIONS}
        activeValue={filters.location}
        onSelect={(value) => onFilterChange({ ...filters, location: value })}
      />

      {memberOptions.length > 0 ? (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Assigned To
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {memberOptions.map((member) => (
              <FilterChip
                key={member.id}
                label={member.name}
                isActive={filters.assignedToId === member.id}
                onPress={() =>
                  onFilterChange({
                    ...filters,
                    assignedToId: filters.assignedToId === member.id ? null : member.id,
                  })
                }
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  clearText: {
    ...Typography.small,
    fontWeight: "500",
  },
  section: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: "500",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  chipIcon: {
    marginLeft: 4,
  },
});
