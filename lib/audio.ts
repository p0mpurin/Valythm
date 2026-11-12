import { MAX_SECONDS, SAMPLE_RATE } from "./constants";

/** Anything the waveform can draw: a duration and its peak envelope. */
export type Shape = { id: string; duration: number; peaks: Float32Array };

const PEAKS_PER_SECOND = 80;

export function peaksFor(buffer: AudioBuffer) {
  const data = buffer.getChannelData(0);
  const count = Math.max(1, Math.ceil(buffer.duration * PEAKS_PER_SECOND));
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * data.length / count);
    const end = Math.floor((i + 1) * data.length / count);
    let max = 0;
    for (let j = start; j < end; j += 4) max = Math.max(max, Math.abs(data[j]));
    peaks[i] = Math.min(1, max);
  }
  return peaks;
}

/** Peak of the combined track between two moments, or -1 where a segment boundary falls. */
export function peakAt(shapes: Shape[], from: number, to: number) {
  let offset = 0, peak = 0;
  for (const shape of shapes) {
    const end = offset + shape.duration;
    if (offset > from && offset < to) return -1;
    if (end > from && offset < to) {
      const a = Math.max(0, Math.floor((from - offset) / shape.duration * shape.peaks.length));
      const b = Math.min(shape.peaks.length, Math.ceil((to - offset) / shape.duration * shape.peaks.length));
      for (let i = a; i < Math.max(b, a + 1) && i < shape.peaks.length; i++) peak = Math.max(peak, shape.peaks[i]);
    }
    offset = end;
  }
  return peak;
}

/** Mono, 16-bit WAV at a fixed sample rate: small, and every browser can decode it. */
export async function encodeWav(buffer: AudioBuffer) {
  const duration = Math.min(buffer.duration, MAX_SECONDS);
  const offline = new OfflineAudioContext(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const fade = Math.floor(SAMPLE_RATE * 0.008);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + samples.length * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    // Short fades at both ends keep the loop seams click-free.
    const gain = Math.min(1, i / fade, (samples.length - 1 - i) / fade);
    const value = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

export const formatTime = (time: number) => {
  const seconds = Math.max(0, Math.floor(time || 0));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
};
