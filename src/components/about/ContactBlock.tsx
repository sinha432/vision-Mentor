import { Mail, MessageSquare, Github } from "lucide-react";

const CHANNELS = [
  { icon: Mail, label: "Email", value: "hello@example.com" },
  { icon: MessageSquare, label: "Feedback", value: "feedback@example.com" },
  { icon: Github, label: "Project", value: "github.com/example/vision-mentor-x" },
];

export function ContactBlock() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {CHANNELS.map((channel, i) => {
        const Icon = channel.icon;
        return (
          <div
            key={channel.label}
            className="reveal-on-scroll glass group flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyber/45"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-cyber/25 bg-surface/70 transition-transform duration-300 group-hover:scale-110">
              <Icon className="size-5 text-cyber" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                {channel.label}
              </p>
              <p className="mt-1 truncate text-sm text-foreground">{channel.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
