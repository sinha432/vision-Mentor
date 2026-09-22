/**
 * MongoDB connection and utilities for server-side persistence.
 * Used to store user interviews, assessments, and session data.
 */

import {
  MongoClient,
  type Db,
  type Collection,
  type Document,
  ObjectId,
} from "mongodb";
import { loadDotEnv } from "@/lib/server-env";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

loadDotEnv();

const MONGO_URI = process.env.MONGODB_URI;

async function connectToDatabase(): Promise<Db> {
  if (cachedDb) return cachedDb;

  if (!MONGO_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  try {
    cachedClient = new MongoClient(MONGO_URI);

    await cachedClient.connect();

    cachedDb = cachedClient.db("vision_mentor");

    console.log("✓ Connected to MongoDB");

    return cachedDb;
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error);

    throw new Error("Failed to connect to MongoDB");
  }
}

export async function getDatabase(): Promise<Db> {
  return connectToDatabase();
}

export async function closeDatabase() {
  if (cachedClient) {
    await cachedClient.close();

    cachedClient = null;
    cachedDb = null;
  }
}

// ============================================================
// Collection types and interfaces
// ============================================================

export interface StoredUser {
  _id?: ObjectId | string;
  email: string;
  role: "individual" | "company";
  name: string;
  passwordHash: string;
  dob: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredInterview {
  _id?: ObjectId | string;

  userId: string;
  email: string;
  sessionId: string;

  assessmentCode?: string;

  config: {
    companyName?: string;
    role?: string;
    level?: string;
  };

  phases: string[];

  turns: Array<{
    questionId?: string | null;
    question?: string | null;
    answer?: string | null;
    code?: string | null;
    language?: string | null;
    score?: number | null;
  }>;

  startedAt: string;
  completedAt?: string;

  status: "in_progress" | "completed" | "abandoned";

  recording?: {
    blob?: string;
    duration?: number;
  };

  createdAt: string;
  updatedAt: string;
}

export interface StoredAssessment {
  _id?: ObjectId | string;

  companyUserId: string;
  title: string;
  code: string;
  description?: string;
  requireMedia?: boolean;
  timeLimitSeconds?: number;

  status: "active" | "archived";

  questions: Array<{
    id: string;
    type: "text" | "mcq" | "code";
    text: string;
    weight: number;

    keywords?: string[];
    maxLength?: number | null;

    choices?: Array<{
      id: string;
      text: string;
    }>;

    correctChoiceId?: string;
    starterCode?: string;

    testCases?: Array<{
      input: string;
      expectedStdout: string;
    }>;
  }>;

  createdAt: string;
  updatedAt: string;
}

export interface StoredUserProfile {
  _id?: ObjectId | string;

  email: string;
  userId?: string;

  bio?: string;
  avatar?: string;
  phone?: string;

  skills?: string[];

  experience?: Array<{
    title: string;
    company: string;
    duration: string;
    description?: string;
  }>;

  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    year?: string;
  }>;

  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };

  preferences?: {
    notifications?: boolean;
    assessmentDefaults?: {
      requireMedia?: boolean;
      questionWeight?: number;
    };
    notificationPreferences?: {
      scheduleEmails?: boolean;
      browserReminders?: boolean;
      assessmentSubmissions?: boolean;
    };
    publicProfile?: boolean;
    language?: string;
  };

  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Collection helper
// ============================================================

export async function getCollection<
  T extends Document = Document,
>(name: string): Promise<Collection<T>> {
  const db = await getDatabase();

  const collection = db.collection<T>(name);

  // Ensure indexes are created for common queries.
  if (name === "interviews") {
    await collection.createIndex({
      userId: 1,
      createdAt: -1,
    });

    await collection.createIndex({
      email: 1,
      createdAt: -1,
    });

    await collection.createIndex(
      { sessionId: 1 },
      { unique: true },
    );
  } else if (name === "assessments") {
    await collection.createIndex(
      { code: 1 },
      { unique: true },
    );

    await collection.createIndex({
      companyUserId: 1,
    });

    await collection.createIndex({
      status: 1,
    });
  } else if (name === "users") {
    await collection.createIndex(
      { email: 1 },
      { unique: true },
    );
  } else if (name === "user_profiles") {
    await collection.createIndex(
      { email: 1 },
      { unique: true },
    );

    await collection.createIndex({
      userId: 1,
    });
  }

  return collection;
}

// ============================================================
// User operations
// ============================================================

export async function saveUser(
  user: StoredUser,
): Promise<StoredUser> {
  const collection =
    await getCollection<StoredUser>("users");

  const now = new Date().toISOString();

  const doc = {
    ...user,
    updatedAt: now,
    createdAt: user.createdAt || now,
  };

  await collection.updateOne(
    { email: doc.email },
    { $set: doc },
    { upsert: true },
  );

  return doc;
}

export async function getUser(
  email: string,
): Promise<StoredUser | null> {
  const collection =
    await getCollection<StoredUser>("users");

  return collection.findOne({ email });
}

// ============================================================
// Interview operations
// ============================================================

export async function saveInterview(
  interview: StoredInterview,
): Promise<StoredInterview> {
  const collection =
    await getCollection<StoredInterview>("interviews");

  const now = new Date().toISOString();

  const doc = {
    ...interview,
    updatedAt: now,
    createdAt: interview.createdAt || now,
  };

  await collection.updateOne(
    { sessionId: doc.sessionId },
    { $set: doc },
    { upsert: true },
  );

  return doc;
}

export async function getInterview(
  sessionId: string,
): Promise<StoredInterview | null> {
  const collection =
    await getCollection<StoredInterview>("interviews");

  return collection.findOne({ sessionId });
}

