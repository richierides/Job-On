import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Typography } from "@/constants/theme";
import { Task, HouseholdMember, PRIORITIES, LOCATIONS, Priority, Location } from "@shared/schema";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useUserSession } from "@/contexts/UserSessionContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { VideoPlayer } from "expo-video";

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
  const { session } = useUserSession();

  const { task: initialTask } = route.params;

  const [title, setTitle] = useState(initialTask.title);
  const [location, setLocation] = useState<Location>(initialTask.location as Location);
  const [priority, setPriority] = useState<Priority>(initialTask.priority as Priority);
  const [status, setStatus] = useState(initialTask.status);
  const [completedAt, setCompletedAt] = useState<Date | null>(
    initialTask.completedAt ? new Date(initialTask.completedAt) : null
  );
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assignedToId, setAssignedToId] = useState<number | null>(
    (initialTask as any).assignedToId ?? null
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(
    (initialTask as any).estimatedMinutes ?? null
  );
  const [subtasks, setSubtasks] = useState<{ title: string; completed: boolean }[]>(
    (initialTask as any).subtasks ?? []
  );
  const [shoppingList, setShoppingList] = useState<{ item: string; checked: boolean }[]>(
    (initialTask as any).shoppingList ?? []
  );
  const [newSubtask, setNewSubtask] = useState("");
  const [newShoppingItem, setNewShoppingItem] = useState("");
  const [showVideo, setShowVideo] = useState(false);

  const videoSource = initialTask.videoUrl
    ? `${getApiUrl()}${initialTask.videoUrl}`
    : null;

  const player = useVideoPlayer(videoSource, (p: VideoPlayer) => {
    p.loop = false;
  });

  const { data: members = [] } = useQuery<HouseholdMember[]>({
    queryKey: ["/api/households", session.householdId, "members"],
    queryFn: async () => {
      if (!session.householdId) return [];
      const response = await fetch(
        `${getApiUrl()}/api/households/${session.householdId}/members`
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!session.householdId,
  });

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
    const newCompletedAt = newStatus === "Completed" ? new Date() : null;
    setStatus(newStatus);
    setCompletedAt(newCompletedAt);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMutation.mutate({ status: newStatus, completedAt: newCompletedAt });
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

  const handleAssigneeSelect = useCallback(
    async (memberId: number | null) => {
      setAssignedToId(memberId);
      setShowAssigneePicker(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateMutation.mutate({ assignedToId: memberId } as any);
    },
    [updateMutation]
  );

  const assigneeName = members.find((m) => m.id === assignedToId)?.name || "Unassigned";

  const handleTimeChange = useCallback(
    (minutes: number | null) => {
      setEstimatedMinutes(minutes);
      updateMutation.mutate({ estimatedMinutes: minutes } as any);
    },
    [updateMutation]
  );

  const handleToggleSubtask = useCallback(
    async (index: number) => {
      const updated = subtasks.map((s, i) =>
        i === index ? { ...s, completed: !s.completed } : s
      );
      setSubtasks(updated);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateMutation.mutate({ subtasks: updated } as any);
    },
    [subtasks, updateMutation]
  );

  const handleAddSubtask = useCallback(() => {
    if (!newSubtask.trim()) return;
    const updated = [...subtasks, { title: newSubtask.trim(), completed: false }];
    setSubtasks(updated);
    setNewSubtask("");
    updateMutation.mutate({ subtasks: updated } as any);
  }, [newSubtask, subtasks, updateMutation]);

  const handleRemoveSubtask = useCallback(
    (index: number) => {
      const updated = subtasks.filter((_, i) => i !== index);
      setSubtasks(updated);
      updateMutation.mutate({ subtasks: updated } as any);
    },
    [subtasks, updateMutation]
  );

  const handleToggleShoppingItem = useCallback(
    async (index: number) => {
      const updated = shoppingList.map((s, i) =>
        i === index ? { ...s, checked: !s.checked } : s
      );
      setShoppingList(updated);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateMutation.mutate({ shoppingList: updated } as any);
    },
    [shoppingList, updateMutation]
  );

  const handleAddShoppingItem = useCallback(() => {
    if (!newShoppingItem.trim()) return;
    const updated = [...shoppingList, { item: newShoppingItem.trim(), checked: false }];
    setShoppingList(updated);
    setNewShoppingItem("");
    updateMutation.mutate({ shoppingList: updated } as any);
  }, [newShoppingItem, shoppingList, updateMutation]);

  const handleRemoveShoppingItem = useCallback(
    (index: number) => {
      const updated = shoppingList.filter((_, i) => i !== index);
      setShoppingList(updated);
      updateMutation.mutate({ shoppingList: updated } as any);
    },
    [shoppingList, updateMutation]
  );

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hr${hrs > 1 ? "s" : ""}`;
  };

  const subtaskCompletionPercent = subtasks.length > 0
    ? Math.round((subtasks.filter((s) => s.completed).length / subtasks.length) * 100)
    : 0;

  const TIME_PRESETS = [15, 30, 60, 120, 240, 480];

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
      {/* Video / Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {showVideo && videoSource ? (
          <View style={styles.videoContainer}>
            <VideoView
              style={styles.thumbnail}
              player={player}
              allowsFullscreen
              allowsPictureInPicture={Platform.OS !== "web"}
              contentFit="cover"
              nativeControls
            />
            <Pressable
              style={styles.videoCloseButton}
              onPress={() => {
                player.pause();
                setShowVideo(false);
              }}
              hitSlop={8}
            >
              <Feather name="x" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : initialTask.thumbnailUrl ? (
          <Pressable
            onPress={() => {
              if (videoSource) {
                setShowVideo(true);
                player.play();
              }
            }}
          >
            <Image
              source={{ uri: initialTask.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            {videoSource ? (
              <View style={styles.playButtonOverlay}>
                <View style={styles.playButton}>
                  <Feather name="play" size={28} color="#FFFFFF" />
                </View>
              </View>
            ) : null}
          </Pressable>
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

      {/* Assignee */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Assigned To</ThemedText>
        <Pressable
          style={[
            styles.pickerButton,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
          onPress={() => setShowAssigneePicker(!showAssigneePicker)}
          testID="button-assignee"
        >
          <Feather name="user" size={18} color={theme.textSecondary} />
          <ThemedText style={styles.pickerText}>{assigneeName}</ThemedText>
          <Feather
            name={showAssigneePicker ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.textSecondary}
          />
        </Pressable>

        {showAssigneePicker ? (
          <View style={[styles.optionsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Pressable
              style={[
                styles.optionItem,
                assignedToId === null && { backgroundColor: AppColors.primary + "20" },
              ]}
              onPress={() => handleAssigneeSelect(null)}
            >
              <ThemedText
                style={[
                  styles.optionText,
                  assignedToId === null && { color: AppColors.primary, fontWeight: "600" },
                ]}
              >
                Unassigned
              </ThemedText>
            </Pressable>
            {members.map((member) => (
              <Pressable
                key={member.id}
                style={[
                  styles.optionItem,
                  assignedToId === member.id && { backgroundColor: AppColors.primary + "20" },
                ]}
                onPress={() => handleAssigneeSelect(member.id)}
              >
                <ThemedText
                  style={[
                    styles.optionText,
                    assignedToId === member.id && { color: AppColors.primary, fontWeight: "600" },
                  ]}
                >
                  {member.name}
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

      {/* Estimated Time */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          Estimated Time {estimatedMinutes ? `(${formatTime(estimatedMinutes)})` : ""}
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timePresetsScroll}>
          <View style={styles.timePresetsRow}>
            {TIME_PRESETS.map((mins) => (
              <Pressable
                key={mins}
                style={[
                  styles.timePresetButton,
                  {
                    backgroundColor: estimatedMinutes === mins ? AppColors.primary : theme.backgroundDefault,
                    borderColor: estimatedMinutes === mins ? AppColors.primary : theme.border,
                  },
                ]}
                onPress={() => handleTimeChange(estimatedMinutes === mins ? null : mins)}
                testID={`button-time-${mins}`}
              >
                <ThemedText
                  style={[
                    styles.timePresetText,
                    { color: estimatedMinutes === mins ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {formatTime(mins)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Subtasks Checklist */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Steps
          </ThemedText>
          {subtasks.length > 0 ? (
            <View style={styles.progressBadge}>
              <View
                style={[
                  styles.progressBarTrack,
                  { backgroundColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: subtaskCompletionPercent === 100 ? AppColors.success : AppColors.primary,
                      width: `${subtaskCompletionPercent}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
                {subtaskCompletionPercent}%
              </ThemedText>
            </View>
          ) : null}
        </View>
        {subtasks.map((subtask, index) => (
          <Pressable
            key={index}
            style={[styles.checklistItem, { borderColor: theme.border }]}
            onPress={() => handleToggleSubtask(index)}
            testID={`subtask-${index}`}
          >
            <Feather
              name={subtask.completed ? "check-square" : "square"}
              size={20}
              color={subtask.completed ? AppColors.success : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.checklistText,
                subtask.completed && styles.checklistTextCompleted,
              ]}
            >
              {subtask.title}
            </ThemedText>
            <Pressable onPress={() => handleRemoveSubtask(index)} hitSlop={8}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          </Pressable>
        ))}
        <View style={[styles.addItemRow, { borderColor: theme.border }]}>
          <TextInput
            style={[styles.addItemInput, { color: theme.text }]}
            value={newSubtask}
            onChangeText={setNewSubtask}
            placeholder="Add a step..."
            placeholderTextColor={theme.textSecondary}
            onSubmitEditing={handleAddSubtask}
            returnKeyType="done"
            testID="input-new-subtask"
          />
          <Pressable onPress={handleAddSubtask} testID="button-add-subtask">
            <Feather name="plus-circle" size={22} color={AppColors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Shopping List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Shopping List
          </ThemedText>
          {shoppingList.length > 0 ? (
            <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
              {shoppingList.filter((s) => s.checked).length}/{shoppingList.length}
            </ThemedText>
          ) : null}
        </View>
        {shoppingList.map((item, index) => (
          <Pressable
            key={index}
            style={[styles.checklistItem, { borderColor: theme.border }]}
            onPress={() => handleToggleShoppingItem(index)}
            testID={`shopping-item-${index}`}
          >
            <Feather
              name={item.checked ? "check-square" : "square"}
              size={20}
              color={item.checked ? AppColors.success : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.checklistText,
                item.checked && styles.checklistTextCompleted,
              ]}
            >
              {item.item}
            </ThemedText>
            <Pressable onPress={() => handleRemoveShoppingItem(index)} hitSlop={8}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          </Pressable>
        ))}
        <View style={[styles.addItemRow, { borderColor: theme.border }]}>
          <TextInput
            style={[styles.addItemInput, { color: theme.text }]}
            value={newShoppingItem}
            onChangeText={setNewShoppingItem}
            placeholder="Add an item..."
            placeholderTextColor={theme.textSecondary}
            onSubmitEditing={handleAddShoppingItem}
            returnKeyType="done"
            testID="input-new-shopping"
          />
          <Pressable onPress={handleAddShoppingItem} testID="button-add-shopping">
            <Feather name="shopping-cart" size={20} color={AppColors.primary} />
          </Pressable>
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

      {/* Completion Date */}
      {completedAt ? (
        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Completed On
          </ThemedText>
          <View style={[styles.dateContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="check-circle" size={18} color={AppColors.success} />
            <ThemedText style={styles.dateText}>
              {completedAt.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Created Date */}
      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          Created On
        </ThemedText>
        <View style={[styles.dateContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Feather name="calendar" size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.dateText, { color: theme.textSecondary }]}>
            {new Date(initialTask.createdAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </ThemedText>
        </View>
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
  videoContainer: {
    position: "relative",
  },
  videoCloseButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: BorderRadius.sm,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
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
  timePresetsScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  timePresetsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  timePresetButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  timePresetText: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBarTrack: {
    width: 60,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checklistText: {
    flex: 1,
    fontSize: Typography.body.fontSize,
  },
  checklistTextCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  addItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addItemInput: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
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
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  dateText: {
    fontSize: Typography.body.fontSize,
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
