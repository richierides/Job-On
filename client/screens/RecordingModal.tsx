import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Audio } from "expo-av";
import { File } from "expo-file-system/next";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Recording">;

export default function RecordingModal() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { session } = useUserSession();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);
  const hintsOpacity = useSharedValue(1);

  const hintsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: hintsOpacity.value,
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const startPulse = useCallback(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
  }, []);

  const stopPulse = useCallback(() => {
    cancelAnimation(pulseScale);
    cancelAnimation(pulseOpacity);
    pulseScale.value = withTiming(1);
    pulseOpacity.value = withTiming(1);
  }, []);

  const handleClose = useCallback(() => {
    if (isRecording) return;
    navigation.goBack();
  }, [isRecording, navigation]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      startPulse();
      hintsOpacity.value = withTiming(0.6, { duration: 300 });

      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      if (video?.uri) {
        await processVideo(video.uri);
      }
    } catch (error) {
      console.error("Recording error:", error);
      setIsRecording(false);
      stopPulse();
    }
  }, [isRecording, startPulse]);

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      cameraRef.current.stopRecording();
      setIsRecording(false);
      stopPulse();
      hintsOpacity.value = withTiming(1, { duration: 400 });

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (error) {
      console.error("Stop recording error:", error);
    }
  }, [isRecording, stopPulse]);

  const processVideo = useCallback(
    async (videoUri: string) => {
      setIsProcessing(true);

      try {
        // Generate thumbnail from first frame
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          { time: 0 }
        );

        // Read video file as base64
        const videoFile = new File(videoUri);
        const videoBase64 = await videoFile.base64();

        // Read thumbnail as base64
        const thumbnailFile = new File(thumbnailUri);
        const thumbnailBase64 = await thumbnailFile.base64();

        // Send to backend for AI processing
        const response = await fetch(new URL("/api/tasks/process-video", getApiUrl()).href, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video: videoBase64,
            thumbnail: thumbnailBase64,
            householdId: session.householdId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to process video");
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        navigation.goBack();
      } catch (error) {
        console.error("Video processing error:", error);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsProcessing(false);
      }
    },
    [navigation, queryClient, session.householdId]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Permission handling
  if (!cameraPermission || !micPermission) {
    return <View style={[styles.container, { backgroundColor: "#000" }]} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    const canAskCameraAgain = cameraPermission.canAskAgain;
    const canAskMicAgain = micPermission.canAskAgain;
    const needsSettings = !canAskCameraAgain || !canAskMicAgain;

    return (
      <View style={[styles.permissionContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + Spacing.md }]}
          onPress={handleClose}
          hitSlop={12}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>

        <Feather name="camera-off" size={64} color={theme.textSecondary} />
        <ThemedText style={styles.permissionTitle}>
          Camera & Microphone Access
        </ThemedText>
        <ThemedText style={[styles.permissionMessage, { color: theme.textSecondary }]}>
          Home DIY Tracker needs camera and microphone access to record your home maintenance tasks.
        </ThemedText>

        {needsSettings && Platform.OS !== "web" ? (
          <Button
            onPress={async () => {
              try {
                await Linking.openSettings();
              } catch (error) {
                // openSettings not supported
              }
            }}
            style={styles.permissionButton}
          >
            Open Settings
          </Button>
        ) : (
          <Button
            onPress={async () => {
              if (!cameraPermission.granted) {
                await requestCameraPermission();
              }
              if (!micPermission.granted) {
                await requestMicPermission();
              }
            }}
            style={styles.permissionButton}
          >
            Enable Permissions
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="video"
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Close button */}
        <Pressable
          style={[styles.closeButton, { top: insets.top + Spacing.md }]}
          onPress={handleClose}
          hitSlop={12}
        >
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>

        <Animated.View
          style={[styles.hintsContainer, { top: insets.top + 60 }, hintsAnimatedStyle]}
          pointerEvents="none"
        >
          <ThemedText style={styles.hintsTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">
            What to mention:
          </ThemedText>
          <ThemedText style={styles.hintsBullet} lightColor="rgba(255,255,255,0.85)" darkColor="rgba(255,255,255,0.85)">
            {"\u2022"}  Describe the problem
          </ThemedText>
          <ThemedText style={styles.hintsBullet} lightColor="rgba(255,255,255,0.85)" darkColor="rgba(255,255,255,0.85)">
            {"\u2022"}  Where it is
          </ThemedText>
          <ThemedText style={styles.hintsBullet} lightColor="rgba(255,255,255,0.85)" darkColor="rgba(255,255,255,0.85)">
            {"\u2022"}  How urgent it is
          </ThemedText>
          <ThemedText style={styles.hintsBullet} lightColor="rgba(255,255,255,0.85)" darkColor="rgba(255,255,255,0.85)">
            {"\u2022"}  How big a job you think it is
          </ThemedText>
          <ThemedText style={styles.hintsBullet} lightColor="rgba(255,255,255,0.85)" darkColor="rgba(255,255,255,0.85)">
            {"\u2022"}  The steps needed to complete it (if you know!)
          </ThemedText>
          <ThemedText style={styles.hintsBullet} lightColor="rgba(255,255,255,0.85)" darkColor="rgba(255,255,255,0.85)">
            {"\u2022"}  Materials needed to do it (screws, glues etc!)
          </ThemedText>
        </Animated.View>

        {/* Recording indicator */}
        {isRecording ? (
          <View style={[styles.recordingIndicator, { top: insets.top + Spacing.md }]}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.recordingTime} lightColor="#FFFFFF" darkColor="#FFFFFF">
              {formatDuration(recordingDuration)}
            </ThemedText>
          </View>
        ) : null}

        {/* Bottom controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <ThemedText style={styles.instructionText} lightColor="#FFFFFF" darkColor="#FFFFFF">
            {isRecording ? "Release to stop recording" : "Hold to record your task"}
          </ThemedText>

          <View style={styles.recordButtonWrapper}>
            <Animated.View
              style={[
                styles.recordButtonPulse,
                isRecording && styles.recordButtonPulseActive,
                pulseAnimatedStyle,
              ]}
            />
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              testID="hold-record-button"
            >
              <Feather
                name="video"
                size={32}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ProcessingOverlay visible={isProcessing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: "absolute",
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingIndicator: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.error,
    marginRight: Spacing.sm,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: "600",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.xl,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recordButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonPulse: {
    position: "absolute",
    width: Spacing.recordButtonSizeLarge,
    height: Spacing.recordButtonSizeLarge,
    borderRadius: Spacing.recordButtonSizeLarge / 2,
    backgroundColor: "transparent",
    borderWidth: 3,
    borderColor: AppColors.primary,
  },
  recordButtonPulseActive: {
    borderColor: AppColors.error,
  },
  recordButton: {
    width: Spacing.recordButtonSizeLarge,
    height: Spacing.recordButtonSizeLarge,
    borderRadius: Spacing.recordButtonSizeLarge / 2,
    backgroundColor: AppColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: {
    backgroundColor: AppColors.error,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  permissionMessage: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    minWidth: 200,
  },
  hintsContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  hintsTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  hintsBullet: {
    fontSize: 13,
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
