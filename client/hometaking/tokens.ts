import { Platform } from "react-native";

export const palette = {
  paper: "#F7F6F2",
  ink: "#151513",
  muted: "#686862",
  line: "#D7D5CE",
  accent: "#D83D25",
  olive: "#65674A",
  rust: "#A64B32",
  white: "#FFFFFF",
};
export const displayFont = Platform.select({
  ios: "Helvetica Neue",
  android: "sans-serif",
  default: "Arial",
});
