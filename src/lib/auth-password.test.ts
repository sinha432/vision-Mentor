import { pbkdf2Sync } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./auth-password.ts";

test("verifies passwords hashed with the current scrypt algorithm", async () => {
  const hash = await hashPassword("correct horse battery staple");

  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("incorrect password", hash), false);
});

test("verifies existing PBKDF2 password hashes", async () => {
  const password = "legacy-password-123";
  const salt = "0123456789abcdef0123456789abcdef";
  const hash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 120_000, 32, "sha256");

  assert.equal(await verifyPassword(password, `${salt}:${hash.toString("hex")}`), true);
  assert.equal(
    await verifyPassword("incorrect password", `${salt}:${hash.toString("hex")}`),
    false,
  );
});

test("rejects malformed or unsupported password hashes", async () => {
  assert.equal(await verifyPassword("password", "not-a-hash"), false);
  assert.equal(await verifyPassword("password", "salt:xyz"), false);
  assert.equal(await verifyPassword("password", "salt:abcd"), false);
});
