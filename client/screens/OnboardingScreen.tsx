import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";

import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useUserSession } from "@/contexts/UserSessionContext";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, AppColors } from "@/constants/theme";
import { Household, HouseholdMember } from "@shared/schema";
const appIcon = require("../../assets/images/icon.png");

const FontSizes = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 28,
};

type OnboardingStep =
  | "welcome"
  | "signup-email"
  | "login-email"
  | "household-choice"
  | "create"
  | "join";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, setSession, isAuthenticated } = useUserSession();

  const initialStep = isAuthenticated && !session.householdId ? "household-choice" : "welcome";
  const [step, setStep] = useState<OnboardingStep>(initialStep);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ preferLocalhost: true });

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID || "",
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
    },
    googleDiscovery
  );

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !session.householdId && step === "welcome") {
      setStep("household-choice");
    }
  }, [isAuthenticated, session.householdId]);

  useEffect(() => {
    if (googleResponse?.type === "success" && googleResponse.params?.id_token) {
      handleGoogleToken(googleResponse.params.id_token);
    }
  }, [googleResponse]);

  const handleAuthResponse = async (data: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setSession({
      memberId: data.member.id,
      memberName: data.member.name,
      memberEmail: data.member.email || null,
      authProvider: data.member.authProvider || null,
      householdId: data.member.householdId || null,
      householdName: data.household?.name || null,
      inviteCode: data.household?.inviteCode || null,
    });
    if (!data.member.householdId) {
      setStep("household-choice");
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const response = await apiRequest("POST", "/api/auth/apple", {
        identityToken: credential.identityToken,
        user: credential.user,
        fullName: credential.fullName,
        email: credential.email,
      });
      const data = await response.json();
      await handleAuthResponse(data);
    } catch (err: any) {
      if (err.code !== "ERR_REQUEST_CANCELED") {
        setError("Apple Sign In failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google Sign In is not configured yet.");
      return;
    }
    setError(null);
    try {
      await googlePromptAsync();
    } catch (err) {
      setError("Google Sign In failed. Please try again.");
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/auth/google", { idToken });
      const data = await response.json();
      await handleAuthResponse(data);
    } catch (err) {
      setError("Google Sign In failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    if (!signupName.trim()) { setError("Please enter your name"); return; }
    if (!signupEmail.trim()) { setError("Please enter your email"); return; }
    if (!signupPassword || signupPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/auth/signup", {
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
      });
      const data = await response.json();
      await handleAuthResponse(data);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("409") || msg.includes("already exists")) {
        setError("An account with this email already exists. Try signing in.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!loginEmail.trim()) { setError("Please enter your email"); return; }
    if (!loginPassword) { setError("Please enter your password"); return; }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email: loginEmail.trim(),
        password: loginPassword,
      });
      const data = await response.json();
      await handleAuthResponse(data);
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) { setError("Please enter a household name"); return; }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("POST", "/api/households", { name: householdName.trim() });
      const household = await response.json() as Household;

      const memberResponse = await apiRequest(
        "POST",
        `/api/households/${household.id}/members`,
        { name: session.memberName || "User", existingMemberId: session.memberId }
      );
      const member = await memberResponse.json() as HouseholdMember;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession({
        memberId: member.id,
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.inviteCode,
      });
    } catch (err) {
      setError("Failed to create household. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) { setError("Please enter an invite code"); return; }
    setIsLoading(true);
    setError(null);
    try {
      const lookupResponse = await fetch(`${getApiUrl()}/api/households/code/${inviteCode.trim().toUpperCase()}`);
      if (!lookupResponse.ok) throw new Error("Invalid invite code");
      const household = await lookupResponse.json() as Household;

      const memberResponse = await apiRequest(
        "POST",
        `/api/households/${household.id}/members`,
        { name: session.memberName || "User", existingMemberId: session.memberId }
      );
      const member = await memberResponse.json() as HouseholdMember;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession({
        memberId: member.id,
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.inviteCode,
      });
    } catch (err) {
      setError("Invalid invite code. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === "signup-email" || step === "login-email") {
      setStep("welcome");
    } else if (step === "create" || step === "join") {
      setStep("household-choice");
    }
  };

  const renderWelcome = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Image source={appIcon} style={styles.appIcon} />
        <ThemedText style={[styles.title, { color: theme.text }]}>Home DIY Tracker</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Capture repairs with video, let AI organize everything
        </ThemedText>
      </View>

      <View style={styles.buttonGroup}>
        {isAppleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={BorderRadius.md}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        ) : null}

        {GOOGLE_CLIENT_ID ? (
          <Pressable
            style={[styles.ssoButton, { backgroundColor: "#FFFFFF", borderColor: theme.border }]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            testID="button-google-signin"
          >
            <ThemedText style={[styles.ssoButtonText, { color: "#1F1F1F" }]}>
              Continue with Google
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("signup-email"); }}
          testID="button-signup-email"
        >
          <Feather name="mail" size={20} color="#FFFFFF" />
          <ThemedText style={styles.primaryButtonText}>Sign Up with Email</ThemedText>
        </Pressable>
      </View>

      {error ? <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText> : null}

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>or</ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <Pressable
        style={styles.signInLink}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("login-email"); }}
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

  const renderSignupEmail = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack} testID="button-back">
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        <Feather name="user-plus" size={40} color={theme.primary} />
        <ThemedText style={[styles.title, { color: theme.text }]}>Create Account</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Sign up with your email to get started
        </ThemedText>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          testID="input-signup-name"
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border, marginBottom: Spacing.sm }]}
          placeholder="Your name"
          placeholderTextColor={theme.textSecondary}
          value={signupName}
          onChangeText={setSignupName}
          autoCapitalize="words"
          autoFocus
        />
        <TextInput
          testID="input-signup-email"
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border, marginBottom: Spacing.sm }]}
          placeholder="Email address"
          placeholderTextColor={theme.textSecondary}
          value={signupEmail}
          onChangeText={setSignupEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextInput
          testID="input-signup-password"
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          placeholder="Password (6+ characters)"
          placeholderTextColor={theme.textSecondary}
          value={signupPassword}
          onChangeText={setSignupPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        {error ? <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText> : null}
      </View>

      <Pressable
        testID="button-signup-submit"
        style={[styles.primaryButton, { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 }]}
        onPress={handleEmailSignup}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Create Account</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderLoginEmail = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack} testID="button-back">
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
        {isAppleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={BorderRadius.md}
            style={[styles.appleButton, { marginBottom: Spacing.sm }]}
            onPress={handleAppleSignIn}
          />
        ) : null}

        {GOOGLE_CLIENT_ID ? (
          <Pressable
            style={[styles.ssoButton, { backgroundColor: "#FFFFFF", borderColor: theme.border, marginBottom: Spacing.md }]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <ThemedText style={[styles.ssoButtonText, { color: "#1F1F1F" }]}>
              Sign in with Google
            </ThemedText>
          </Pressable>
        ) : null}

        {isAppleAvailable || GOOGLE_CLIENT_ID ? (
          <View style={[styles.dividerRow, { marginBottom: Spacing.md }]}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>or use email</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>
        ) : null}

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
          autoFocus={!isAppleAvailable && !GOOGLE_CLIENT_ID}
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
        onPress={handleEmailLogin}
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

  const renderHouseholdChoice = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Feather name="home" size={48} color={theme.primary} />
        <ThemedText style={[styles.title, { color: theme.text }]}>Set Up Your Household</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Create a household to start tracking repairs, or join an existing one
        </ThemedText>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("create"); }}
          testID="button-create-household"
        >
          <Feather name="plus-circle" size={20} color="#FFFFFF" />
          <ThemedText style={styles.primaryButtonText}>Create Household</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep("join"); }}
          testID="button-join-household"
        >
          <Feather name="users" size={20} color={theme.text} />
          <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>Join with Invite Code</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderCreate = () => (
    <View style={styles.content}>
      <Pressable style={styles.backButton} onPress={goBack} testID="button-back">
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
          testID="input-household-name"
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
        testID="button-create-submit"
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
      <Pressable style={styles.backButton} onPress={goBack} testID="button-back">
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
          testID="input-invite-code"
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
        testID="button-join-submit"
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

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {step === "welcome" ? renderWelcome() : null}
          {step === "signup-email" ? renderSignupEmail() : null}
          {step === "login-email" ? renderLoginEmail() : null}
          {step === "household-choice" ? renderHouseholdChoice() : null}
          {step === "create" ? renderCreate() : null}
          {step === "join" ? renderJoin() : null}
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
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    marginTop: Spacing.sm,
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
  appleButton: {
    height: 52,
    width: "100%",
  },
  ssoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 52,
  },
  ssoButtonText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: FontSizes.sm,
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
  },
  signInText: {
    fontSize: FontSizes.sm,
  },
  signInTextBold: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
});
