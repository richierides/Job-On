import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { Task } from "@shared/schema";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SavedPlan {
  id: number;
  householdId: number;
  name: string;
  planData: {
    startDate: string;
    weeks: {
      weekNumber: number;
      label: string;
      tasks: {
        taskTitle: string;
        assignee: string | null;
        estimatedMinutes: number;
        day: string;
      }[];
      totalMinutes: number;
    }[];
  };
  createdAt: string;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function findMatchingTask(taskTitle: string, tasks: Task[]): Task | null {
  const normalized = taskTitle.toLowerCase().trim();
  return tasks.find((t) => t.title.toLowerCase().trim() === normalized) || null;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "High":
      return AppColors.error;
    case "Medium":
      return AppColors.warning;
    case "Low":
      return AppColors.success;
    default:
      return AppColors.primary;
  }
}

export default function SavedPlansScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { session } = useUserSession();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp>();

  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const {
    data: plans = [],
    isLoading,
    refetch,
  } = useQuery<SavedPlan[]>({
    queryKey: ["/api/plans", { householdId: session.householdId }],
    queryFn: async () => {
      if (!session.householdId) return [];
      const response = await fetch(
        `${getApiUrl()}/api/plans?householdId=${session.householdId}`
      );
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
    enabled: !!session.householdId,
  });

  const { data: tasksList = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { householdId: session.householdId }],
    queryFn: async () => {
      const url = session.householdId
        ? `${getApiUrl()}/api/tasks?householdId=${session.householdId}`
        : `${getApiUrl()}/api/tasks`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (planId: number) => {
      return apiRequest("DELETE", `/api/plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleDelete = useCallback(
    (planId: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      deleteMutation.mutate(planId);
    },
    [deleteMutation]
  );

  const toggleWeek = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWeeks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleTaskDetail = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedTasks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleSubtask = useCallback(
    async (task: Task, subtaskIndex: number) => {
      const subtasks = ((task as any).subtasks as any[] | null) || [];
      const updated = subtasks.map((s, i) =>
        i === subtaskIndex ? { ...s, completed: !s.completed } : s
      );
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { subtasks: updated });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    [queryClient]
  );

  const handleToggleShoppingItem = useCallback(
    async (task: Task, itemIndex: number) => {
      const shoppingList = ((task as any).shoppingList as any[] | null) || [];
      const updated = shoppingList.map((s, i) =>
        i === itemIndex ? { ...s, checked: !s.checked } : s
      );
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { shoppingList: updated });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    [queryClient]
  );

  const navigateToTask = useCallback(
    (task: Task) => {
      navigation.navigate("TaskDetail", { task });
    },
    [navigation]
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderTaskExpandedDetail = (matchedTask: Task) => {
    const subtasks = (matchedTask.subtasks as any[] | null) || [];
    const shoppingList = (matchedTask.shoppingList as any[] | null) || [];
    const completedSubtasks = subtasks.filter((s) => s.completed).length;
    const totalSubtasks = subtasks.length;
    const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    return (
      <View style={[styles.taskDetailContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Feather name="map-pin" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              {matchedTask.location}
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(matchedTask.priority) }]} />
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              {matchedTask.priority}
            </ThemedText>
          </View>
          <View style={styles.detailItem}>
            <Feather name="zap" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              Effort {matchedTask.effortScore}/5
            </ThemedText>
          </View>
        </View>

        {totalSubtasks > 0 ? (
          <View style={styles.subtasksSection}>
            <View style={styles.subtasksHeader}>
              <ThemedText style={[styles.subtasksSectionTitle, { color: theme.text }]}>
                Subtasks ({completedSubtasks}/{totalSubtasks})
              </ThemedText>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: AppColors.success }]} />
              </View>
              <ThemedText style={[styles.progressPercent, { color: theme.textSecondary }]}>
                {progress}%
              </ThemedText>
            </View>
            {subtasks.map((sub: any, idx: number) => (
              <Pressable
                key={idx}
                style={styles.subtaskRow}
                onPress={() => handleToggleSubtask(matchedTask, idx)}
                hitSlop={6}
                testID={`saved-subtask-${matchedTask.id}-${idx}`}
              >
                <Feather
                  name={sub.completed ? "check-square" : "square"}
                  size={14}
                  color={sub.completed ? AppColors.success : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.subtaskText,
                    { color: sub.completed ? theme.textSecondary : theme.text },
                    sub.completed ? styles.subtaskCompleted : null,
                  ]}
                >
                  {sub.title}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {shoppingList.length > 0 ? (
          <View style={styles.shoppingSection}>
            <ThemedText style={[styles.subtasksSectionTitle, { color: theme.text }]}>
              Materials Needed
            </ThemedText>
            {shoppingList.map((item: any, idx: number) => (
              <Pressable
                key={idx}
                style={styles.subtaskRow}
                onPress={() => handleToggleShoppingItem(matchedTask, idx)}
                hitSlop={6}
                testID={`saved-shopping-${matchedTask.id}-${idx}`}
              >
                <Feather
                  name={item.checked ? "check-square" : "square"}
                  size={14}
                  color={item.checked ? AppColors.success : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.subtaskText,
                    { color: item.checked ? theme.textSecondary : theme.text },
                    item.checked ? styles.subtaskCompleted : null,
                  ]}
                >
                  {item.item}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          style={[styles.viewTaskButton, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }]}
          onPress={() => navigateToTask(matchedTask)}
          testID={`button-view-task-${matchedTask.id}`}
        >
          <ThemedText style={[styles.viewTaskText, { color: theme.primary }]}>
            View Full Task
          </ThemedText>
          <Feather name="arrow-right" size={14} color={theme.primary} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={AppColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {plans.length === 0 && !isLoading ? (
          <EmptyState
            title="No Saved Plans"
            message="When you generate a plan using Plan My Work, you can save it here for later reference"
          />
        ) : (
          plans.map((plan) => {
            const totalTasks = plan.planData.weeks.reduce(
              (sum, w) => sum + w.tasks.length,
              0
            );
            const totalTime = plan.planData.weeks.reduce(
              (sum, w) => sum + w.totalMinutes,
              0
            );

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
                testID={`saved-plan-${plan.id}`}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Feather name="calendar" size={18} color={theme.primary} />
                    <View>
                      <ThemedText style={[styles.planName, { color: theme.text }]}>
                        {plan.name}
                      </ThemedText>
                      <ThemedText style={[styles.planDate, { color: theme.textSecondary }]}>
                        Created {formatDate(plan.createdAt)}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(plan.id)}
                    hitSlop={8}
                    testID={`button-delete-plan-${plan.id}`}
                  >
                    <Feather name="trash-2" size={18} color={AppColors.error} />
                  </Pressable>
                </View>

                <View style={styles.cardStats}>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="layers" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                      {plan.planData.weeks.length} week{plan.planData.weeks.length !== 1 ? "s" : ""}
                    </ThemedText>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="check-circle" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                      {totalTasks} task{totalTasks !== 1 ? "s" : ""}
                    </ThemedText>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="clock" size={12} color={theme.textSecondary} />
                    <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                      {formatMinutes(totalTime)}
                    </ThemedText>
                  </View>
                </View>

                {plan.planData.weeks.map((week) => {
                  const weekKey = `${plan.id}-${week.weekNumber}`;
                  const isWeekExpanded = expandedWeeks[weekKey] !== false;

                  return (
                    <View
                      key={week.weekNumber}
                      style={[styles.weekSection, { borderTopColor: theme.border }]}
                    >
                      <Pressable
                        style={styles.weekHeader}
                        onPress={() => toggleWeek(weekKey)}
                        testID={`saved-week-${plan.id}-${week.weekNumber}`}
                      >
                        <View style={styles.weekHeaderLeft}>
                          <ThemedText style={[styles.weekLabel, { color: theme.text }]}>
                            {week.label}
                          </ThemedText>
                          <ThemedText style={[styles.weekTotal, { color: theme.textSecondary }]}>
                            {formatMinutes(week.totalMinutes)}
                          </ThemedText>
                        </View>
                        <Feather
                          name={isWeekExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={theme.textSecondary}
                        />
                      </Pressable>

                      {isWeekExpanded ? (
                        <View style={styles.weekTasks}>
                          {week.tasks.map((task, idx) => {
                            const taskKey = `${plan.id}-${week.weekNumber}-${idx}`;
                            const isTaskExpanded = expandedTasks[taskKey] === true;
                            const matchedTask = findMatchingTask(task.taskTitle, tasksList);

                            return (
                              <View key={idx}>
                                <Pressable
                                  style={[styles.taskRow, { backgroundColor: theme.backgroundSecondary }]}
                                  onPress={matchedTask ? () => toggleTaskDetail(taskKey) : undefined}
                                  testID={`saved-task-${plan.id}-${week.weekNumber}-${idx}`}
                                >
                                  <View style={styles.taskRowLeft}>
                                    <Feather name="check-circle" size={16} color={theme.textSecondary} />
                                    <View style={styles.taskInfo}>
                                      <Pressable
                                        onPress={matchedTask ? () => navigateToTask(matchedTask) : undefined}
                                        disabled={!matchedTask}
                                        hitSlop={4}
                                      >
                                        <ThemedText
                                          style={[
                                            styles.taskName,
                                            { color: matchedTask ? theme.primary : theme.text },
                                            matchedTask ? styles.taskNameLink : null,
                                          ]}
                                        >
                                          {task.taskTitle}
                                        </ThemedText>
                                      </Pressable>
                                      <View style={styles.taskMeta}>
                                        {task.day ? (
                                          <View style={[styles.chip, { backgroundColor: theme.backgroundTertiary }]}>
                                            <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                                              {task.day}
                                            </ThemedText>
                                          </View>
                                        ) : null}
                                        {task.assignee ? (
                                          <View style={[styles.chip, { backgroundColor: theme.backgroundTertiary }]}>
                                            <Feather name="user" size={10} color={theme.textSecondary} />
                                            <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                                              {task.assignee}
                                            </ThemedText>
                                          </View>
                                        ) : null}
                                      </View>
                                    </View>
                                  </View>
                                  <View style={styles.taskRowRight}>
                                    <ThemedText style={[styles.taskTime, { color: theme.textSecondary }]}>
                                      {formatMinutes(task.estimatedMinutes)}
                                    </ThemedText>
                                    {matchedTask ? (
                                      <Feather
                                        name={isTaskExpanded ? "chevron-up" : "chevron-down"}
                                        size={14}
                                        color={theme.textSecondary}
                                      />
                                    ) : null}
                                  </View>
                                </Pressable>

                                {isTaskExpanded && matchedTask ? renderTaskExpandedDetail(matchedTask) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
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
  planCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  planName: {
    fontSize: 15,
    fontWeight: "600",
  },
  planDate: {
    fontSize: 12,
    marginTop: 2,
  },
  cardStats: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statText: {
    fontSize: 11,
    fontWeight: "500",
  },
  weekSection: {
    borderTopWidth: 1,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  weekHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  weekTotal: {
    fontSize: 13,
    fontWeight: "500",
  },
  weekTasks: {
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
  },
  taskRowLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    flex: 1,
  },
  taskRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 14,
    fontWeight: "500",
  },
  taskNameLink: {
    textDecorationLine: "underline" as const,
  },
  taskMeta: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 4,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  taskTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  taskDetailContainer: {
    marginTop: 2,
    marginHorizontal: 4,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subtasksSection: {
    gap: 4,
  },
  subtasksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  subtasksSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: "500",
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 2,
    paddingLeft: 2,
  },
  subtaskText: {
    fontSize: 12,
    flex: 1,
  },
  subtaskCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  shoppingSection: {
    gap: 4,
  },
  viewTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  viewTaskText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
