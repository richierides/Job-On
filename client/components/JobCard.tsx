import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Typography } from "@/constants/theme";
import { resolveMediaUrl } from "@/lib/query-client";
import { Task } from "@shared/schema";

interface JobCardProps {
  task: Task;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "High":
      return AppColors.error;
    case "Medium":
      return AppColors.warning;
    case "Low":
      return AppColors.success;
    default:
      return AppColors.warning;
  }
};

const getEffortDots = (score: number) => {
  const dots = [];
  for (let i = 1; i <= 5; i++) {
    dots.push(
      <View
        key={i}
        style={[
          styles.effortDot,
          { backgroundColor: i <= score ? AppColors.primary : "#E0E0E0" },
        ]}
      />
    );
  }
  return dots;
};

export function JobCard({ task, onPress }: JobCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const isCompleted = task.status === "Completed";

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
          opacity: isCompleted ? 0.7 : 1,
        },
        animatedStyle,
      ]}
      testID={`job-card-${task.id}`}
    >
      <View style={styles.thumbnailContainer}>
        {task.thumbnailUrl ? (
          <Image
            source={{ uri: resolveMediaUrl(task.thumbnailUrl) || "" }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="home" size={24} color={theme.textSecondary} />
          </View>
        )}
        {isCompleted ? (
          <View style={styles.completedBadge}>
            <Feather name="check" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText
            style={[
              styles.title,
              isCompleted && styles.completedTitle,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </ThemedText>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.locationContainer}>
            <Feather name="map-pin" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.location, { color: theme.textSecondary }]}>
              {task.location}
            </ThemedText>
          </View>

          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(task.priority) + "20" },
            ]}
          >
            <ThemedText
              style={[
                styles.priorityText,
                { color: getPriorityColor(task.priority) },
              ]}
            >
              {task.priority}
            </ThemedText>
          </View>
        </View>

        <View style={styles.effortRow}>
          <ThemedText style={[styles.effortLabel, { color: theme.textSecondary }]}>
            Effort:
          </ThemedText>
          <View style={styles.effortDots}>{getEffortDots(task.effortScore)}</View>
        </View>
      </View>

      <Feather
        name="chevron-right"
        size={20}
        color={theme.textSecondary}
        style={styles.chevron}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  thumbnailContainer: {
    position: "relative",
    marginRight: Spacing.md,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xs,
  },
  thumbnailPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  completedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppColors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    lineHeight: 20,
  },
  completedTitle: {
    textDecorationLine: "line-through",
    opacity: 0.7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  location: {
    fontSize: Typography.small.fontSize,
    marginLeft: 4,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  effortRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  effortLabel: {
    fontSize: Typography.caption.fontSize,
    marginRight: Spacing.xs,
  },
  effortDots: {
    flexDirection: "row",
    gap: 3,
  },
  effortDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
});
