import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HouseholdMember, Household } from "@shared/schema";

interface UserSession {
  memberId: number | null;
  memberName: string | null;
  householdId: number | null;
  householdName: string | null;
  inviteCode: string | null;
}

interface UserSessionContextType {
  session: UserSession;
  isLoading: boolean;
  setSession: (session: Partial<UserSession>) => Promise<void>;
  clearSession: () => Promise<void>;
  isOnboarded: boolean;
}

const STORAGE_KEY = "@homefix_session";

const defaultSession: UserSession = {
  memberId: null,
  memberName: null,
  householdId: null,
  householdName: null,
  inviteCode: null,
};

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export function UserSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<UserSession>(defaultSession);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSessionState(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setSession = useCallback(async (updates: Partial<UserSession>) => {
    const newSession = { ...session, ...updates };
    setSessionState(newSession);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  }, [session]);

  const clearSession = useCallback(async () => {
    setSessionState(defaultSession);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  }, []);

  const isOnboarded = session.memberId !== null && session.householdId !== null;

  return (
    <UserSessionContext.Provider value={{ session, isLoading, setSession, clearSession, isOnboarded }}>
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSession() {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return context;
}
