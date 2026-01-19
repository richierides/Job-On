import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Typography } from "@/constants/theme";
import { Task, PRIORITIES, LOCATIONS, Priority, Location } from "@shared/schema";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TaskDetail">;
type DetailRouteProp = RouteProp<RootStackParamList, "TaskDetail">;

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

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const queryClient = useQueryClient();

  const { task: initialTask } = route.params;

  const [title, setTitle] = useState(initialTask.title);
  const [location, setLocation] = useState<Location>(initialTask.location as Location);
  const [priority, setPriority] = useState<Priority>(initialTask.priority as Priority);
  const [status, setStatus] = useState(initialTask.status);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      await apiRequest("PATCH", `/api/tasks/${initialTask.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tasks/${initialTask.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      navigation.goBack();
    },
  });

  const handleSave = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateMutation.mutate({ title, location, priority, status });
  }, [title, location, priority, status, updateMutation]);

  const handleToggleStatus = useCallback(async () => {
    const newStatus = status === "Pending" ? "Completed" : "Pending";
    setStatus(newStatus);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMutation.mutate({ status: newStatus });
  }, [status, updateMutation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to delete this task? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteMutation.mutate();
          },
        },
      ]
    );
  }, [deleteMutation]);

  const handlePriorityChange = useCallback(
    async (newPriority: Priority) => {
      setPriority(newPriority);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateMutation.mutate({ priority: newPriority });
    },
    [updateMutation]
  );

  const handleLocationSelect = useCallback(
    async (newLocation: Location) => {
      setLocation(newLocation);
      setShowLocationPicker(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateMutation.mutate({ location: newLocation });
    },
    [updateMutation]
  );

  const getEffortDots = (score: number) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.effortDot,
            { backgroundColor: i <= score ? AppColors.primary : theme.border },
          ]}
        />
      );
    }
    return dots;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {initialTask.thumbnailUrl ? (
          <Image
            source={{ uri: initialTask.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="home" size={48} color={theme.textSecondary} />
          </View>
        )}
      </View>

      {/* Title */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Title</ThemedText>
        <TextInput
          style={[
            styles.titleInput,
            {
              color: theme.text,
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          value={title}
          onChangeText={setTitle}
          onBlur={() => {
            if (title !== initialTask.title) {
              updateMutation.mutate({ title });
            }
          }}
          placeholder="Task title"
          placeholderTextColor={theme.textSecondary}
          multiline
          testID="input-title"
        />
      </View>

      {/* Location */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Location</ThemedText>
        <Pressable
          style={[
            styles.pickerButton,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setShowLocationPicker(!showLocationPicker)}
          testID="button-location"
        >
          <Feather name="map-pin" size={18} color={theme.textSecondary} />
          <ThemedText style={styles.pickerText}>{location}</ThemedText>
          <Feather
            name={showLocationPicker ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.textSecondary}
          />
        </Pressable>

        {showLocationPicker ? (
          <View style={[styles.optionsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            {LOCATIONS.map((loc) => (
              <Pressable
                key={loc}
                style={[
                  styles.optionItem,
                  location === loc && { backgroundColor: AppColors.primary + "20" },
                ]}
                onPress={() => handleLocationSelect(loc as Location)}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    location === loc && { color: AppColors.primary, fontWeight: "600" },
                  ]}
                >
                  {loc}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Priority */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Priority</ThemedText>
        <View style={styles.priorityContainer}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p}
              style={[
                styles.priorityButton,
                {
                  backgroundColor:
                    priority === p ? getPriorityColor(p) : theme.backgroundDefault,
                  borderColor: priority === p ? getPriorityColor(p) : theme.border,
                },
              ]}
              onPress={() => handlePriorityChange(p as Priority)}
              testID={`button-priority-${p.toLowerCase()}`}
            >
              <ThemedText
                style={[
                  styles.priorityButtonText,
                  { color: priority === p ? "#FFFFFF" : theme.text },
                ]}
              >
                {p}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Effort Score */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          Effort Score (AI Estimated)
        </ThemedText>
        <View style={styles.effortContainer}>
          <View style={styles.effortDots}>{getEffortDots(initialTask.effortScore)}</View>
          <ThemedText style={[styles.effortText, { color: theme.textSecondary }]}>
            {initialTask.effortScore}/5
          </ThemedText>
        </View>
      </View>

      {/* Status Toggle */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Status</ThemedText>
        <Pressable
          style={[
            styles.statusButton,
            {
              backgroundColor:
                status === "Completed" ? AppColors.success : theme.backgroundDefault,
              borderColor: status === "Completed" ? AppColors.success : theme.border,
            },
          ]}
          onPress={handleToggleStatus}
          testID="button-status"
        >
          <Feather
            name={status === "Completed" ? "check-circle" : "circle"}
            size={20}
            color={status === "Completed" ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            style={[
              styles.statusText,
              { color: status === "Completed" ? "#FFFFFF" : theme.text },
            ]}
          >
            {status}
          </ThemedText>
        </Pressable>
      </View>

      {/* Transcript */}
      {initialTask.transcript ? (
        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Original Transcript
          </ThemedText>
          <View style={[styles.transcriptContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={styles.transcriptText}>
              {initialTask.transcript}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Delete Button */}
      <Pressable
        style={[styles.deleteButton, { borderColor: AppColors.error }]}
        onPress={handleDelete}
        testID="button-delete"
      >
        <Feather name="trash-2" size={18} color={AppColors.error} />
        <ThemedText style={[styles.deleteText, { color: AppColors.error }]}>
          Delete Task
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  thumbnailContainer: {
    marginBottom: Spacing.xl,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: BorderRadius.sm,
  },
  thumbnailPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: Typography.small.fontSize,
    fontWeight: "500",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  titleInput: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "600",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    minHeight: 60,
    textAlignVertical: "top",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  pickerText: {
    flex: 1,
    fontSize: Typography.body.fontSize,
  },
  optionsContainer: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    maxHeight: 200,
  },
  optionItem: {
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  optionText: {
    fontSize: Typography.body.fontSize,
  },
  priorityContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: "center",
  },
  priorityButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  effortContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  effortDots: {
    flexDirection: "row",
    gap: 6,
  },
  effortDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  effortText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "500",
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  statusText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  transcriptContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  transcriptText: {
    fontSize: Typography.small.fontSize,
    lineHeight: 22,
    fontStyle: "italic",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  deleteText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
});
