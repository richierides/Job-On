import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { Task, HouseholdMember } from "@shared/schema";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const RIBBON_HEIGHT = 44;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };
const MINIMIZE_THRESHOLD = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PlanWeek {
  weekNumber: number;
  label: string;
  tasks: {
    taskTitle: string;
    assignee: string | null;
    estimatedMinutes: number;
    day: string;
  }[];
  totalMinutes: number;
}

interface Plan {
  startDate: string;
  weeks: PlanWeek[];
}

function parsePlanFromMessage(content: string): Plan | null {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.plan && parsed.plan.weeks) {
      return parsed.plan;
    }
    return null;
  } catch {
    return null;
  }
}

function getMessageTextOnly(content: string): string {
  return content.replace(/```json[\s\S]*?```/g, "").trim();
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { session } = useUserSession();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp>();
  const chatScrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [containerHeight, setContainerHeight] = useState(600);
  const [isSaved, setIsSaved] = useState(false);

  const chatFraction = useSharedValue(0.5);
  const savedFraction = useSharedValue(0.5);
  const isMinimized = useSharedValue(false);

  const inputBarHeight = 42 + Spacing.sm + Math.max(insets.bottom, Spacing.sm);

  const maxChatFraction = 0.65;
  const minChatFraction = 0;

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerHeight(e.nativeEvent.layout.height);
  }, []);

  const availableHeight = containerHeight - headerHeight - inputBarHeight;

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedFraction.value = chatFraction.value;
    })
    .onUpdate((e) => {
      const dragFraction = e.translationY / availableHeight;
      const newFraction = savedFraction.value - dragFraction;
      chatFraction.value = Math.max(minChatFraction, Math.min(maxChatFraction, newFraction));
    })
    .onEnd((e) => {
      if (e.translationY > MINIMIZE_THRESHOLD && savedFraction.value > 0.1) {
        chatFraction.value = withSpring(minChatFraction, SPRING_CONFIG);
        isMinimized.value = true;
        runOnJS(triggerHaptic)();
        runOnJS(dismissKeyboard)();
      } else if (e.translationY < -MINIMIZE_THRESHOLD && isMinimized.value) {
        chatFraction.value = withSpring(0.5, SPRING_CONFIG);
        isMinimized.value = false;
        runOnJS(triggerHaptic)();
      } else {
        const snapTo = chatFraction.value < 0.1 ? minChatFraction : chatFraction.value;
        chatFraction.value = withSpring(snapTo, SPRING_CONFIG);
        isMinimized.value = snapTo < 0.1;
        if (snapTo < 0.1) {
          runOnJS(dismissKeyboard)();
        }
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isMinimized.value) {
      chatFraction.value = withSpring(0.5, SPRING_CONFIG);
      isMinimized.value = false;
      runOnJS(triggerHaptic)();
    }
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const chatPanelStyle = useAnimatedStyle(() => {
    const chatHeight = RIBBON_HEIGHT + chatFraction.value * availableHeight;
    return {
      height: chatHeight,
    };
  });

  const chatContentOpacity = useAnimatedStyle(() => {
    return {
      opacity: interpolate(chatFraction.value, [0, 0.15], [0, 1]),
    };
  });

  const chevronStyle = useAnimatedStyle(() => {
    const rotation = interpolate(chatFraction.value, [0, 0.3], [180, 0]);
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
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

  const pendingTasks = useMemo(
    () => tasksList.filter((t) => t.status !== "Completed"),
    [tasksList]
  );

  const savePlanMutation = useMutation({
    mutationFn: async (planData: Plan) => {
      return apiRequest("POST", "/api/plans", {
        householdId: session.householdId,
        name: `Plan - ${new Date().toLocaleDateString()}`,
        planData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setIsSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  useEffect(() => {
    if (messages.length === 0 && pendingTasks.length >= 0) {
      const greeting: ChatMessage = {
        role: "assistant",
        content:
          pendingTasks.length > 0
            ? `I can see you have ${pendingTasks.length} task${pendingTasks.length === 1 ? "" : "s"} to plan. Let's get your schedule sorted!\n\nWhen would you like to start working on these? (e.g. "this weekend", "next Monday")`
            : "You don't have any pending tasks yet. Record some tasks first, then come back and I'll help you plan your work!",
      };
      setMessages([greeting]);
    }
  }, [pendingTasks.length]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setIsLoading(true);

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await apiRequest("POST", "/api/plan/chat", {
        messages: newMessages,
        householdName: session.householdName,
        tasks: pendingTasks.map((t) => ({
          title: t.title,
          location: t.location,
          priority: t.priority,
          effortScore: t.effortScore,
          estimatedMinutes: t.estimatedMinutes,
        })),
        members: members.map((m) => ({ name: m.name })),
      });

      const data = await res.json();
      const reply = data.reply || "Sorry, something went wrong.";
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };

      setMessages((prev) => [...prev, assistantMsg]);

      const parsedPlan = parsePlanFromMessage(reply);
      if (parsedPlan) {
        setPlan(parsedPlan);
        setIsSaved(false);
        const expanded: Record<number, boolean> = {};
        parsedPlan.weeks.forEach((w) => {
          expanded[w.weekNumber] = true;
        });
        setExpandedWeeks(expanded);
        setExpandedTasks({});
      }
    } catch (error) {
      console.error("Plan chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble generating a response. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [inputText, isLoading, messages, pendingTasks, members]);

  const toggleWeek = useCallback((weekNumber: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekNumber]: !prev[weekNumber],
    }));
  }, []);

  const toggleTaskDetail = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedTasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleSavePlan = useCallback(() => {
    if (!plan || isSaved) return;
    savePlanMutation.mutate(plan);
  }, [plan, isSaved, savePlanMutation]);

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

  const renderTaskDetail = (matchedTask: Task) => {
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
              <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
                {progress}%
              </ThemedText>
            </View>
            {subtasks.map((sub: any, idx: number) => (
              <Pressable
                key={idx}
                style={styles.subtaskRow}
                onPress={() => handleToggleSubtask(matchedTask, idx)}
                hitSlop={6}
                testID={`plan-subtask-${matchedTask.id}-${idx}`}
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
                testID={`plan-shopping-${matchedTask.id}-${idx}`}
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

  const renderPlanPanel = () => {
    if (!plan) {
      return (
        <View style={styles.planEmptyState}>
          <Feather name="calendar" size={28} color={theme.textSecondary} />
          <ThemedText style={[styles.planEmptyTitle, { color: theme.textSecondary }]}>
            No plan yet
          </ThemedText>
          <ThemedText style={[styles.planEmptyHint, { color: theme.textSecondary }]}>
            Chat below to generate your work schedule
          </ThemedText>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.planScroll}
        contentContainerStyle={styles.planScrollContent}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        testID="plan-scroll-area"
      >
        <View style={styles.planHeaderRow}>
          <View style={styles.planHeaderLeft}>
            <Feather name="calendar" size={18} color={theme.primary} />
            <ThemedText style={[styles.planTitle, { color: theme.text }]}>
              Your Plan
            </ThemedText>
          </View>
          <Pressable
            style={[
              styles.savePlanButton,
              {
                backgroundColor: isSaved ? AppColors.success : theme.primary,
                opacity: savePlanMutation.isPending ? 0.6 : 1,
              },
            ]}
            onPress={handleSavePlan}
            disabled={isSaved || savePlanMutation.isPending}
            testID="button-save-plan"
          >
            {savePlanMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name={isSaved ? "check" : "save"} size={14} color="#FFFFFF" />
                <ThemedText style={styles.savePlanText}>
                  {isSaved ? "Saved" : "Save Plan"}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {plan.weeks.map((week) => {
          const isExpanded = expandedWeeks[week.weekNumber] !== false;
          return (
            <View key={week.weekNumber} style={[styles.weekSection, { borderColor: theme.border }]}>
              <Pressable
                style={styles.weekHeader}
                onPress={() => toggleWeek(week.weekNumber)}
                testID={`week-header-${week.weekNumber}`}
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
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>

              {isExpanded ? (
                <View style={styles.weekTasks}>
                  {week.tasks.map((task, idx) => {
                    const taskKey = `${week.weekNumber}-${idx}`;
                    const isTaskExpanded = expandedTasks[taskKey] === true;
                    const matchedTask = findMatchingTask(task.taskTitle, tasksList);

                    return (
                      <View key={idx}>
                        <Pressable
                          style={[styles.taskRow, { backgroundColor: theme.backgroundSecondary }]}
                          onPress={matchedTask ? () => toggleTaskDetail(taskKey) : undefined}
                          testID={`plan-task-${week.weekNumber}-${idx}`}
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

                        {isTaskExpanded && matchedTask ? renderTaskDetail(matchedTask) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderChatMessages = () => {
    return messages.map((msg, index) => {
      const isUser = msg.role === "user";
      const displayText = isUser ? msg.content : getMessageTextOnly(msg.content);

      if (!displayText) return null;

      return (
        <View
          key={index}
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: theme.primary }]
              : [styles.assistantBubble, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }],
          ]}
        >
          <ThemedText
            style={[
              styles.messageText,
              { color: isUser ? "#FFFFFF" : theme.text },
            ]}
          >
            {displayText}
          </ThemedText>
        </View>
      );
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior="padding"
      keyboardVerticalOffset={0}
      onLayout={onContainerLayout}
    >
      <View style={[styles.planPanel, { paddingTop: headerHeight + Spacing.sm, backgroundColor: theme.backgroundDefault }]}>
        {renderPlanPanel()}
      </View>

      <Animated.View style={[styles.chatPanelAnimated, { backgroundColor: theme.backgroundRoot, borderTopColor: theme.border }, chatPanelStyle]}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.chatRibbon, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.ribbonContent}>
              <Feather name="message-circle" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.chatHeaderText, { color: theme.textSecondary }]}>
                Chat
              </ThemedText>
            </View>
            <Animated.View style={chevronStyle}>
              <Feather name="chevron-up" size={16} color={theme.textSecondary} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <Animated.View style={[styles.chatBody, chatContentOpacity]}>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            testID="chat-scroll-area"
          >
            {renderChatMessages()}

            {isLoading ? (
              <View style={[styles.loadingBubble, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Thinking...
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </Animated.View>

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: theme.backgroundDefault,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            pendingTasks.length === 0
              ? "No tasks to plan yet..."
              : "Type your message..."
          }
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={500}
          editable={pendingTasks.length > 0}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={sendMessage}
          testID="input-plan-message"
        />
        <Pressable
          style={[
            styles.sendButton,
            {
              backgroundColor:
                inputText.trim() && !isLoading
                  ? theme.primary
                  : theme.backgroundTertiary,
            },
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isLoading || pendingTasks.length === 0}
          testID="button-send-plan"
        >
          <Feather
            name="send"
            size={18}
            color={
              inputText.trim() && !isLoading ? "#FFFFFF" : theme.textSecondary
            }
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  planPanel: {
    flex: 1,
    minHeight: 140,
  },
  planEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  planEmptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  planEmptyHint: {
    fontSize: 13,
    textAlign: "center",
  },
  planScroll: {
    flex: 1,
  },
  planScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  planHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  savePlanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  savePlanText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  weekSection: {
    borderTopWidth: 1,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
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
  progressText: {
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
  chatPanelAnimated: {
    overflow: "hidden",
    borderTopWidth: 1,
  },
  chatRibbon: {
    height: RIBBON_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 0,
  },
  dragHandle: {
    position: "absolute",
    top: 6,
    left: "50%",
    marginLeft: -18,
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  ribbonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  chatHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chatBody: {
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  messageBubble: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    borderWidth: 1,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
