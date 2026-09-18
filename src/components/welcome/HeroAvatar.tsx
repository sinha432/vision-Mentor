import { lazy, Suspense, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NovaPanel } from "@/components/nova/NovaPanel";
import type { NovaChatStatus } from "@/components/nova/NovaChat";
import { stateLabel } from "@/lib/nova/expression";

const NovaChat = lazy(async () => {
  const module = await import("@/components/nova/NovaChat");
  return { default: module.NovaChat };
});

export function HeroAvatar() {
  const [nova, setNova] = useState<NovaChatStatus>({
    state: "idle",
    expression: "neutral",
    pulse: 0,
  });

  return (
    <div className="relative mx-auto w-full max-w-[21rem] sm:max-w-md">
      <span aria-hidden className="pointer-events-none animate-glow-pulse absolute inset-0 rounded-full bg-glow blur-3xl" />
      <span
        aria-hidden
        className="pointer-events-none animate-aurora-drift absolute inset-6 rounded-full bg-aurora opacity-20 blur-2xl"
      />

      <div className="card-3d relative rounded-[2rem] p-4">
        <NovaPanel
          expression={nova.expression}
          state={nova.state}
          pulse={nova.pulse}
          showPreview
        />
      </div>

      <div className="mt-5 flex justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <button className="btn-3d inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-primary-foreground">
              <MessageCircle className="h-4 w-4" />
              Talk to Nova
              <Sparkles className="h-3.5 w-3.5 opacity-80" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={14}
            className="popover-3d flex h-[26rem] w-[min(92vw,24rem)] flex-col p-3"
          >
            <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyber opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyber" />
              </span>
              <span className="font-display text-xs tracking-[0.18em] uppercase">Nova</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {stateLabel(nova.state)}
              </span>
            </div>
            <Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading Nova...</div>}>
              <NovaChat
                onStatusChange={setNova}
                emptyTitle="Hi, I'm Nova"
                emptyDescription="Ask me about Vision Mentor X — or anything else."
              />
            </Suspense>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
