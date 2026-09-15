import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  LogOut,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSignOut } from "@/hooks/use-sign-out";
import {
  getCompanyProfile,
  updateCompanyProfile,
  type CompanyPreferences,
} from "@/lib/assessments-data";

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
  const queryClient = useQueryClient();
  const {
    data: company,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => getCompanyProfile(),
  });

  const [preferences, setPreferences] =
    useState<CompanyPreferences | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company && !dirty) {
      setPreferences(company.preferences);
    }
  }, [company, dirty]);

  const currentPreferences = preferences ?? {
    assessmentDefaults: {
      requireMedia: false,
      questionWeight: 1,
    },
    notifications: {
      enabled: true,
      scheduleEmails: true,
      browserReminders: true,
      assessmentSubmissions: true,
    },
  };

  const updatePreferences = (
    next: CompanyPreferences,
  ) => {
    setPreferences(next);
    setDirty(true);
  };

  const saveSettings = async () => {
    if (!company || !preferences) return;

    setSaving(true);

    try {
      await updateCompanyProfile({
        companyName: company.name,
        industry: company.industry,
        website: company.website,
        bio: company.bio,
        contactEmail: company.contactEmail,
        phone: company.phone,
        preferences,
      });
      await queryClient.invalidateQueries({
        queryKey: ["company-profile"],
      });
      setDirty(false);
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    if (!company) return;
    setPreferences(company.preferences);
    setDirty(false);
    toast.success("Unsaved changes reset.");
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, appearance and defaults for new assessments.
        </p>
      </header>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Settings could not be loaded. Try refreshing the page.
        </div>
      )}

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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/dashboard/profile">
                <Users className="h-4 w-4" />
                Edit profile
              </Link>
            </Button>
            <Button
              variant="outline"
              className="hover-glow gap-2"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
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
              disabled={isLoading}
              checked={currentPreferences.assessmentDefaults.requireMedia}
              onCheckedChange={(checked) =>
                updatePreferences({
                  ...currentPreferences,
                  assessmentDefaults: {
                    ...currentPreferences.assessmentDefaults,
                    requireMedia: checked,
                  },
                })
              }
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
              value={currentPreferences.assessmentDefaults.questionWeight}
              onChange={(event) =>
                updatePreferences({
                  ...currentPreferences,
                  assessmentDefaults: {
                    ...currentPreferences.assessmentDefaults,
                    questionWeight: Math.min(
                      100,
                      Math.max(1, Number(event.target.value) || 1),
                    ),
                  },
                })
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
        description="Manage who can work in this company workspace."
      >
        <div className="rounded-xl border border-border bg-background/40 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 text-emerald" />
            {company?.contactEmail || "Current company owner"}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Team invitations and role management will use the company profile and authenticated workspace membership.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        icon={Bell}
        accent="bg-primary/15 text-primary"
        title="Notifications"
        description="Choose which company notifications are enabled."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="notifications-enabled" className="text-sm font-normal">
              Enable company notifications
            </Label>
            <Switch
              id="notifications-enabled"
              checked={currentPreferences.notifications.enabled}
              onCheckedChange={(enabled) =>
                updatePreferences({
                  ...currentPreferences,
                  notifications: {
                    ...currentPreferences.notifications,
                    enabled,
                  },
                })
              }
            />
          </div>
          <div className="space-y-3 border-l border-border pl-4">
            {[
              ["scheduleEmails", "Interview confirmation emails"],
              ["browserReminders", "Browser interview reminders"],
              ["assessmentSubmissions", "Assessment submission alerts"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label htmlFor={key} className="text-sm font-normal">
                  {label}
                </Label>
                <Switch
                  id={key}
                  disabled={!currentPreferences.notifications.enabled}
                  checked={currentPreferences.notifications[key as keyof CompanyPreferences["notifications"]] as boolean}
                  onCheckedChange={(checked) =>
                    updatePreferences({
                      ...currentPreferences,
                      notifications: {
                        ...currentPreferences.notifications,
                        [key]: checked,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-2 pb-4">
        <Button
          variant="outline"
          disabled={!dirty || saving}
          onClick={resetSettings}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button
          disabled={!dirty || saving}
          onClick={saveSettings}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
