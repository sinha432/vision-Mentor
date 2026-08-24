// Account creation / sign-in, stored locally and synced to MongoDB when available.
import { z } from "zod";
import { findUserByEmail, hashPassword, insertUser, verifyPassword } from "./local-db";
import { fetchUserFromMongoDB, syncUserToMongoDB } from "./mongodb-sync";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password needs at least one letter")
    .regex(/\d/, "Password needs at least one number"),
  role: z.enum(["individual", "company"]).default("individual"),
  dob: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

function parseOrFriendly<T>(schema: { safeParse: (d: unknown) => any }, data: unknown): T {
  const res = schema.safeParse(data);
  if (res.success) return res.data as T;
  const first = res.error?.issues?.[0]?.message;
  throw new Error(first || "Please check the details you entered");
}

export async function createDemoUser({ data }: { data: unknown }) {
  const input = parseOrFriendly<z.infer<typeof signUpSchema>>(signUpSchema, data);
  const rec = insertUser({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    dob: input.dob ?? null,
    country: input.country ?? null,
  });

  await syncUserToMongoDB(rec).catch((error) => {
    console.warn("User sync to MongoDB failed:", error);
  });

  return { id: rec._id, email: rec.email, name: rec.name, role: rec.role };
}

export async function verifyDemoUser({ data }: { data: unknown }) {
  const input = parseOrFriendly<z.infer<typeof signInSchema>>(signInSchema, data);

  const remoteUser = await fetchUserFromMongoDB(input.email).catch(() => null);
  const rec = remoteUser ?? findUserByEmail(input.email);

  if (!rec) return null;
  if (!(await verifyPassword(input.password, rec.passwordHash))) return null;
  return { id: rec._id, email: rec.email, name: rec.name, role: rec.role };
}
