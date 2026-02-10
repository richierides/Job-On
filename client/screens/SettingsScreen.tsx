import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Linking, useColorScheme, Platform, Modal, TextInput, ActivityIndicator, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, AppColors, Typography } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

interface SettingsRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  rightElement,
}: SettingsRowProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: AppColors.primary + "20" }]}>
        <Feather name={icon} size={18} color={AppColors.primary} />
      </View>
      <View style={styles.rowContent}>
        <ThemedText style={styles.rowTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightElement}
      {showChevron && onPress ? (
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

interface HouseholdEntry {
  memberId: number;
  memberName: string;
  householdId: number;
  householdName: string;
  inviteCode: string;
}

type ModalType = "switch" | "create" | "join" | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const systemColorScheme = useColorScheme();
  const { session, setSession, clearSession } = useUserSession();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [householdList, setHouseholdList] = useState<HouseholdEntry[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleOpenWebsite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL("https://replit.com");
  };

  const handleSignOut = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await clearSession();
  };

  const getAuthProviderLabel = () => {
    switch (session.authProvider) {
      case "apple": return "Apple";
      case "google": return "Google";
      case "email": return "Email";
      default: return "Local";
    }
  };

  const openSwitchModal = useCallback(async () => {
    setActiveModal("switch");
    setLoadingHouseholds(true);
    setErrorMessage("");
    try {
      const res = await fetch(new URL(`/api/members/${session.memberId}/households`, getApiUrl()).href);
      if (res.ok) {
        const data = await res.json();
        setHouseholdList(data);
      }
    } catch (e) {
      console.error("Error loading households:", e);
    } finally {
      setLoadingHouseholds(false);
    }
  }, [session.memberId]);

  const switchToHousehold = async (entry: HouseholdEntry) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setSession({
      memberId: entry.memberId,
      memberName: entry.memberName,
      householdId: entry.householdId,
      householdName: entry.householdName,
      inviteCode: entry.inviteCode,
    });
    setActiveModal(null);
  };

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim()) {
      setErrorMessage("Please enter a household name");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const householdRes = await apiRequest("POST", "/api/households", { name: newHouseholdName.trim() });
      const household = await householdRes.json();

      const memberRes = await apiRequest("POST", `/api/households/${household.id}/members`, {
        name: session.memberName,
        existingMemberId: null,
      });
      const newMember = await memberRes.json();

      if (session.memberEmail || (session.authProvider && session.authProvider !== "local")) {
        const updateFields: any = {};
        if (session.memberEmail) updateFields.email = session.memberEmail;
        if (session.authProvider) updateFields.authProvider = session.authProvider;

        await apiRequest("PATCH", `/api/members/${newMember.id}`, updateFields);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession({
        memberId: newMember.id,
        memberName: newMember.name,
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.inviteCode,
      });
      setNewHouseholdName("");
      setActiveModal(null);
    } catch (e: any) {
      setErrorMessage(e.message || "Failed to create household");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinHousehold = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMessage("Enter a 6-character invite code");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const householdRes = await fetch(new URL(`/api/households/code/${code}`, getApiUrl()).href);
      if (!householdRes.ok) {
        setErrorMessage("Invalid invite code. Please check and try again.");
        setIsSubmitting(false);
        return;
      }
      const household = await householdRes.json();

      const memberRes = await apiRequest("POST", `/api/households/${household.id}/members`, {
        name: session.memberName,
      });
      const newMember = await memberRes.json();

      if (session.memberEmail || (session.authProvider && session.authProvider !== "local")) {
        const updateFields: any = {};
        if (session.memberEmail) updateFields.email = session.memberEmail;
        if (session.authProvider) updateFields.authProvider = session.authProvider;

        await apiRequest("PATCH", `/api/members/${newMember.id}`, updateFields);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession({
        memberId: newMember.id,
        memberName: newMember.name,
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.inviteCode,
      });
      setJoinCode("");
      setActiveModal(null);
    } catch (e: any) {
      setErrorMessage(e.message || "Failed to join household");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setErrorMessage("");
    setNewHouseholdName("");
    setJoinCode("");
  };

  const renderModalContent = () => {
    if (activeModal === "switch") {
      return (
        <View style={[styles.modalCard, { backgroundColor: theme.backgroundDefault }]}>  
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Switch Household</ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          {loadingHouseholds ? (
            <ActivityIndicator size="small" color={AppColors.primary} style={{ marginVertical: Spacing.xl }} />
          ) : householdList.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              You only belong to one household. Create or join another one first.
            </ThemedText>
          ) : (
            <FlatList
              data={householdList}
              keyExtractor={(item) => String(item.householdId)}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const isCurrent = item.householdId === session.householdId;
                return (
                  <Pressable
                    style={[
                      styles.householdItem,
                      { borderBottomColor: theme.border },
                      isCurrent ? { backgroundColor: AppColors.primary + "10" } : null,
                    ]}
                    onPress={() => {
                      if (!isCurrent) switchToHousehold(item);
                    }}
                    disabled={isCurrent}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.householdName}>{item.householdName}</ThemedText>
                      <ThemedText style={[styles.householdCode, { color: theme.textSecondary }]}>
                        Code: {item.inviteCode}
                      </ThemedText>
                    </View>
                    {isCurrent ? (
                      <Feather name="check-circle" size={20} color={AppColors.success} />
                    ) : (
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      );
    }

    if (activeModal === "create") {
      return (
        <View style={[styles.modalCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Create Household</ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.modalHint, { color: theme.textSecondary }]}>
            Give your new household a name. You can invite others with the code afterwards.
          </ThemedText>
          <TextInput
            testID="input-household-name"
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundSecondary }]}
            placeholder="e.g. The Smiths"
            placeholderTextColor={theme.textSecondary}
            value={newHouseholdName}
            onChangeText={setNewHouseholdName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateHousehold}
          />
          {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
          <Pressable
            testID="button-create-household"
            style={[styles.actionButton, { backgroundColor: AppColors.primary, opacity: isSubmitting ? 0.6 : 1 }]}
            onPress={handleCreateHousehold}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.actionButtonText}>Create</ThemedText>
            )}
          </Pressable>
        </View>
      );
    }

    if (activeModal === "join") {
      return (
        <View style={[styles.modalCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Join Household</ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <Feather name="x" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.modalHint, { color: theme.textSecondary }]}>
            Enter the 6-character invite code shared by a household member.
          </ThemedText>
          <TextInput
            testID="input-invite-code"
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundSecondary, textAlign: "center", fontSize: 20, letterSpacing: 4 }]}
            placeholder="ABC123"
            placeholderTextColor={theme.textSecondary}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase().slice(0, 6))}
            autoCapitalize="characters"
            autoFocus
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleJoinHousehold}
          />
          {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
          <Pressable
            testID="button-join-household"
            style={[styles.actionButton, { backgroundColor: AppColors.primary, opacity: isSubmitting ? 0.6 : 1 }]}
            onPress={handleJoinHousehold}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.actionButtonText}>Join</ThemedText>
            )}
          </Pressable>
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Account
          </ThemedText>
          <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <SettingsRow
              icon="user"
              title={session.memberName || "Guest"}
              subtitle={getAuthProviderLabel()}
              showChevron={false}
              rightElement={
                <Feather name="check-circle" size={18} color={AppColors.success} />
              }
            />
            {session.memberEmail ? (
              <SettingsRow
                icon="mail"
                title="Email"
                subtitle={session.memberEmail}
                showChevron={false}
              />
            ) : null}
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <Pressable
              testID="button-sign-out"
              style={[styles.signOutButton, { borderColor: theme.border }]}
              onPress={handleSignOut}
            >
              <Feather name="log-out" size={18} color={AppColors.error} />
              <ThemedText style={[styles.signOutText, { color: AppColors.error }]}>Sign Out</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Household
          </ThemedText>
          <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <SettingsRow
              icon="home"
              title={session.householdName || "No household"}
              subtitle={session.inviteCode ? `Invite code: ${session.inviteCode}` : undefined}
              showChevron={false}
            />
            <SettingsRow
              icon="repeat"
              title="Switch Household"
              subtitle="Change your active household"
              onPress={openSwitchModal}
            />
            <SettingsRow
              icon="plus-circle"
              title="Create New Household"
              subtitle="Start a new household group"
              onPress={() => { setErrorMessage(""); setActiveModal("create"); }}
            />
            <SettingsRow
              icon="user-plus"
              title="Join Household"
              subtitle="Enter an invite code"
              onPress={() => { setErrorMessage(""); setActiveModal("join"); }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            About
          </ThemedText>
          <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <SettingsRow
              icon="info"
              title="Version"
              subtitle="1.0.0"
              showChevron={false}
            />
            <SettingsRow
              icon="sun"
              title="Appearance"
              subtitle={isDark ? "Dark Mode" : "Light Mode"}
              showChevron={false}
              rightElement={
                <Feather
                  name={isDark ? "moon" : "sun"}
                  size={18}
                  color={theme.textSecondary}
                />
              }
            />
          </View>
        </View>

        <View style={styles.creditsContainer}>
          <ThemedText style={[styles.creditsText, { color: theme.textSecondary }]}>
            Made with Replit
          </ThemedText>
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal visible={activeModal !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            {renderModalContent()}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionContent: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: "500",
  },
  rowSubtitle: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.body.fontSize,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: AppColors.error,
    fontSize: Typography.small.fontSize,
    marginBottom: Spacing.sm,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  signOutText: {
    fontWeight: "600",
    fontSize: Typography.body.fontSize,
  },
  creditsContainer: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  creditsText: {
    fontSize: Typography.small.fontSize,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalHint: {
    fontSize: Typography.small.fontSize,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: Typography.body.fontSize,
    textAlign: "center",
    paddingVertical: Spacing.xl,
    lineHeight: 22,
  },
  householdItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  householdName: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  householdCode: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  actionButton: {
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: Typography.body.fontSize,
  },
});
