import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { scanSchema } from "./schema";
const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<{
        support(): Promise<{ supported: boolean }>;
        capture(): Promise<string>;
        viewModel?: (raw: string, visual: boolean) => Promise<boolean>;
      }>("HometakingRoomPlan")
    : null;
export async function scanSupport() {
  if (!native)
    return {
      supported: false,
      message:
        Platform.OS === "ios"
          ? "Room scanning needs an installed Hometaking native build. Expo Go cannot scan rooms."
          : "Apple room scanning is available on supported LiDAR iPhones and iPads. Use photos and measurements here.",
    };
  const support = await native.support();
  return {
    ...support,
    message: support.supported
      ? "LiDAR scanning is available. Camera permission is requested when you start."
      : "This device does not support Apple RoomPlan. Use photos and measurements.",
  };
}
export async function captureRoom() {
  if (!native) throw new Error("Install the native Hometaking build to scan.");
  const result = scanSchema.safeParse(JSON.parse(await native.capture()));
  if (!result.success)
    throw new Error(
      "This scan did not contain a supported complete room. Scan all walls again or use manual measurements. The original scan is retained on this device.",
    );
  return result.data;
}

export async function viewOriginalScan(raw: string) {
  if (!native?.viewModel)
    throw new Error(
      "Install the updated native Hometaking app to view this scan in 3D.",
    );
  await native.viewModel(raw, false);
}
