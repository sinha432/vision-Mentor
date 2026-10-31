import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type CandidateOption = {
  id: string;
  name: string;
  email: string;
};

type CandidatePickerProps = {
  selectedCandidates: CandidateOption[];
  onSelectionChange: (candidates: CandidateOption[]) => void;
  disabled?: boolean;
};

export function CandidatePicker({
  selectedCandidates,
  onSelectionChange,
  disabled = false,
}: CandidatePickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CandidateOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");

  useEffect(() => {
    const search = query.trim();
    if (search.length === 1) {
      setOptions([]);
      setSearchError("");
      setSearching(false);
      return;
    }

    let active = true;
    setOptions([]);
    setSearching(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      const queryString = search ? `?q=${encodeURIComponent(search)}` : "";
      void fetch(`/api/company/candidates${queryString}`)
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error ?? "Candidate search failed");
          return result as { candidates?: CandidateOption[] };
        })
        .then((result) => {
          if (active) setOptions(Array.isArray(result.candidates) ? result.candidates : []);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setOptions([]);
          setSearchError(error instanceof Error ? error.message : "Candidate search failed");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const toggleCandidate = (candidate: CandidateOption, checked: boolean) => {
    const isSelected = selectedCandidates.some((item) => item.id === candidate.id);
    if (checked && !isSelected && selectedCandidates.length >= 25) {
      toast.error("You can send up to 25 invitations at a time.");
      return;
    }
    onSelectionChange(
      checked
        ? isSelected
          ? selectedCandidates
          : [...selectedCandidates, candidate]
        : selectedCandidates.filter((item) => item.id !== candidate.id),
    );
  };

  const addEmailRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = emailName.trim();
    const email = emailAddress.trim().toLowerCase();
    if (!name || !email) return;
    if (selectedCandidates.length >= 25) {
      toast.error("You can send up to 25 invitations at a time.");
      return;
    }

    const existing = selectedCandidates.find(
      (candidate) => candidate.email.toLowerCase() === email,
    );
    if (existing) {
      toast.error("This email address is already selected.");
      return;
    }

    onSelectionChange([...selectedCandidates, { id: `email:${email}`, name, email }]);
    setEmailName("");
    setEmailAddress("");
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyber">
            <UserRound className="h-3.5 w-3.5" /> Candidate invitations
          </div>
          <h2 className="font-display text-lg">Choose who receives the test</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a registered candidate or enter an email address. Recipients can sign in or
            create an individual account using that email before starting the test.
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          {selectedCandidates.length} selected · max 25
        </span>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by candidate name or email"
          aria-label="Search registered candidates"
          disabled={disabled}
          className="pl-9"
        />
      </label>

      {selectedCandidates.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected candidates">
          {selectedCandidates.map((candidate) => (
            <li
              key={candidate.id}
              className="flex max-w-full items-center gap-2 rounded-md border border-cyber/25 bg-cyber/5 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate">
                {candidate.name} · {candidate.email}
              </span>
              <button
                type="button"
                onClick={() => toggleCandidate(candidate, false)}
                disabled={disabled}
                aria-label={`Remove ${candidate.name}`}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchError && (
        <p role="alert" className="text-sm text-destructive">
          {searchError}
        </p>
      )}
      {query.trim().length === 1 ? (
        <p className="text-xs text-muted-foreground">Enter at least two characters to search.</p>
      ) : searching ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching candidates
        </p>
      ) : !searchError && options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {query.trim() ? "No matching candidates found." : "No registered candidates found."}
        </p>
      ) : (
        <ul
          className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border"
          aria-label="Candidate search results"
        >
          {options.map((candidate) => {
            const isSelected = selectedCandidates.some((item) => item.id === candidate.id);
            return (
              <li key={candidate.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent/40">
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled || (!isSelected && selectedCandidates.length >= 25)}
                    onCheckedChange={(checked) => toggleCandidate(candidate, Boolean(checked))}
                    aria-label={`Select ${candidate.name}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {candidate.email}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={addEmailRecipient} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={emailName}
          onChange={(event) => setEmailName(event.target.value)}
          placeholder="Candidate name"
          aria-label="Candidate name for email invitation"
          disabled={disabled || selectedCandidates.length >= 25}
          maxLength={100}
          required
        />
        <Input
          type="email"
          value={emailAddress}
          onChange={(event) => setEmailAddress(event.target.value)}
          placeholder="candidate@example.com"
          aria-label="Candidate email for invitation"
          disabled={disabled || selectedCandidates.length >= 25}
          maxLength={254}
          required
        />
        <Button
          type="submit"
          variant="outline"
          disabled={disabled || selectedCandidates.length >= 25}
          className="gap-2"
        >
          <Mail className="h-4 w-4" />
          Add email
        </Button>
      </form>
    </section>
  );
}
