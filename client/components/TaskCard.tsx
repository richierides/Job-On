import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Chip, getChipVariantForPriority, getChipVariantForStatus, getChipVariantForEffort } from "@/components/Chip";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { resolveMediaUrl } from "@/lib/query-client";
import { Task } from "@shared/schema";
import { formatDuration } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  assigneeName?: string;
  onPress: () => void;
  onPropertyPress: (propertyType: "priority" | "status" | "location" | "effort" | "assignee") => void;
}

function TaskCardInner({ task, assigneeName, onPress, onPropertyPress }: TaskCardProps) {
  const { theme } = useTheme();

  const subtasks = (task as any).subtasks as { title: string; completed: boolean }[] | null;
  const subtaskCount = subtasks?.length || 0;
  const subtasksDone = subtasks?.filter((s) => s.completed).length || 0;
  const shoppingList = (task as any).shoppingList as { item: string; checked: boolean }[] | null;
  const shoppingCount = shoppingList?.length || 0;

  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getEffortLabel = (score: number) => {
    const labels = ["Easy", "Simple", "Medium", "Hard", "Complex"];
    return labels[score - 1] || `Level ${score}`;
  };

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
      onPress={onPress}
      testID={`task-card-${task.id}`}
    >
      <View style={styles.cardHeader}>
        {task.thumbnailUrl ? (
          <Image
            source={{ uri: resolveMediaUrl(task.thumbnailUrl) || "" }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="home" size={24} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.headerContent}>
          <ThemedText
            style={[
              styles.title,
              task.status === "Completed" && styles.completedTitle,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </ThemedText>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={12} color={theme.textSecondary} />
            <Pressable onPress={() => onPropertyPress("location")}>
              <ThemedText style={[styles.locationText, { color: theme.textSecondary }]}>
                {task.location}
              </ThemedText>
            </Pressable>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </View>

      <View style={styles.chipRow}>
        <Chip
          label={task.status}
          variant={getChipVariantForStatus(task.status)}
          onPress={() => onPropertyPress("status")}
        />
        <Chip
          label={task.priority}
          variant={getChipVariantForPriority(task.priority)}
          onPress={() => onPropertyPress("priority")}
        />
        <Chip
          label={getEffortLabel(task.effortScore)}
          variant={getChipVariantForEffort(task.effortScore)}
          onPress={() => onPropertyPress("effort")}
        />
      </View>

      {((task as any).estimatedMinutes || subtaskCount > 0 || shoppingCount > 0) ? (
        <View style={[styles.metaRow, { borderTopColor: theme.border }]}>
          {(task as any).estimatedMinutes ? (
            <View style={styles.metaItem}>
              <Feather name="clock" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {formatDuration((task as any).estimatedMinutes)}
              </ThemedText>
            </View>
          ) : null}
          {subtaskCount > 0 ? (
            <View style={styles.metaItem}>
              <Feather name="check-square" size={13} color={subtasksDone === subtaskCount ? theme.success : theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: subtasksDone === subtaskCount ? theme.success : theme.textSecondary }]}>
                {subtasksDone}/{subtaskCount} steps
              </ThemedText>
            </View>
          ) : null}
          {shoppingCount > 0 ? (
            <View style={styles.metaItem}>
              <Feather name="shopping-cart" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {shoppingCount} {shoppingCount === 1 ? "item" : "items"}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
        <Pressable style={styles.footerItem} onPress={() => onPropertyPress("assignee")}>
          <View style={[styles.avatar, { backgroundColor: assigneeName ? theme.primary + "20" : theme.backgroundSecondary }]}>
            <ThemedText style={[styles.avatarText, { color: assigneeName ? theme.primary : theme.textSecondary }]}>
              {assigneeName ? assigneeName.charAt(0).toUpperCase() : "?"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            {assigneeName || "Unassigned"}
          </ThemedText>
        </Pressable>

        <View style={styles.footerRight}>
          {task.completedAt ? (
            <View style={styles.footerItem}>
              <Feather name="check-circle" size={14} color={theme.success} />
              <ThemedText style={[styles.footerText, { color: theme.success }]}>
                {formatDate(task.completedAt)}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.footerItem}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
                {formatDate(task.createdAt)}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const TaskCard = React.memo(TaskCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xs,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    ...Typography.body,
    fontWeight: "600",
  },
  completedTitle: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    ...Typography.caption,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "600",
  },
  footerText: {
    ...Typography.caption,
  },
});
