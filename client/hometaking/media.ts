import { Platform, Share } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Project, parseProject } from "./model";

export async function pickPicture(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    allowsEditing: true,
    quality: 0.45,
    base64: true,
  });
  if (result.canceled) return null;
  return pictureUri(result.assets[0]);
}

export async function pickPictures(limit: number): Promise<string[]> {
  if (limit < 1)
    throw new Error(
      "This room already has 30 pictures. Remove one before adding more.",
    );
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    allowsMultipleSelection: true,
    allowsEditing: false,
    selectionLimit: limit,
    quality: 0.45,
    base64: true,
  });
  if (result.canceled) return [];
  if (result.assets.length > limit)
    throw new Error(
      `Choose up to ${limit} pictures for this room. Nothing was added.`,
    );
  return Promise.all(result.assets.map(pictureUri));
}

async function pictureUri(a: ImagePicker.ImagePickerAsset): Promise<string> {
  let uri = a.base64
    ? `data:${a.mimeType ?? "image/jpeg"};base64,${a.base64}`
    : a.uri;
  if (Platform.OS === "web" && !uri.startsWith("data:")) {
    const blob = await (await fetch(uri)).blob();
    uri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(uri))
    throw new Error("Please choose a JPEG, PNG or WebP image.");
  if (uri.length > 1_500_000)
    throw new Error(
      "Please choose a smaller picture, under about 1 MB, for this pilot.",
    );
  return uri;
}
export async function exportProject(project: Project) {
  const data = JSON.stringify(project),
    filename = "hometaking-backup.json";
  if (Platform.OS === "web") {
    const uri = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = uri;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(uri), 1000);
    return;
  }
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, data);
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      UTI: "public.json",
    });
  else await Share.share({ message: data });
}
export async function importProject(): Promise<Project | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 100_000_000)
    throw new Error("This backup is too large.");
  const raw =
    Platform.OS === "web"
      ? await (await fetch(asset.uri)).text()
      : await FileSystem.readAsStringAsync(asset.uri);
  return parseProject(raw);
}
