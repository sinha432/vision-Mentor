export interface ScheduleCalendarDetails {
  candidateName: string;
  candidateEmail: string;
  role: string;
  date: string;
  time: string;
  duration: string;
  notes?: string;
  timeZone: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function calendarDateTime(date: string, time: string, additionalMinutes = 0): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);

  if (!dateMatch || !timeMatch) {
    throw new Error("Invalid interview date or time");
  }

  const value = new Date(
    Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch[1]),
      Number(timeMatch[2]) + additionalMinutes,
    ),
  );

  return (
    [value.getUTCFullYear(), pad(value.getUTCMonth() + 1), pad(value.getUTCDate())].join("") +
    "T" +
    [pad(value.getUTCHours()), pad(value.getUTCMinutes()), "00"].join("")
  );
}

export function createGoogleCalendarUrl(details: ScheduleCalendarDetails): string {
  const durationMinutes = Number(details.duration);

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Invalid interview duration");
  }

  const title = `Interview: ${details.role}`;
  const description = [
    `Candidate: ${details.candidateName}`,
    `Candidate email: ${details.candidateEmail}`,
    details.notes?.trim() ? `Notes: ${details.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${calendarDateTime(details.date, details.time)}/${calendarDateTime(details.date, details.time, durationMinutes)}`,
    details: description,
    ctz: details.timeZone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
