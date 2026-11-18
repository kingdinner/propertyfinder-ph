import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const ROOT = path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }

  const relative = segments.join("/");
  if (relative.includes("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ ok: false, error: { message: "Invalid path" } }, { status: 400 });
  }

  const full = path.join(ROOT, relative);
  if (!full.startsWith(ROOT)) {
    return NextResponse.json({ ok: false, error: { message: "Invalid path" } }, { status: 400 });
  }

  try {
    const info = await stat(full);
    if (!info.isFile()) {
      return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
    }
    const bytes = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }
}
