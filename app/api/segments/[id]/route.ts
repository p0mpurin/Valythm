import { NextResponse } from "next/server";
import { deleteSegment, ID_PATTERN, readAudio, StoreError } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const audio = await readAudio(id).catch(() => null);
  if (!audio) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Ids are never reused, so the audio behind one can be cached forever.
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await deleteSegment(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove that recording." }, { status });
  }
}
