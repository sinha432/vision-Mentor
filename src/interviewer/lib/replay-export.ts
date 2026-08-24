import {
  COACH_AREA_LABELS,
  PROCTOR_LABELS,
  type CoachingEvent,
  type FlagSeverity,
  type PresenceSample,
  type ProctorEvent,
} from "./interview-types";

export interface ExportMarker {
  t: number;
  kind: "coach" | "proctor" | "forensics";
  label: string;
  detail: string;
  severity: FlagSeverity;
  confidence?: number;
}

const SEVERITY_COLOR: Record<FlagSeverity, string> = {
  high: "#ff5f56",
  medium: "#ffbe3d",
  low: "#8fa3b8",
};

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Downloadable JSON log of every presence + integrity detection. */
export function exportIntegrityLog(opts: {
  sessionId: string;
  coaching: CoachingEvent[];
  proctor: ProctorEvent[];
  presence: PresenceSample[];
}) {
  const payload = {
    sessionId: opts.sessionId,
    exportedAt: new Date().toISOString(),
    presenceCoaching: opts.coaching.map((c) => ({
      at: clock(c.t),
      seconds: c.t,
      area: COACH_AREA_LABELS[c.area],
      severity: c.severity ?? "low",
      confidence: c.confidence ?? null,
      instruction: c.instruction,
      reason: c.reason ?? "",
    })),
    integrity: opts.proctor.map((p) => ({
      at: clock(p.t),
      seconds: p.t,
      kind: PROCTOR_LABELS[p.kind],
      severity: p.severity ?? "medium",
      confidence: p.confidence ?? null,
      detail: p.detail,
    })),
    presenceTrack: opts.presence,
  };
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `vision-mentor-x-${opts.sessionId}-integrity-log.json`,
  );
}

/**
 * Re-render the locally stored webcam clip onto a canvas with posture, eye
 * contact and grooming markers plus severity captions burned in, then hand the
 * result back as a downloadable video. Runs entirely in the browser.
 */
export async function exportMarkedReplay(opts: {
  sessionId: string;
  blob: Blob;
  markers: ExportMarker[];
  presence: PresenceSample[];
  onProgress?: (ratio: number) => void;
}): Promise<boolean> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(opts.blob);
  // Not muted: a muted element yields silence through Web Audio. Playback is
  // routed into the recording graph only, so it stays inaudible.
  video.muted = false;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("clip unreadable"));
    });

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    const stream = canvas.captureStream(30);

    // Carry the recorded audio into the export. The element output is routed
    // only into the recording destination, so nothing plays out loud while the
    // export renders.
    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        audioCtx = new AudioCtor();
        const source = audioCtx.createMediaElementSource(video);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }
    } catch {
      audioCtx = null;
    }
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start(500);

    const total = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const sorted = [...opts.markers].sort((a, b) => a.t - b.t);
    let raf = 0;

    const draw = () => {
      const t = video.currentTime;
      ctx.drawImage(video, 0, 0, width, height);

      // Presence strip along the bottom.
      const stripH = Math.round(height * 0.13);
      const top = height - stripH;
      ctx.fillStyle = "rgba(8,14,24,0.72)";
      ctx.fillRect(0, top, width, stripH);
      const span = Math.max(total, sorted.at(-1)?.t ?? 0, 30);
      const tracks: Array<[keyof PresenceSample, string]> = [
        ["eyeContact", "#4fd8e8"],
        ["posture", "#66dd93"],
        ["attention", "#ffd166"],
      ];
      for (const [key, color] of tracks) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        opts.presence.forEach((s, i) => {
          const x = (Math.min(s.t, span) / span) * width;
          const v = Math.max(0, Math.min(100, Number(s[key]) || 0));
          const y = top + stripH - (v / 100) * (stripH - 6) - 3;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      // Marker ticks.
      for (const m of sorted) {
        const x = (Math.min(m.t, span) / span) * width;
        ctx.fillStyle = SEVERITY_COLOR[m.severity];
        ctx.fillRect(x - 1, top, 2, stripH);
      }
      // Playhead.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((Math.min(t, span) / span) * width - 1, top, 2, stripH);

      // Active caption: the marker within the last 4 seconds.
      const active = [...sorted].reverse().find((m) => t >= m.t && t - m.t < 4);
      if (active) {
        const pad = 14;
        ctx.font = `600 ${Math.round(height * 0.032)}px system-ui, sans-serif`;
        const label = `${active.severity.toUpperCase()} · ${active.label}${
          active.confidence ? ` · ${Math.round(active.confidence)}%` : ""
        }`;
        const text = active.detail.slice(0, 96);
        const boxW = Math.max(ctx.measureText(label).width, ctx.measureText(text).width) + pad * 2;
        const boxH = Math.round(height * 0.12);
        ctx.fillStyle = "rgba(8,14,24,0.8)";
        ctx.fillRect(pad, pad, Math.min(boxW, width - pad * 2), boxH);
        ctx.fillStyle = SEVERITY_COLOR[active.severity];
        ctx.fillRect(pad, pad, 4, boxH);
        ctx.fillStyle = SEVERITY_COLOR[active.severity];
        ctx.fillText(label, pad + 14, pad + boxH * 0.4);
        ctx.fillStyle = "#eef4fb";
        ctx.font = `400 ${Math.round(height * 0.03)}px system-ui, sans-serif`;
        ctx.fillText(text, pad + 14, pad + boxH * 0.78);
      }

      // Timecode.
      ctx.fillStyle = "rgba(238,244,251,0.85)";
      ctx.font = `500 ${Math.round(height * 0.028)}px system-ui, sans-serif`;
      ctx.fillText(clock(t), width - 70, height - stripH - 12);

      if (total) opts.onProgress?.(Math.min(1, t / total));
      raf = requestAnimationFrame(draw);
    };

    await video.play();
    draw();
    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    cancelAnimationFrame(raf);
    recorder.stop();
    await done;
    await audioCtx?.close().catch(() => {});

    download(
      new Blob(chunks, { type: "video/webm" }),
      `vision-mentor-x-${opts.sessionId}-replay-marked.webm`,
    );
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(video.src);
  }
}
