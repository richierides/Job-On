import React from "react";
import { View, StyleSheet, Pressable, Linking, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
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

  const handleOpenWebsite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL("https://replit.com");
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
      {/* App Info Section */}
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

      {/* Features Section */}
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

      {/* Links Section */}
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

      {/* Credits */}
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
  creditsContainer: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  creditsText: {
    fontSize: Typography.small.fontSize,
  },
});
