import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createToken } from "@/lib/auth/crypto";

const ROOT = path.join(process.cwd(), "uploads");

export async function saveListingImage(listingId: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("Empty file");
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Image exceeds 8MB");
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Only JPEG, PNG, and WebP images are allowed");

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `listings/${listingId}/${createToken(12)}.${ext}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return { storageKey: key, mimeType: file.type };
}

export function publicUploadPath(storageKey: string) {
  return `/uploads/${storageKey}`;
}
