import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { Task, HouseholdMember } from "@shared/schema";
import { apiRequest, getApiUrl } from "@/lib/query-client";

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

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { session } = useUserSession();
  const chatScrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});

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
        const expanded: Record<number, boolean> = {};
        parsedPlan.weeks.forEach((w) => {
          expanded[w.weekNumber] = true;
        });
        setExpandedWeeks(expanded);
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
          <Feather name="calendar" size={18} color={theme.primary} />
          <ThemedText style={[styles.planTitle, { color: theme.text }]}>
            Your Plan
          </ThemedText>
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
                  {week.tasks.map((task, idx) => (
                    <View
                      key={idx}
                      style={[styles.taskRow, { backgroundColor: theme.backgroundSecondary }]}
                    >
                      <View style={styles.taskRowLeft}>
                        <Feather name="check-circle" size={16} color={theme.textSecondary} />
                        <View style={styles.taskInfo}>
                          <ThemedText style={[styles.taskName, { color: theme.text }]}>
                            {task.taskTitle}
                          </ThemedText>
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
                      <ThemedText style={[styles.taskTime, { color: theme.textSecondary }]}>
                        {formatMinutes(task.estimatedMinutes)}
                      </ThemedText>
                    </View>
                  ))}
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
    >
      <View style={[styles.planPanel, { paddingTop: headerHeight + Spacing.sm, backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}>
        {renderPlanPanel()}
      </View>

      <View style={[styles.chatPanel, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.chatHeaderRow}>
          <Feather name="message-circle" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.chatHeaderText, { color: theme.textSecondary }]}>
            Chat
          </ThemedText>
        </View>

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
      </View>

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
    borderBottomWidth: 1,
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
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "700",
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
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 14,
    fontWeight: "500",
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
    marginLeft: Spacing.sm,
  },
  chatPanel: {
    flex: 1,
    minHeight: 160,
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  chatHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
