import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  getCompanyProfile,
  updateCompanyProfile,
} from "@/lib/assessments-data";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "Company Profile — Company Dashboard" },
      {
        name: "description",
        content:
          "Manage your company name, industry, website and contact details.",
      },
    ],
  }),
  component: ProfilePage,
});

interface ProfileForm {
  companyName: string;
  industry: string;
  website: string;
  bio: string;
  contactEmail: string;
  phone: string;
}

const emptyForm: ProfileForm = {
  companyName: "",
  industry: "",
  website: "",
  bio: "",
  contactEmail: "",
  phone: "",
};

const labelClass =
  "font-display text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

function ProfilePage() {
  const queryClient = useQueryClient();

  const {
    data: company,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["company-profile"],
    queryFn: getCompanyProfile,
  });

  const loaded = useMemo<ProfileForm>(
    () => ({
      companyName: company?.name ?? "",
      industry: company?.industry ?? "",
      website: company?.website ?? "",
      bio: company?.bio ?? "",
      contactEmail: company?.contactEmail ?? "",
      phone: company?.phone ?? "",
    }),
    [company],
  );

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setForm(loaded);
    }
  }, [loaded, dirty]);

  const update = <K extends keyof ProfileForm>(
    key: K,
    value: ProfileForm[K],
  ) => {
    setDirty(true);

    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  async function saveProfile() {
    if (!form.companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }

    try {
      setSaving(true);

      const saved = await updateCompanyProfile({
        companyName: form.companyName,
        industry: form.industry,
        website: form.website,
        bio: form.bio,
        contactEmail: form.contactEmail,
        phone: form.phone,
      });

      const savedForm: ProfileForm = {
        companyName: saved.name,
        industry: saved.industry,
        website: saved.website,
        bio: saved.bio,
        contactEmail: saved.contactEmail,
        phone: saved.phone,
      };

      setForm(savedForm);
      setDirty(false);

      await queryClient.invalidateQueries({
        queryKey: ["company-profile"],
      });

      toast.success("Company profile saved successfully.");
    } catch (error) {
      console.error("Failed to save company profile:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save company profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetProfile() {
    setForm(loaded);
    setDirty(false);
    toast.info("Changes discarded.");
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="glass rounded-2xl p-7">
          <p className="text-sm text-muted-foreground">
            Loading company profile...
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="glass rounded-2xl p-7">
          <h1 className="font-display text-xl font-bold">
            Unable to load company profile
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Please refresh the page and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="glass-strong grid h-11 w-11 shrink-0 place-items-center rounded-xl">
            <Building2 className="h-5 w-5 text-primary" />
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Company Profile
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Manage the company information shown across your assessments.
            </p>
          </div>
        </div>
      </header>

      <form
        className="glass animate-fade-in space-y-6 rounded-2xl p-5 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProfile();
        }}
      >
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
              Company Information
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Basic information about your organization.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName" className={labelClass}>
                Company name
              </Label>

              <Input
                id="companyName"
                value={form.companyName}
                placeholder="Acme Inc."
                onChange={(event) =>
                  update("companyName", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry" className={labelClass}>
                Industry
              </Label>

              <Input
                id="industry"
                value={form.industry}
                placeholder="Software & IT"
                onChange={(event) =>
                  update("industry", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className={labelClass}>
                Website
              </Label>

              <Input
                id="website"
                type="url"
                inputMode="url"
                value={form.website}
                placeholder="https://acme.com"
                onChange={(event) =>
                  update("website", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail" className={labelClass}>
                Contact email
              </Label>

              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                placeholder="hiring@acme.com"
                onChange={(event) =>
                  update("contactEmail", event.target.value)
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone" className={labelClass}>
                Contact phone
              </Label>

              <Input
                id="phone"
                type="tel"
                value={form.phone}
                placeholder="+91 9876543210"
                onChange={(event) =>
                  update("phone", event.target.value)
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-border/60 pt-6">
          <div>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em]">
              Company Description
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Give candidates a short overview of your organization.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className={labelClass}>
              Short description
            </Label>

            <Textarea
              id="bio"
              rows={5}
              value={form.bio}
              placeholder="What your company does, in a couple of sentences."
              onChange={(event) =>
                update("bio", event.target.value)
              }
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          <Button
            type="submit"
            disabled={saving || !dirty}
            className="gradient-aurora hover-glow gap-2 text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-4 w-4" />

            {saving ? "Saving..." : "Save Changes"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            className="gap-2"
            onClick={resetProfile}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>

          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Company account
          </span>
        </div>
      </form>
    </div>
  );
}