import {
  pbkdf2 as pbkdf2Callback,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const pbkdf2 = promisify(pbkdf2Callback);

const KEY_LENGTH = 64;
const LEGACY_KEY_LENGTH = 32;
const LEGACY_PBKDF2_ITERATIONS = 120_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, keyHex] = storedHash.split(":");

    if (!salt || !/^[0-9a-f]+$/i.test(salt) || !keyHex || !/^[0-9a-f]+$/i.test(keyHex)) {
      return false;
    }

    const storedKey = Buffer.from(keyHex, "hex");
    let derivedKey: Buffer;

    if (storedKey.length === KEY_LENGTH) {
      derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    } else if (storedKey.length === LEGACY_KEY_LENGTH) {
      derivedKey = (await pbkdf2(
        password,
        Buffer.from(salt, "hex"),
        LEGACY_PBKDF2_ITERATIONS,
        LEGACY_KEY_LENGTH,
        "sha256",
      )) as Buffer;
    } else {
      return false;
    }

    if (storedKey.length !== derivedKey.length) return false;

    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}
