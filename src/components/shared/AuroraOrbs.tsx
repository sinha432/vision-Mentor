export function AuroraOrbs({ dense = false }: { dense?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid-backdrop animate-grid-drift absolute inset-0 opacity-30" />
      <div className="absolute inset-x-0 top-0 h-[70vh] bg-glow opacity-25 blur-3xl" />
      <div className="animate-aurora-drift absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-aurora opacity-[0.16] blur-[110px]" />
      <div
        className="animate-aurora-drift absolute top-[30%] -left-40 h-[30rem] w-[30rem] rounded-full bg-cyber-gradient opacity-[0.12] blur-[110px]"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="animate-aurora-drift absolute top-[55%] -right-40 h-[32rem] w-[32rem] rounded-full bg-aurora opacity-[0.1] blur-[120px]"
        style={{ animationDelay: "-14s" }}
      />
      {dense && (
        <div
          className="animate-aurora-drift absolute bottom-0 left-1/4 h-[28rem] w-[28rem] rounded-full bg-cyber-gradient opacity-[0.09] blur-[120px]"
          style={{ animationDelay: "-18s" }}
        />
      )}
    </div>
  );
}
