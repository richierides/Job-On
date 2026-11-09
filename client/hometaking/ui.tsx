import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { palette as c, displayFont } from "./tokens";

export function Icon({
  name,
  size = 22,
  colour = c.ink,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  colour?: string;
}) {
  return <Feather name={name} size={size} color={colour} />;
}
export function Action({
  label,
  onPress,
  secondary = false,
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        secondary && s.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Icon name={icon} colour={secondary ? c.ink : c.white} />}
      <Text style={[s.actionText, secondary && { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 44,
        minWidth: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6, flexGrow: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#85857D"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.backdrop}
      >
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.section}>{title}</Text>
            <IconButton name="x" label="Close dialog" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 18, paddingBottom: 40 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export const s = StyleSheet.create({
  heading: {
    fontFamily: displayFont,
    fontSize: 44,
    lineHeight: 46,
    fontWeight: "800",
    letterSpacing: -2,
    color: c.ink,
    marginBottom: 20,
  },
  section: {
    fontFamily: displayFont,
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: c.ink,
  },
  body: { fontSize: 16, lineHeight: 23, color: c.ink },
  muted: { fontSize: 14, lineHeight: 21, color: c.muted },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "600",
    color: c.muted,
    marginBottom: 12,
  },
  action: {
    minHeight: 52,
    backgroundColor: c.accent,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.accent,
  },
  secondary: { backgroundColor: "transparent", borderColor: c.line },
  actionText: { fontSize: 16, fontWeight: "600", color: c.white },
  label: { fontSize: 13, color: c.muted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    padding: 12,
    fontSize: 16,
    color: c.ink,
    backgroundColor: "#FFFFFF50",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rule: { height: 1, backgroundColor: c.line, marginVertical: 20 },
  error: { fontSize: 14, lineHeight: 20, color: "#A32819" },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    backgroundColor: c.paper,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sheetHead: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: c.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 17, fontWeight: "500", color: c.muted },
});
