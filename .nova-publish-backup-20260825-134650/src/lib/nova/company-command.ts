export type CompanyNovaCommand =
  | {
      type: "generate_questions";
      role?: string;
      topic?: string;
      difficulty?: "Easy" | "Medium" | "Hard";
      count?: number;
    }
  | {
      type: "publish_assessment";
      confirmed: boolean;
      assessmentCode?: string;
    }
  | {
      type: "create_assessment";
      role?: string;
      topic?: string;
      difficulty?: "Easy" | "Medium" | "Hard";
      count?: number;
    }
  | {
      type: "schedule_interview";
    }
  | {
      type: "analyze_candidates";
    }
  | {
      type: "hiring_analytics";
    }
  | {
      type: "unknown";
    };

function extractRole(text: string): string | undefined {
  const patterns = [
    /for\s+(?:a\s+)?(.+?)(?:\s+with|\s+on|\s+covering|\s+questions|\s*$)/i,
    /role\s*(?:is|:)?\s*(.+?)(?:\s+with|\s+on|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractTopic(text: string): string | undefined {
  const patterns = [
    /(?:about|on|covering)\s+(.+?)(?:\s+for|\s+with|\s*$)/i,
    /(?:react|javascript|typescript|python|java|sql|node\.?js|machine learning|data science|aws|mongodb)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }

    if (match?.[0]) {
      return match[0].trim();
    }
  }

  return undefined;
}

export function detectCompanyCommand(
  text: string,
): CompanyNovaCommand {
  const value = text.trim().toLowerCase();

  if (!value) {
    return { type: "unknown" };
  }

  /*
   * ---------------------------------------------------------
   * PUBLISH / RELEASE ASSESSMENT
   * ---------------------------------------------------------
   *
   * "publish it" => publish_assessment, confirmed: false
   *
   * "yes publish it"
   * "confirm publish"
   * "go ahead and publish"
   * => publish_assessment, confirmed: true
   */

  const publishIntent =
    /\b(publish|release|launch|activate|make\s+(?:it\s+)?live|go\s+live)\b/.test(
      value,
    );

  if (publishIntent) {
    const confirmed =
      /\b(yes|yeah|yep|confirm|confirmed|go ahead|do it|proceed|approve|approved)\b/.test(
        value,
      );

    return {
      type: "publish_assessment",
      confirmed,
    };
  }

  /*
   * ---------------------------------------------------------
   * ANALYZE CANDIDATES
   * ---------------------------------------------------------
   */

  if (
    /\b(analyze|analyse|review|evaluate)\b/.test(value) &&
    /\b(candidate|candidates|applicant|applicants)\b/.test(value)
  ) {
    return {
      type: "analyze_candidates",
    };
  }

  /*
   * ---------------------------------------------------------
   * HIRING ANALYTICS
   * ---------------------------------------------------------
   */

  if (
    /\b(hiring|recruitment|recruiting)\b/.test(value) &&
    /\b(analytics|statistics|stats|metrics|performance)\b/.test(value)
  ) {
    return {
      type: "hiring_analytics",
    };
  }

  /*
   * ---------------------------------------------------------
   * SCHEDULE INTERVIEW
   * ---------------------------------------------------------
   */

  if (
    /\b(schedule|book|plan|arrange)\b/.test(value) &&
    /\b(interview|meeting|call)\b/.test(value)
  ) {
    return {
      type: "schedule_interview",
    };
  }

  /*
   * ---------------------------------------------------------
   * GENERATE / CREATE QUESTIONS
   * ---------------------------------------------------------
   */

  if (
    /\b(create|generate|make|build|prepare|design)\b/.test(value) &&
    /\b(question|questions|assessment|test|interview)\b/.test(value)
  ) {
    const countMatch = value.match(
      /\b(\d{1,2})\s*(?:questions|q|items)\b/,
    );

    const count = countMatch
      ? Math.min(Math.max(Number(countMatch[1]), 1), 50)
      : undefined;

    let difficulty:
      | "Easy"
      | "Medium"
      | "Hard"
      | undefined;

    if (/\b(easy|beginner|basic|junior)\b/.test(value)) {
      difficulty = "Easy";
    } else if (
      /\b(hard|difficult|advanced|senior)\b/.test(value)
    ) {
      difficulty = "Hard";
    } else if (
      /\b(medium|moderate|intermediate)\b/.test(value)
    ) {
      difficulty = "Medium";
    }

    const role = extractRole(text);
    const topic = extractTopic(text);

    return {
      type: value.includes("assessment")
        ? "create_assessment"
        : "generate_questions",
      role,
      topic,
      difficulty,
      count,
    };
  }

  return {
    type: "unknown",
  };
}