export async function getUserInterviews(
  email: string,
): Promise<StoredInterview[]> {
  const collection =
    await getCollection<StoredInterview>("interviews");

  return collection
    .find({ email })
    .sort({ createdAt: -1 })
    .toArray();
}

// ============================================================
// Assessment operations
// ============================================================

export async function saveAssessment(
  assessment: StoredAssessment,
): Promise<StoredAssessment> {
  const collection =
    await getCollection<StoredAssessment>("assessments");

  const now = new Date().toISOString();

  const doc = {
    ...assessment,
    updatedAt: now,
    createdAt: assessment.createdAt || now,
  };

  await collection.updateOne(
    { code: doc.code },
    { $set: doc },
    { upsert: true },
  );

  return doc;
}

export async function getAssessment(
  code: string,
): Promise<StoredAssessment | null> {
  const collection =
    await getCollection<StoredAssessment>("assessments");

  return collection.findOne({ code });
}

export async function getCompanyAssessments(
  companyUserId: string,
): Promise<StoredAssessment[]> {
  const collection =
    await getCollection<StoredAssessment>("assessments");

  return collection
    .find({ companyUserId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function deleteAssessment(
  code: string,
  companyUserId: string,
): Promise<boolean> {
  const collection = await getCollection<StoredAssessment>("assessments");
  const result = await collection.deleteOne({ code, companyUserId });
  return result.deletedCount > 0;
}

export async function deleteCandidateData(
  individualUserId: string,
  companyUserId: string,
): Promise<{ attempts: number; reports: number }> {
  const assessments = await getCollection<StoredAssessment>("assessments");
  const ownedAssessments = await assessments
    .find({ companyUserId })
    .project({ _id: 1, code: 1 })
    .toArray();
  const assessmentKeys = ownedAssessments.flatMap((assessment) => [
    String(assessment._id),
    assessment.code,
  ]);

  if (!assessmentKeys.length) return { attempts: 0, reports: 0 };

  const attempts = await getCollection<any>("attempts");
  const reports = await getCollection<any>("reports");
  const candidateAttempts = await attempts
    .find({
      individualUserId,
      assessmentId: { $in: assessmentKeys },
    })
    .project({ _id: 1 })
    .toArray();
  const attemptIds = candidateAttempts.map((attempt) => String(attempt._id));

  const reportResult = attemptIds.length
    ? await reports.deleteMany({ attemptId: { $in: attemptIds } })
    : { deletedCount: 0 };
  const attemptResult = await attempts.deleteMany({
    individualUserId,
    assessmentId: { $in: assessmentKeys },
  });

  return {
    attempts: attemptResult.deletedCount,
    reports: reportResult.deletedCount,
  };
}

export async function saveAssessmentSubmission(
  attempt: Document,
  report: Document,
): Promise<void> {
  const attempts = await getCollection("attempts");
  const reports = await getCollection("reports");

  await attempts.updateOne(
    { _id: attempt._id },
    { $set: attempt },
    { upsert: true },
  );
  await reports.updateOne(
    { _id: report._id },
    { $set: report },
    { upsert: true },
  );
}

export async function deleteIndividualReports(
  individualUserId: string,
  attemptIds: string[],
): Promise<{ attempts: number; reports: number }> {
  const attempts = await getCollection<any>("attempts");
  const reports = await getCollection<any>("reports");
  const ownedAttempts = await attempts
    .find({ individualUserId, _id: { $in: attemptIds } })
    .project({ _id: 1 })
    .toArray();
  const ownedIds = ownedAttempts.map((attempt) => attempt._id);

  if (!ownedIds.length) return { attempts: 0, reports: 0 };

  const reportResult = await reports.deleteMany({ attemptId: { $in: ownedIds } });
  const attemptResult = await attempts.deleteMany({
    individualUserId,
    _id: { $in: ownedIds },
  });

  return {
    attempts: attemptResult.deletedCount,
    reports: reportResult.deletedCount,
  };
}

// ============================================================
// User Profile operations
// ============================================================

export async function saveUserProfile(
  profile: StoredUserProfile,
): Promise<StoredUserProfile> {
  const collection =
    await getCollection<StoredUserProfile>("user_profiles");

  const now = new Date().toISOString();

  const doc = {
    ...profile,
    updatedAt: now,
    createdAt: profile.createdAt || now,
  };

  await collection.updateOne(
    { email: doc.email },
    { $set: doc },
    { upsert: true },
  );

  return doc;
}

export async function getUserProfile(
  email: string,
): Promise<StoredUserProfile | null> {
  const collection =
    await getCollection<StoredUserProfile>("user_profiles");

  return collection.findOne({ email });
}

export async function getUserProfileById(
  userId: string,
): Promise<StoredUserProfile | null> {
  const collection =
    await getCollection<StoredUserProfile>("user_profiles");

  return collection.findOne({ userId });
}

export async function updateUserProfile(
  email: string,
  updates: Partial<StoredUserProfile>,
): Promise<StoredUserProfile | null> {
  const collection =
    await getCollection<StoredUserProfile>("user_profiles");

  const now = new Date().toISOString();

  const result = await collection.findOneAndUpdate(
    { email },
    {
      $set: {
        ...updates,
        updatedAt: now,
      },
    },
    {
      returnDocument: "after",
    },
  );

  return result ?? null;
}

export async function deleteUserProfile(
  email: string,
): Promise<boolean> {
  const collection =
    await getCollection<StoredUserProfile>("user_profiles");

  const result = await collection.deleteOne({ email });

  return result.deletedCount > 0;
}