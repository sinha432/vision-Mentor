import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { AboutJourney } from "@/components/about/AboutJourney";

export function AboutPreview() {
  return (
    <div className="scroll-mt-24">
      <AboutJourney />
      <div className="mt-6 flex justify-end">
        <Link
          to="/about"
          className="btn-3d inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Read the full story
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
