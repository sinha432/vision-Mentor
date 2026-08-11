import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ImagePlus, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCompanyProfile } from "@/lib/assessments-data";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "Company Profile — Company Dashboard" },
      {
        name: "description",
        content:
          "Edit your company name, logo, industry, website and contact details.",
      },
    ],
  }),
  component: ProfilePage,
});

interface ProfileForm {
  companyName: string;
  logoUrl: string;
  industry: string;
  website: string;
  bio: string;
  contactEmail: string;
}

const emptyForm: ProfileForm = {
  companyName: "",
  logoUrl: "",
  industry: "",
  website: "",
  bio: "",
  contactEmail: "",
};

const labelClass =
  "font-display text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

function ProfilePage() {
  const { data: company } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => getCompanyProfile(),
  });

  const loaded = useMemo<ProfileForm>(
    () => ({ ...emptyForm, companyName: company?.name ?? "" }),
    [company?.name],
  );

  const [form, setForm] = useState<ProfileForm>(loaded);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) setForm(loaded);
  }, [loaded, dirty]);

  const update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const initials =
    form.companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "CO";

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logoUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="animate-fade-in">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          Company Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How your company appears to candidates on every assessment.
        </p>
      </header>

      <form
        className="glass animate-fade-in space-y-6 rounded-2xl p-5 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          setDirty(false);
          toast.success("Profile saved.");
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0 space-y-2">
            <span className={labelClass}>Logo</span>
            <div className="glass-strong grid h-24 w-24 place-items-center overflow-hidden rounded-2xl">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt={`${form.companyName || "Company"} logo preview`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-lg font-bold text-muted-foreground">
                  {initials}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className={labelClass}>
                Logo URL
              </Label>
              <Input
                id="logoUrl"
                inputMode="url"
                placeholder="https://example.com/logo.png"
                value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
                onChange={(event) => update("logoUrl", event.target.value)}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onPickFile(event.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="hover-glow gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                Upload image
              </Button>
              {form.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => update("logoUrl", "")}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
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
              onChange={(event) => update("companyName", event.target.value)}
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
              onChange={(event) => update("industry", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className={labelClass}>
              Website
            </Label>
            <Input
              id="website"
              inputMode="url"
              value={form.website}
              placeholder="https://acme.com"
              onChange={(event) => update("website", event.target.value)}
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
              onChange={(event) => update("contactEmail", event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio" className={labelClass}>
            Short description
          </Label>
          <Textarea
            id="bio"
            rows={4}
            value={form.bio}
            placeholder="What your company does, in a couple of sentences."
            onChange={(event) => update("bio", event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          <Button
            type="submit"
            className="gradient-aurora hover-glow gap-2 text-primary-foreground"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              setForm(loaded);
              setDirty(false);
              toast.info("Changes discarded.");
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Saved locally for now
          </span>
        </div>
      </form>
    </div>
  );
}
