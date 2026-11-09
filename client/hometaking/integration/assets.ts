type Hash = (text: string) => Promise<string>;
export async function encodeAssets(
  value: unknown,
  hid: string,
  hash: Hash,
  put: (path: string, text: string) => Promise<void>,
): Promise<unknown> {
  if (value && typeof value === "object" && "__ht_asset" in value)
    throw new Error("Reserved asset marker in imported data.");
  if (typeof value === "string" && value.length > 64000) {
    if (value.length > 10_000_000) throw new Error("Asset too large.");
    const path = `${hid}/${await hash(value)}.txt`;
    await put(path, value);
    return { __ht_asset: path };
  }
  if (Array.isArray(value))
    return Promise.all(value.map((v) => encodeAssets(v, hid, hash, put)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([k, v]) => [
          k,
          await encodeAssets(v, hid, hash, put),
        ]),
      ),
    );
  return value;
}
export async function decodeAssets(
  value: any,
  hid: string,
  hash: Hash,
  get: (path: string) => Promise<string>,
): Promise<any> {
  if (
    value &&
    typeof value === "object" &&
    typeof value.__ht_asset === "string"
  ) {
    const path = value.__ht_asset;
    if (!path.startsWith(hid + "/"))
      throw new Error("Asset belongs to a different household.");
    const text = await get(path);
    if (text.length > 10_000_000) throw new Error("Asset too large.");
    if (path !== `${hid}/${await hash(text)}.txt`)
      throw new Error(
        "Saved asset checksum does not match. Your device copy is preserved.",
      );
    return text;
  }
  if (Array.isArray(value))
    return Promise.all(value.map((v) => decodeAssets(v, hid, hash, get)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([k, v]) => [
          k,
          await decodeAssets(v, hid, hash, get),
        ]),
      ),
    );
  return value;
}
