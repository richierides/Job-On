import React from "react";
import { View, StyleSheet, Pressable, Linking, useColorScheme, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { apiRequest } from "@/lib/query-client";
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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const systemColorScheme = useColorScheme();
  const { session, clearSession } = useUserSession();

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

  return (
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
            subtitle={session.householdName || "No household"}
            showChevron={false}
          />
          <SettingsRow
            icon="copy"
            title="Invite Code"
            subtitle={session.inviteCode || "---"}
            showChevron={false}
          />
          {session.memberEmail ? (
            <SettingsRow
              icon="mail"
              title="Email"
              subtitle={session.memberEmail}
              showChevron={false}
            />
          ) : null}
          <SettingsRow
            icon="shield"
            title="Signed In Via"
            subtitle={getAuthProviderLabel()}
            showChevron={false}
            rightElement={
              <Feather name="check-circle" size={18} color={AppColors.success} />
            }
          />
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

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Features
        </ThemedText>
        <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <SettingsRow
            icon="video"
            title="Video Recording"
            subtitle="Capture home maintenance issues"
            showChevron={false}
          />
          <SettingsRow
            icon="cpu"
            title="AI Analysis"
            subtitle="Powered by OpenAI GPT-4o"
            showChevron={false}
          />
          <SettingsRow
            icon="list"
            title="Task Management"
            subtitle="Organize and track repairs"
            showChevron={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Links
        </ThemedText>
        <View style={[styles.sectionContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <SettingsRow
            icon="globe"
            title="Visit Website"
            onPress={handleOpenWebsite}
          />
        </View>
      </View>

      <View style={styles.creditsContainer}>
        <ThemedText style={[styles.creditsText, { color: theme.textSecondary }]}>
          Made with Replit
        </ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
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
  registerForm: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
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
  saveButton: {
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: Typography.body.fontSize,
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
});
