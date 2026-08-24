export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid-backdrop animate-grid-drift absolute inset-0 opacity-40" />
      <div className="absolute inset-x-0 top-0 h-[70vh] bg-glow opacity-30 blur-3xl" />
      <div className="animate-aurora-drift absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-aurora opacity-[0.18] blur-[110px]" />
      <div
        className="animate-aurora-drift absolute top-24 -left-32 h-[26rem] w-[26rem] rounded-full bg-cyber-gradient opacity-[0.14] blur-[100px]"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="animate-aurora-drift absolute top-56 -right-32 h-[28rem] w-[28rem] rounded-full bg-aurora opacity-[0.12] blur-[110px]"
        style={{ animationDelay: "-14s" }}
      />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="animate-aurora-float absolute rounded-full bg-cyber"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            filter: "blur(0.5px)",
          }}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-background to-transparent" />
    </div>
  );
}

const PARTICLES = [
  { left: "12%", top: "18%", size: "3px", delay: "0s", duration: "13s" },
  { left: "22%", top: "42%", size: "2px", delay: "-3s", duration: "16s" },
  { left: "34%", top: "12%", size: "2px", delay: "-6s", duration: "11s" },
  { left: "58%", top: "26%", size: "3px", delay: "-2s", duration: "15s" },
  { left: "71%", top: "9%", size: "2px", delay: "-8s", duration: "12s" },
  { left: "83%", top: "35%", size: "3px", delay: "-5s", duration: "17s" },
  { left: "91%", top: "16%", size: "2px", delay: "-10s", duration: "14s" },
  { left: "46%", top: "48%", size: "2px", delay: "-4s", duration: "18s" },
];
