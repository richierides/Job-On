import React from "react";
import { View, StyleSheet, Modal, Image, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";

interface ProcessingOverlayProps {
  visible: boolean;
  message?: string;
}

export function ProcessingOverlay({
  visible,
  message = "Generating Task...",
}: ProcessingOverlayProps) {
  const { theme, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView
        intensity={50}
        tint={isDark ? "dark" : "light"}
        style={styles.container}
      >
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <Image
            source={require("../../assets/images/ai-processing.png")}
            style={styles.image}
            resizeMode="contain"
          />
          <ActivityIndicator
            size="large"
            color={AppColors.primary}
            style={styles.spinner}
          />
          <ThemedText style={styles.message}>{message}</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
            Our AI is analyzing your video...
          </ThemedText>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 300,
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  image: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  spinner: {
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: 14,
    textAlign: "center",
  },
});
