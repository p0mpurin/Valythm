import type { Shape } from "./audio";

export type Segment = Shape & { name: string; buffer: AudioBuffer };
type Voice = { segment: Segment; start: number; offset: number; node: AudioBufferSourceNode };

const LOOKAHEAD = 1.2;
const TICK_MS = 150;

/**
 * Plays segments back to back, forever. Each segment is scheduled ahead of time on the
 * audio clock, so the seams are sample-accurate and new segments join without a restart.
 */
export class LoopEngine {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly master: GainNode;
  segments: Segment[] = [];
  playing = false;
  onChange?: () => void;
  private voices: Voice[] = [];
  private nextIndex = 0;
  private nextTime = 0;
  private pausedAt = 0;
  private timer = 0;

  constructor() {
    // Lets Web Audio play with the iPhone ringer switch on silent.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    this.context = new AudioContext({ latencyHint: "playback" });
    this.master = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(this.analyser).connect(this.context.destination);
  }

  get total() { return this.segments.reduce((sum, segment) => sum + segment.duration, 0); }

  private startOf(segment: Segment) {
    let offset = 0;
    for (const item of this.segments) { if (item === segment) return offset; offset += item.duration; }
    return -1;
  }

  /** Current position in the combined track, in seconds, matched to what is audible. */
  position() {
    if (!this.playing) return this.pausedAt;
    const now = this.context.currentTime - (this.context.outputLatency || 0);
    for (const voice of this.voices) {
      if (now < voice.start + voice.segment.duration - voice.offset) {
        const start = this.startOf(voice.segment);
        if (start >= 0) return start + voice.offset + Math.max(0, now - voice.start);
      }
    }
    return this.pausedAt;
  }

  play(from = this.pausedAt) {
    const count = this.segments.length;
    if (!count) return;
    void this.context.resume();
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(1, now + 0.08);
    this.stopVoices();

    let index = 0, offset = from >= this.total ? 0 : Math.max(0, from);
    while (index < count - 1 && offset >= this.segments[index].duration) offset -= this.segments[index++].duration;
    offset = Math.min(offset, this.segments[index].duration - 0.01);
    const start = now + 0.05;
    this.schedule(this.segments[index], start, offset);
    this.nextIndex = index + 1;
    this.nextTime = start + this.segments[index].duration - offset;

    if (!this.playing) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.playing = true;
    this.tick();
    this.onChange?.();
  }

  pause() {
    if (!this.playing) return;
    this.pausedAt = this.position();
    this.playing = false;
    window.clearInterval(this.timer);
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.02);
    for (const voice of this.voices) voice.node.stop(now + 0.1);
    this.voices = [];
    this.onChange?.();
  }

  seek(seconds: number) {
    if (this.playing) this.play(seconds);
    else { this.pausedAt = Math.max(0, Math.min(seconds, this.total)); this.onChange?.(); }
  }

  append(segment: Segment) {
    this.segments = [...this.segments, segment];
    this.onChange?.();
  }

  remove(id: string) {
    const removed = this.segments.find(segment => segment.id === id);
    if (!removed) return;
    const position = this.position();
    const removedStart = this.startOf(removed);
    this.segments = this.segments.filter(segment => segment !== removed);
    // Keep listening from the same spot; if that spot was inside the removed segment, carry on with the next one.
    let next = position;
    if (position >= removedStart + removed.duration) next = position - removed.duration;
    else if (position >= removedStart) next = removedStart;
    if (!this.segments.length) { this.pause(); this.pausedAt = 0; }
    else if (this.playing) this.play(next >= this.total ? 0 : next);
    else this.pausedAt = next >= this.total ? 0 : next;
    this.onChange?.();
  }

  dispose() {
    window.clearInterval(this.timer);
    this.stopVoices();
    void this.context.close();
  }

  private schedule(segment: Segment, start: number, offset: number) {
    const node = this.context.createBufferSource();
    node.buffer = segment.buffer;
    node.connect(this.master);
    node.start(start, offset);
    const voice = { segment, start, offset, node };
    node.onended = () => { this.voices = this.voices.filter(item => item !== voice); };
    this.voices.push(voice);
  }

  private stopVoices() {
    for (const voice of this.voices) { try { voice.node.stop(); } catch { /* not started yet */ } }
    this.voices = [];
  }

  private tick() {
    if (!this.segments.length) return;
    const now = this.context.currentTime;
    // If the page was throttled, pick up from now instead of piling sounds onto the past.
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD) {
      // Wrapping lazily means a segment appended mid-cycle still plays in this cycle.
      if (this.nextIndex >= this.segments.length) this.nextIndex = 0;
      const segment = this.segments[this.nextIndex++];
      this.schedule(segment, this.nextTime, 0);
      this.nextTime += segment.duration;
    }
  }
}
