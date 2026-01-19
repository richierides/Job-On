import React, { useCallback, useState } from "react";
import { ScrollView, RefreshControl, StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { EmptyState } from "@/components/EmptyState";
import { Chip, getChipVariantForPriority, getChipVariantForStatus, getChipVariantForEffort } from "@/components/Chip";
import { PropertyPicker } from "@/components/PropertyPicker";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, Typography, BorderRadius } from "@/constants/theme";
import { Task, UpdateTask } from "@shared/schema";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TaskDashboard">;

type PropertyType = "priority" | "status" | "location" | "effort";

interface PickerState {
  visible: boolean;
  propertyType: PropertyType;
  taskId: number | null;
  currentValue: string | number;
}

export default function TaskDashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [pickerState, setPickerState] = useState<PickerState>({
    visible: false,
    propertyType: "status",
    taskId: null,
    currentValue: "",
  });

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTask }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRecordPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Recording");
  }, [navigation]);

  const handleTaskPress = useCallback(
    (task: Task) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("TaskDetail", { task });
    },
    [navigation]
  );

  const openPicker = useCallback(
    (task: Task, propertyType: PropertyType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      let currentValue: string | number;
      switch (propertyType) {
        case "priority":
          currentValue = task.priority;
          break;
        case "status":
          currentValue = task.status;
          break;
        case "location":
          currentValue = task.location;
          break;
        case "effort":
          currentValue = task.effortScore;
          break;
        default:
          currentValue = "";
      }
      setPickerState({
        visible: true,
        propertyType,
        taskId: task.id,
        currentValue,
      });
    },
    []
  );

  const handlePickerSelect = useCallback(
    (value: string | number) => {
      if (pickerState.taskId === null) return;

      const updateData: UpdateTask = {};
      switch (pickerState.propertyType) {
        case "priority":
          updateData.priority = String(value);
          break;
        case "status":
          updateData.status = String(value);
          break;
        case "location":
          updateData.location = String(value);
          break;
        case "effort":
          updateData.effortScore = Number(value);
          break;
      }

      updateMutation.mutate({ id: pickerState.taskId, data: updateData });
    },
    [pickerState, updateMutation]
  );

  const closePicker = useCallback(() => {
    setPickerState((prev) => ({ ...prev, visible: false }));
  }, []);

  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status === "Pending" && b.status === "Completed") return -1;
      if (a.status === "Completed" && b.status === "Pending") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks]);

  const getEffortLabel = (score: number) => {
    const labels = ["1", "2", "3", "4", "5"];
    return labels[score - 1] || String(score);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={AppColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {sortedTasks.length === 0 && !isLoading ? (
          <EmptyState
            title="No Tasks Yet"
            message="Tap the record button below to capture your first home maintenance task"
          />
        ) : (
          <View style={[styles.tableContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
              <View style={styles.titleColumn}>
                <ThemedText style={[styles.headerText, { color: theme.textSecondary }]}>
                  Task
                </ThemedText>
              </View>
              <View style={styles.chipColumn}>
                <ThemedText style={[styles.headerText, { color: theme.textSecondary }]}>
                  Location
                </ThemedText>
              </View>
              <View style={styles.chipColumn}>
                <ThemedText style={[styles.headerText, { color: theme.textSecondary }]}>
                  Priority
                </ThemedText>
              </View>
              <View style={styles.smallColumn}>
                <ThemedText style={[styles.headerText, { color: theme.textSecondary }]}>
                  Effort
                </ThemedText>
              </View>
              <View style={styles.chipColumn}>
                <ThemedText style={[styles.headerText, { color: theme.textSecondary }]}>
                  Status
                </ThemedText>
              </View>
            </View>

            {sortedTasks.map((task, index) => (
              <View
                key={task.id}
                style={[
                  styles.taskRow,
                  index < sortedTasks.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <Pressable
                  style={styles.titleColumn}
                  onPress={() => handleTaskPress(task)}
                  testID={`task-row-${task.id}`}
                >
                  <View style={styles.titleContent}>
                    <Feather
                      name="chevron-right"
                      size={16}
                      color={theme.textSecondary}
                      style={styles.chevron}
                    />
                    <ThemedText
                      style={[
                        styles.taskTitle,
                        task.status === "Completed" && styles.completedTitle,
                      ]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </ThemedText>
                  </View>
                </Pressable>

                <View style={styles.chipColumn}>
                  <Chip
                    label={task.location}
                    variant="muted"
                    onPress={() => openPicker(task, "location")}
                    testID={`chip-location-${task.id}`}
                  />
                </View>

                <View style={styles.chipColumn}>
                  <Chip
                    label={task.priority}
                    variant={getChipVariantForPriority(task.priority)}
                    onPress={() => openPicker(task, "priority")}
                    testID={`chip-priority-${task.id}`}
                  />
                </View>

                <View style={styles.smallColumn}>
                  <Chip
                    label={getEffortLabel(task.effortScore)}
                    variant={getChipVariantForEffort(task.effortScore)}
                    onPress={() => openPicker(task, "effort")}
                    testID={`chip-effort-${task.id}`}
                  />
                </View>

                <View style={styles.chipColumn}>
                  <Chip
                    label={task.status}
                    variant={getChipVariantForStatus(task.status)}
                    onPress={() => openPicker(task, "status")}
                    testID={`chip-status-${task.id}`}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingRecordButton
        onPress={handleRecordPress}
        isProcessing={isProcessing}
      />

      <ProcessingOverlay visible={isProcessing} />

      <PropertyPicker
        visible={pickerState.visible}
        propertyType={pickerState.propertyType}
        currentValue={pickerState.currentValue}
        onSelect={handlePickerSelect}
        onClose={closePicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  tableContainer: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  headerText: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  titleColumn: {
    flex: 2,
    paddingRight: Spacing.sm,
  },
  titleContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  chevron: {
    marginRight: Spacing.xs,
    opacity: 0.5,
  },
  taskTitle: {
    ...Typography.small,
    fontWeight: "500",
    flex: 1,
  },
  completedTitle: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  chipColumn: {
    flex: 1,
    alignItems: "flex-start",
    paddingHorizontal: Spacing.xs,
  },
  smallColumn: {
    width: 50,
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
});
