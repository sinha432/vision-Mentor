import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  LogOut,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSignOut } from "@/hooks/use-sign-out";
import { getCompanyProfile } from "@/lib/assessments-data";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Company Dashboard" },
      {
        name: "description",
        content:
          "Manage your account, appearance and default assessment options.",
      },
    ],
  }),
  component: SettingsPage,
});

function SectionCard({
  icon: Icon,
  accent,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="glass animate-fade-in rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

function SettingsPage() {
  const signOut = useSignOut();
  const { data: company } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => getCompanyProfile(),
  });

  const [requireMedia, setRequireMedia] = useState(false);
  const [questionWeight, setQuestionWeight] = useState(1);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, appearance and defaults for new assessments.
        </p>
      </header>

      <SectionCard
        icon={ShieldCheck}
        accent="bg-cyber/15 text-cyber"
        title="Account"
        description="You are signed in to this company workspace."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="truncate text-sm">
            {company?.name ?? "Your Company"}
          </span>
          <Button
            variant="outline"
            className="hover-glow gap-2"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={Palette}
        accent="bg-violet/15 text-violet"
        title="Appearance"
        description="Switch between dark and light presentation."
      >
        <ThemeToggle />
      </SectionCard>

      <SectionCard
        icon={SlidersHorizontal}
        accent="bg-emerald/15 text-emerald"
        title="Assessment Defaults"
        description="Applied to every new assessment you create."
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="require-media" className="max-w-sm text-sm font-normal">
              Require camera/microphone by default for new assessments
            </Label>
            <Switch
              id="require-media"
              checked={requireMedia}
              onCheckedChange={setRequireMedia}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="question-weight" className="text-sm font-normal">
              Default question weight
            </Label>
            <Input
              id="question-weight"
              type="number"
              min={1}
              max={100}
              value={questionWeight}
              onChange={(event) =>
                setQuestionWeight(Number(event.target.value) || 0)
              }
              className="w-24"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Users}
        accent="bg-amber/15 text-amber"
        title="Team & Access"
        description="Coming soon — invite teammates and manage their permissions."
      />

      <SectionCard
        icon={Bell}
        accent="bg-primary/15 text-primary"
        title="Notifications"
        description="Coming soon — email alerts when candidates submit an assessment."
      />
    </div>
  );
}
