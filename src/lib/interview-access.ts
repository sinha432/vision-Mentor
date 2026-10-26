export interface InterviewOwner {
  id: string;
  email: string;
}

export interface InterviewOwnerRecord {
  userId?: string;
  email?: string;
}

export function interviewRecordFilter(sessionId: string, owner: InterviewOwner) {
  return {
    sessionId,
    ...interviewOwnerFilter(owner),
  };
}

export function interviewOwnerFilter(owner: InterviewOwner) {
  return {
    $or: [{ userId: owner.id }, { userId: { $exists: false }, email: owner.email }],
  };
}

export function isInterviewOwnedBy(record: InterviewOwnerRecord, owner: InterviewOwner) {
  return (
    record.userId === owner.id || (record.userId === undefined && record.email === owner.email)
  );
}
