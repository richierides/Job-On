import React, { useCallback, useState, useMemo } from "react";
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
import { PropertyPicker } from "@/components/PropertyPicker";
import { FilterBar, FilterState } from "@/components/FilterBar";
import { TaskCard } from "@/components/TaskCard";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Task, UpdateTask, HouseholdMember } from "@shared/schema";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "TaskDashboard">;

type PropertyType = "priority" | "status" | "location" | "effort" | "assignee";

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
  const { session } = useUserSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "materials">("tasks");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: null,
    priority: null,
    location: null,
    assignedToId: null,
  });
  const [pickerState, setPickerState] = useState<PickerState>({
    visible: false,
    propertyType: "status",
    taskId: null,
    currentValue: "",
  });

  const { data: tasks = [], isLoading, refetch } = useQuery<Task[]>({
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

  const { data: members = [] } = useQuery<HouseholdMember[]>({
    queryKey: ["/api/households", session.householdId, "members"],
    queryFn: async () => {
      if (!session.householdId) return [];
      const response = await fetch(`${getApiUrl()}/api/households/${session.householdId}/members`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!session.householdId,
  });

  const membersMap = useMemo(() => {
    const map: Record<number, string> = {};
    members.forEach(m => { map[m.id] = m.name; });
    return map;
  }, [members]);

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.location && task.location !== filters.location) return false;
      if (filters.assignedToId && task.assignedToId !== filters.assignedToId) return false;
      return true;
    });
  }, [tasks, filters]);

  const activeFilterCount = useMemo(() => {
    return [filters.status, filters.priority, filters.location, filters.assignedToId].filter(Boolean).length;
  }, [filters]);

  const aggregatedMaterials = useMemo(() => {
    const items: { item: string; checked: boolean; taskId: number; taskTitle: string }[] = [];
    tasks.forEach((task) => {
      if (task.shoppingList && Array.isArray(task.shoppingList)) {
        task.shoppingList.forEach((entry) => {
          items.push({
            item: entry.item,
            checked: entry.checked,
            taskId: task.id,
            taskTitle: task.title,
          });
        });
      }
    });
    return items;
  }, [tasks]);

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
        case "assignee":
          currentValue = task.assignedToId || 0;
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
          if (value === "Completed") {
            updateData.completedAt = new Date();
          } else {
            updateData.completedAt = null;
          }
          break;
        case "location":
          updateData.location = String(value);
          break;
        case "effort":
          updateData.effortScore = Number(value);
          break;
        case "assignee":
          updateData.assignedToId = value === 0 ? null : Number(value);
          break;
      }

      updateMutation.mutate({ id: pickerState.taskId, data: updateData });
    },
    [pickerState, updateMutation]
  );

  const closePicker = useCallback(() => {
    setPickerState((prev) => ({ ...prev, visible: false }));
  }, []);

  const toggleFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilters((prev) => !prev);
  }, []);

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
        <Pressable
          style={[styles.filterToggle, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={toggleFilters}
        >
          <View style={styles.filterToggleLeft}>
            <Feather name="filter" size={18} color={theme.textSecondary} />
            <ThemedText style={[styles.filterToggleText, { color: theme.text }]}>
              {showFilters ? "Hide Filters" : "Show Filters"}
            </ThemedText>
            {activeFilterCount > 0 ? (
              <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
              </View>
            ) : null}
          </View>
          <Feather name={showFilters ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
        </Pressable>

        {showFilters ? (
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            memberOptions={members.map((m) => ({ id: m.id, name: m.name }))}
          />
        ) : null}

        <View style={[styles.tabRow, { borderColor: theme.border }]}>
          <Pressable
            style={[
              styles.tab,
              activeTab === "tasks" ? [styles.tabActive, { borderBottomColor: theme.primary }] : null,
            ]}
            onPress={() => setActiveTab("tasks")}
            testID="tab-tasks"
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === "tasks" ? theme.primary : theme.textSecondary },
              ]}
            >
              Tasks
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === "materials" ? [styles.tabActive, { borderBottomColor: theme.primary }] : null,
            ]}
            onPress={() => setActiveTab("materials")}
            testID="tab-materials"
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === "materials" ? theme.primary : theme.textSecondary },
              ]}
            >
              Materials List
            </ThemedText>
          </Pressable>
        </View>

        {activeTab === "tasks" ? (
          filteredTasks.length === 0 && !isLoading ? (
            <EmptyState
              title={activeFilterCount > 0 ? "No Matching Tasks" : "No Tasks Yet"}
              message={
                activeFilterCount > 0
                  ? "Try adjusting your filters to see more tasks"
                  : "Tap the record button below to capture your first home maintenance task"
              }
            />
          ) : (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assigneeName={task.assignedToId ? membersMap[task.assignedToId] : undefined}
                onPress={() => handleTaskPress(task)}
                onPropertyPress={(propertyType) => openPicker(task, propertyType)}
              />
            ))
          )
        ) : aggregatedMaterials.length === 0 ? (
          <EmptyState
            title="No Materials Yet"
            message="Materials mentioned in your task recordings will appear here"
          />
        ) : (
          <View style={styles.materialsContainer}>
            {aggregatedMaterials.map((mat, index) => (
              <Pressable
                key={`${mat.taskId}-${index}`}
                style={[styles.materialRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => {
                  const task = tasks.find((t) => t.id === mat.taskId);
                  if (task) handleTaskPress(task);
                }}
                testID={`material-item-${index}`}
              >
                <Feather
                  name={mat.checked ? "check-square" : "square"}
                  size={20}
                  color={mat.checked ? AppColors.success : theme.textSecondary}
                />
                <View style={styles.materialInfo}>
                  <ThemedText style={[styles.materialName, mat.checked ? styles.materialChecked : null]}>
                    {mat.item}
                  </ThemedText>
                  <ThemedText style={[styles.materialTask, { color: theme.textSecondary }]}>
                    {mat.taskTitle}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={16} color={theme.textSecondary} />
              </Pressable>
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
        members={members}
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
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  filterToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  materialsContainer: {
    gap: Spacing.sm,
  },
  materialRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 15,
    fontWeight: "500",
  },
  materialChecked: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  materialTask: {
    fontSize: 12,
    marginTop: 2,
  },
});
