import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import TaskDashboardScreen from "@/screens/TaskDashboardScreen";
import TaskDetailScreen from "@/screens/TaskDetailScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import RecordingModal from "@/screens/RecordingModal";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { Task } from "@shared/schema";

export type RootStackParamList = {
  TaskDashboard: undefined;
  TaskDetail: { task: Task };
  Settings: undefined;
  Recording: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="TaskDashboard"
        component={TaskDashboardScreen}
        options={({ navigation }) => ({
          headerTitle: () => <HeaderTitle title="HomeFix" />,
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate("Settings")}
              hitSlop={8}
            >
              <Feather name="settings" size={22} color={theme.text} />
            </Pressable>
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
        name="Recording"
        component={RecordingModal}
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
          animation: "fade",
        }}
      />
    </Stack.Navigator>
  );
}
