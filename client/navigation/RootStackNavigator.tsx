import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Pressable, ActivityIndicator, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import TaskDashboardScreen from "@/screens/TaskDashboardScreen";
import TaskDetailScreen from "@/screens/TaskDetailScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import RecordingModal from "@/screens/RecordingModal";
import OnboardingScreen from "@/screens/OnboardingScreen";
import PlanScreen from "@/screens/PlanScreen";
import SavedPlansScreen from "@/screens/SavedPlansScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useUserSession } from "@/contexts/UserSessionContext";
import { Task } from "@shared/schema";

export type RootStackParamList = {
  Onboarding: undefined;
  TaskDashboard: undefined;
  TaskDetail: { task: Task };
  Settings: undefined;
  Recording: undefined;
  Plan: undefined;
  SavedPlans: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const { isOnboarded, isLoading } = useUserSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isOnboarded ? (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="TaskDashboard"
            component={TaskDashboardScreen}
            options={({ navigation }) => ({
              headerTitle: () => <HeaderTitle title="Home DIY Tracker" />,
              headerRight: () => (
                <HeaderButton
                  onPress={() => navigation.navigate("Settings")}
                >
                  <Feather name="settings" size={22} color={theme.text} />
                </HeaderButton>
              ),
            })}
          />
          <Stack.Screen
            name="TaskDetail"
            component={TaskDetailScreen}
            options={{
              headerTitle: "Task Details",
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerTitle: "Settings",
            }}
          />
          <Stack.Screen
            name="Plan"
            component={PlanScreen}
            options={{
              headerTitle: "Plan My Work",
            }}
          />
          <Stack.Screen
            name="SavedPlans"
            component={SavedPlansScreen}
            options={{
              headerTitle: "Saved Plans",
            }}
          />
          <Stack.Screen
            name="Recording"
            component={RecordingModal}
            options={{
              presentation: "fullScreenModal",
              headerShown: false,
              animation: "fade",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
