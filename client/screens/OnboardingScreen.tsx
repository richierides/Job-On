import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useUserSession } from "@/contexts/UserSessionContext";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Household, HouseholdMember } from "@shared/schema";

const FontSizes = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
};

type OnboardingStep = "choice" | "create" | "join" | "name" | "login";

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setSession } = useUserSession();

  const [step, setStep] = useState<OnboardingStep>("choice");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingHousehold, setPendingHousehold] = useState<Household | null>(null);

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      setError("Please enter a household name");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/households", { name: householdName.trim() });
      const household = await response.json() as Household;
      setPendingHousehold(household);
      setStep("name");
    } catch (err) {
      setError("Failed to create household. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) {
      setError("Please enter an invite code");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${getApiUrl()}/api/households/code/${inviteCode.trim().toUpperCase()}`);
      if (!response.ok) {
        throw new Error("Invalid invite code");
      }
      const household = await response.json();
      setPendingHousehold(household);
      setStep("name");
    } catch (err) {
      setError("Invalid invite code. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!pendingHousehold) {
      setError("Something went wrong. Please start over.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest(
        "POST",
        `/api/households/${pendingHousehold.id}/members`,
        { name: memberName.trim() }
      );
      const member = await response.json() as HouseholdMember;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession({
        memberId: member.id,
        memberName: member.name,
        householdId: pendingHousehold.id,
        householdName: pendingHousehold.name,
        inviteCode: pendingHousehold.inviteCode,
      });
    } catch (err) {
      setError("Failed to add you to the household. Please try again.");
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!loginPassword) {
      setError("Please enter your password");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email: loginEmail.trim(),
        password: loginPassword,
      });
      const data = await response.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession({
        memberId: data.member.id,
        memberName: data.member.name,
        householdId: data.member.householdId,
        householdName: data.household?.name || "My Household",
        inviteCode: data.household?.inviteCode || null,
      });
    } catch (err: any) {
      setError("Invalid email or password. Please try again.");
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === "name") {
      setPendingHousehold(null);
      setStep("choice");
    } else if (step === "create" || step === "join" || step === "login") {
      setStep("choice");
    }
  };

  const renderChoice = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Feather name="home" size={48} color={theme.primary} />
        <ThemedText style={[styles.title, { color: theme.text }]}>Welcome to HomeFix</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Create a household to start tracking repairs, or join an existing one
        </ThemedText>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("create"); }}
        >
          <Feather name="plus-circle" size={20} color="#FFFFFF" />
          <ThemedText style={styles.primaryButtonText}>Create Household</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("join"); }}
        >
          <Feather name="users" size={20} color={theme.text} />
          <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>Join with Invite Code</ThemedText>
        </Pressable>
      </View>

      <Pressable
        style={styles.signInLink}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("login"); }}
        testID="button-sign-in"
      >
        <ThemedText style={[styles.signInText, { color: theme.textSecondary }]}>
          Already have an account?{" "}
        </ThemedText>
        <ThemedText style={[styles.signInTextBold, { color: theme.primary }]}>
          Sign In
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderCreate = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack}>
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>Create Household</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Give your household a name
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          placeholder="e.g., The Smith Family"
          placeholderTextColor={theme.textSecondary}
          value={householdName}
          onChangeText={setHouseholdName}
          autoFocus
        />
        {error ? <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText> : null}
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 }]}
        onPress={handleCreateHousehold}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Create</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderJoin = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack}>
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>Join Household</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter the 6-character invite code
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={[styles.input, styles.codeInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          placeholder="ABC123"
          placeholderTextColor={theme.textSecondary}
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
        />
        {error ? <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText> : null}
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 }]}
        onPress={handleJoinHousehold}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Join</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderName = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack}>
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: theme.text }]}>What's your name?</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          This is how you'll appear in {pendingHousehold?.name}
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          placeholder="Your name"
          placeholderTextColor={theme.textSecondary}
          value={memberName}
          onChangeText={setMemberName}
          autoFocus
        />
        {error ? <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText> : null}
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 }]}
        onPress={handleAddMember}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Get Started</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderLogin = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack}>
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        <Feather name="log-in" size={40} color={theme.primary} />
        <ThemedText style={[styles.title, { color: theme.text }]}>Welcome Back</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Sign in to access your household and tasks
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          testID="input-login-email"
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border, marginBottom: Spacing.sm }]}
          placeholder="Email address"
          placeholderTextColor={theme.textSecondary}
          value={loginEmail}
          onChangeText={setLoginEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
        />
        <TextInput
          testID="input-login-password"
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={loginPassword}
          onChangeText={setLoginPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        {error ? <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText> : null}
      </View>

      <Pressable
        testID="button-login-submit"
        style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 }]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="log-in" size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Sign In</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {step === "choice" && renderChoice()}
          {step === "create" && renderCreate()}
          {step === "join" && renderJoin()}
          {step === "name" && renderName()}
          {step === "login" && renderLogin()}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 0,
    padding: Spacing.sm,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FontSizes.md,
    textAlign: "center",
    lineHeight: 22,
  },
  buttonGroup: {
    gap: Spacing.md,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  input: {
    fontSize: FontSizes.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  codeInput: {
    textAlign: "center",
    fontSize: FontSizes.xl,
    letterSpacing: 8,
    fontWeight: "600",
  },
  errorText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  signInLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing["2xl"],
  },
  signInText: {
    fontSize: FontSizes.sm,
  },
  signInTextBold: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
});
