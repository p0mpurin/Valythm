import { NextResponse } from "next/server";
import { cleanName, listSegments, saveSegment, StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

function failure(error: unknown) {
  if (error instanceof StoreError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json({ segments: await listSegments() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) throw new StoreError("That recording is too large.", 413);
    const audio = Buffer.from(await request.arrayBuffer());
    if (audio.length > MAX_BYTES) throw new StoreError("That recording is too large.", 413);
    const segment = await saveSegment(audio, cleanName(new URL(request.url).searchParams.get("name")));
    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) { return failure(error); }
}
