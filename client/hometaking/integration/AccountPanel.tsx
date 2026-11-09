import React, { useEffect, useState } from "react";
import { Text, View, Linking, Platform } from "react-native";
import { Action, Field, s } from "../ui";
import { useProject } from "../store";
import { cloud, households, Household, readDocuments } from "./cloud";
export function AccountPanel() {
  const store = useProject();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [user, setUser] = useState(""),
    [homes, setHomes] = useState<Household[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [invite, setInvite] = useState(""),
    [recovery, setRecovery] = useState(false),
    [destination, setDestination] = useState<{
      home: Household;
      count: number;
    } | null>(null);
  const redirect =
    Platform.OS === "web"
      ? window.location.origin + "/"
      : "homediytracker://auth";
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function refresh() {
    const { data } = await cloud.auth.getSession();
    setUser(data.session?.user.email ?? "");
    if (data.session) {
      const hs = await households();
      setHomes(hs);
    } else setHomes([]);
  }
  useEffect(() => {
    void refresh().catch((e) => setMessage(e.message));
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      setUser(session?.user.email ?? "");
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setTimeout(() => void refresh().catch((e) => setMessage(e.message)), 0);
    });
    const receive = async (url: string | null) => {
      if (!url) return;
      const u = new URL(url);
      if (
        u.protocol !== "homediytracker:" &&
        (Platform.OS !== "web" || u.origin !== window.location.origin)
      )
        return;
      const q = new URLSearchParams(u.hash.slice(1) || u.search.slice(1));
      if (q.get("code")) {
        const { error } = await cloud.auth.exchangeCodeForSession(
          q.get("code")!,
        );
        if (error) throw error;
      } else if (q.get("access_token") && q.get("refresh_token")) {
        const { error } = await cloud.auth.setSession({
          access_token: q.get("access_token")!,
          refresh_token: q.get("refresh_token")!,
        });
        if (error) throw error;
      }
      if (q.get("type") === "recovery") setRecovery(true);
    };
    void Linking.getInitialURL()
      .then(receive)
      .catch((e) => setMessage(e.message));
    const link = Linking.addEventListener(
      "url",
      (e) => void receive(e.url).catch((e) => setMessage(e.message)),
    );
    return () => {
      data.subscription.unsubscribe();
      link.remove();
    };
  }, []);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.section}>Household account</Text>
      {!user ? (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Action
            label="Sign in"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const { error } = await cloud.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
                if (error) throw error;
                setPassword("");
                await refresh();
              })
            }
          />
          <Action
            secondary
            label="Create account"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const { error } = await cloud.auth.signUp({
                  email: email.trim(),
                  password,
                  options: { emailRedirectTo: redirect },
                });
                if (error) throw error;
                setPassword("");
                setMessage("Check your email to confirm your account.");
              })
            }
          />
          <Action
            secondary
            label="Reset password"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const { error } = await cloud.auth.resetPasswordForEmail(
                  email.trim(),
                  { redirectTo: redirect },
                );
                if (error) throw error;
                setMessage("Check your email for the recovery link.");
              })
            }
          />
        </>
      ) : (
        <>
          <Text style={s.body}>{user}</Text>
          {recovery && (
            <>
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Action
                label="Save new password"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const { error } = await cloud.auth.updateUser({ password });
                    if (error) throw error;
                    setPassword("");
                    setRecovery(false);
                  })
                }
              />
            </>
          )}
          {homes.map((h) => (
            <Action
              key={h.id}
              secondary
              label={`Open ${h.name}`}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const docs = await readDocuments(h.id);
                  setDestination({
                    home: h,
                    count: docs.filter((d) => d.kind === "room" && !d.deleted)
                      .length,
                  });
                })
              }
            />
          ))}
          {destination && (
            <>
              <Text style={s.body}>
                {destination.home.name} has {destination.count} Hometaking
                rooms. Your current {store.project.rooms.length} rooms can be
                added as separate records. Original Room Planner rooms can be
                imported after opening the household.
              </Text>
              <Action
                label={`Open ${destination.home.name} rooms`}
                onPress={() =>
                  void run(async () => {
                    await store.connect(destination.home, false);
                    setDestination(null);
                  })
                }
              />
              <Action
                secondary
                label={`Add current rooms to ${destination.home.name}`}
                onPress={() =>
                  void run(async () => {
                    await store.connect(destination.home, true);
                    setDestination(null);
                  })
                }
              />
              <Action
                secondary
                label="Cancel household selection"
                onPress={() => setDestination(null)}
              />
            </>
          )}
          <Field
            label="New household name"
            value={name}
            onChangeText={setName}
          />
          <Action
            secondary
            label="Create household"
            disabled={busy || !name.trim()}
            onPress={() =>
              void run(async () => {
                const { error } = await cloud.rpc("create_household", {
                  p_name: name.trim(),
                });
                if (error) throw error;
                setName("");
                await refresh();
              })
            }
          />
          <Action
            secondary
            label="Accept household invitations"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const { error } = await cloud.rpc("accept_invites");
                if (error) throw error;
                await refresh();
              })
            }
          />
          {store.household && (
            <>
              <Text style={s.body}>Working in {store.household.name}</Text>
              <Field
                label="Invite email"
                value={invite}
                onChangeText={setInvite}
                autoCapitalize="none"
              />
              <Action
                secondary
                label="Allow this email to join household"
                disabled={busy || !invite.includes("@")}
                onPress={() =>
                  void run(async () => {
                    const { data } = await cloud.auth.getUser();
                    const { error } = await cloud
                      .from("household_invites")
                      .insert({
                        household_id: store.household!.id,
                        email: invite.trim().toLowerCase(),
                        invited_by: data.user!.id,
                      });
                    if (error) throw error;
                    setInvite("");
                    setMessage(
                      "Invitation saved. Ask them to sign in and accept household invitations. No email was sent.",
                    );
                  })
                }
              />
              <Action
                secondary
                label="Sync household now"
                disabled={store.syncing}
                onPress={() => void store.sync()}
              />
              <Action
                secondary
                label="Return to local project"
                onPress={() => void run(store.disconnect)}
              />
            </>
          )}
          <Action
            secondary
            label="Sign out"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await store.disconnect();
                const { error } = await cloud.auth.signOut();
                if (error) throw error;
                await refresh();
              })
            }
          />
        </>
      )}
      {store.conflicts.map((c) => (
        <View key={c.id} style={{ gap: 8 }}>
          <Text style={s.body}>
            Conflicting changes:{" "}
            {c.id === "__tasks__"
              ? "household tasks"
              : (store.project.rooms.find((r) => r.id === c.id)?.name ?? c.id)}
          </Text>
          <Action
            label="Keep both versions"
            onPress={() => store.resolveConflict(c.id, "both")}
          />
          <Action
            secondary
            label="Use household version"
            onPress={() => store.resolveConflict(c.id, "remote")}
          />
        </View>
      ))}
      {!!message && (
        <Text accessibilityRole="alert" style={s.muted}>
          {message}
        </Text>
      )}
    </View>
  );
}
