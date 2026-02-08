import React, { useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

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

export default function SavedPlansScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { session } = useUserSession();
  const queryClient = useQueryClient();

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

                {plan.planData.weeks.map((week) => (
                  <View
                    key={week.weekNumber}
                    style={[styles.weekPreview, { borderTopColor: theme.border }]}
                  >
                    <View style={styles.weekPreviewHeader}>
                      <ThemedText style={[styles.weekPreviewLabel, { color: theme.text }]}>
                        {week.label}
                      </ThemedText>
                      <ThemedText style={[styles.weekPreviewTime, { color: theme.textSecondary }]}>
                        {formatMinutes(week.totalMinutes)}
                      </ThemedText>
                    </View>
                    {week.tasks.map((task, idx) => (
                      <View key={idx} style={styles.taskPreviewRow}>
                        <Feather name="check-circle" size={13} color={theme.textSecondary} />
                        <ThemedText
                          style={[styles.taskPreviewText, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {task.taskTitle}
                        </ThemedText>
                        {task.day ? (
                          <ThemedText style={[styles.taskPreviewDay, { color: theme.textSecondary }]}>
                            {task.day}
                          </ThemedText>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
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
  weekPreview: {
    borderTopWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  weekPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  weekPreviewLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  weekPreviewTime: {
    fontSize: 12,
  },
  taskPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  taskPreviewText: {
    fontSize: 13,
    flex: 1,
  },
  taskPreviewDay: {
    fontSize: 11,
  },
});
