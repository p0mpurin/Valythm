import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { MAX_NAME, MAX_SECONDS, MIN_SECONDS } from "./constants";

export type SegmentMeta = { id: string; name: string; duration: number; createdAt: number };

// Upstash Redis (added through the Vercel marketplace) when configured, the local disk otherwise.
const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const INDEX = "valythm:segments";
const audioKey = (id: string) => `valythm:audio:${id}`;
const dataDir = process.env.VALYTHM_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".valythm-data");

export const ID_PATTERN = /^[a-z0-9]+-[a-f0-9]{8}$/;

export class StoreError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function redis<T>(...command: (string | number)[]): Promise<T> {
  const response = await fetch(redisUrl!, { method: "POST", headers: { Authorization: `Bearer ${redisToken}` }, body: JSON.stringify(command), cache: "no-store" });
  const json = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
  if (!response.ok || json.error) throw new StoreError(`Storage error: ${json.error ?? response.status}`, 502);
  return json.result as T;
}

function assertWritable() {
  if (!redisUrl && process.env.VERCEL) throw new StoreError("Storage is not set up yet. Connect an Upstash Redis store to this Vercel project.", 503);
}

/** Reads a PCM WAV header and returns its duration in seconds. */
function wavDuration(buffer: Buffer) {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return null;
  let offset = 12, byteRate = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") byteRate = buffer.readUInt32LE(offset + 16);
    if (id === "data") return byteRate ? Math.min(size, buffer.length - offset - 8) / byteRate : null;
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function cleanName(raw: string | null) {
  return (raw ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME);
}

export async function listSegments(): Promise<SegmentMeta[]> {
  let items: SegmentMeta[];
  if (redisUrl) {
    const values = await redis<string[] | null>("HVALS", INDEX);
    items = (values ?? []).map(value => JSON.parse(value));
  } else {
    const files = await fs.readdir(dataDir).catch(() => [] as string[]);
    items = await Promise.all(files.filter(file => file.endsWith(".json")).map(async file => JSON.parse(await fs.readFile(path.join(/*turbopackIgnore: true*/ dataDir, file), "utf8"))));
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveSegment(audio: Buffer, name: string): Promise<SegmentMeta> {
  assertWritable();
  const duration = wavDuration(audio);
  if (duration === null) throw new StoreError("That recording is not a valid WAV file.");
  if (duration < MIN_SECONDS) throw new StoreError("That recording is too short.");
  if (duration > MAX_SECONDS + 0.5) throw new StoreError(`Recordings can be at most ${MAX_SECONDS} seconds.`);
  const createdAt = Date.now();
  const meta: SegmentMeta = { id: `${createdAt.toString(36)}-${randomBytes(4).toString("hex")}`, name, duration, createdAt };
  if (redisUrl) {
    await redis("SET", audioKey(meta.id), audio.toString("base64"));
    await redis("HSET", INDEX, meta.id, JSON.stringify(meta));
  } else {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ dataDir, `${meta.id}.wav`), audio);
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ dataDir, `${meta.id}.json`), JSON.stringify(meta));
  }
  return meta;
}

export async function readAudio(id: string): Promise<Buffer | null> {
  if (redisUrl) {
    const value = await redis<string | null>("GET", audioKey(id));
    return value ? Buffer.from(value, "base64") : null;
  }
  return fs.readFile(path.join(/*turbopackIgnore: true*/ dataDir, `${id}.wav`)).catch(() => null);
}

export async function deleteSegment(id: string) {
  assertWritable();
  if (redisUrl) {
    await redis("HDEL", INDEX, id);
    await redis("DEL", audioKey(id));
  } else {
    await Promise.all([".json", ".wav"].map(ext => fs.rm(path.join(/*turbopackIgnore: true*/ dataDir, `${id}${ext}`), { force: true })));
  }
}
