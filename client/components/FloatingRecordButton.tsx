import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { Spacing, Shadows, AppColors } from "@/constants/theme";

interface FloatingRecordButtonProps {
  onPress: () => void;
  isProcessing?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FloatingRecordButton({
  onPress,
  isProcessing = false,
}: FloatingRecordButtonProps) {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (isProcessing) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(0);
    }
  }, [isProcessing]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePressIn = () => {
    if (!isProcessing) {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
    }
  };

  const handlePressOut = () => {
    if (!isProcessing) {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    }
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.pulse, pulseAnimatedStyle]} />
      <AnimatedPressable
        onPress={isProcessing ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, buttonAnimatedStyle]}
        testID="record-button"
      >
        <Feather
          name={isProcessing ? "loader" : "video"}
          size={28}
          color="#FFFFFF"
        />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: Spacing["3xl"],
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: Spacing.recordButtonSize,
    height: Spacing.recordButtonSize,
    borderRadius: Spacing.recordButtonSize / 2,
    backgroundColor: AppColors.primary,
  },
  button: {
    width: Spacing.recordButtonSize,
    height: Spacing.recordButtonSize,
    borderRadius: Spacing.recordButtonSize / 2,
    backgroundColor: AppColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.floatingButton,
  },
});
