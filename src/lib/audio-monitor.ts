import { patchVisionStatus, type Level } from "./vision-status";

/**
 * Microphone environment monitor. Tracks loudness plus spectral variation to
 * spot sustained background noise and more than one voice in the room.
 */
export class AudioMonitor {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private raf: number | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private lastEmit = 0;
  private loudFrames = 0;
  private voiceFrames = 0;
  private levelListener: ((level: number) => void) | null = null;

  onLevel(cb: (level: number) => void) {
    this.levelListener = cb;
  }

  start(stream: MediaStream) {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.75;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.freq = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.loop();
  }

  private loop = () => {
    const analyser = this.analyser;
    const data = this.data;
    const freq = this.freq;
    if (!analyser || !data || !freq) return;
    analyser.getByteTimeDomainData(data);
    analyser.getByteFrequencyData(freq);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i]! - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    this.levelListener?.(Math.min(1, rms * 6));

    // count distinct strong bands in the speech range as a proxy for voices
    let peaks = 0;
    for (let i = 4; i < 120; i++) {
      const prev = freq[i - 1]!;
      const cur = freq[i]!;
      const next = freq[i + 1]!;
      if (cur > 118 && cur > prev && cur >= next) peaks++;
    }

    if (rms > 0.09) this.loudFrames++;
    else this.loudFrames = Math.max(0, this.loudFrames - 1);
    if (peaks >= 5 && rms > 0.05) this.voiceFrames++;
    else this.voiceFrames = Math.max(0, this.voiceFrames - 1);

    const now = performance.now();
    if (now - this.lastEmit > 700) {
      this.lastEmit = now;
      let text = "Quiet / clear";
      let level: Level = "good";
      if (this.voiceFrames > 25) {
        text = "Multiple voices / speakers detected";
        level = "bad";
      } else if (this.loudFrames > 40) {
        text = "Sustained background noise";
        level = "bad";
      } else if (this.loudFrames > 18) {
        text = "Some background sound";
        level = "warn";
      }
      patchVisionStatus({ audio: { text, level } });
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  stop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    try { this.source?.disconnect(); } catch {}
    try { void this.ctx?.close(); } catch {}
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.levelListener = null;
    patchVisionStatus({ audio: { text: "Waiting…", level: "idle" } });
  }
}
