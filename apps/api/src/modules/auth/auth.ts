import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

type AuthPort = {
  createOwner(input: {
    email: string;
    passwordHash: string;
    workshopName: string;
  }): Promise<{ userId: string; workshopId: string; role: "owner" }>;
  createCashier(input: {
    email: string;
    passwordHash: string;
    workshopId: string;
    ownerId: string;
  }): Promise<{ userId: string; workshopId: string; role: "cashier" }>;
  findUserByEmail(email: string): Promise<{ id: string; passwordHash: string } | null>;
  createSession(userId: string): Promise<{ token: string; expiresAt: Date }>;
  revokeSession(userId: string, token: string): Promise<void>;
  rotateSession(userId: string, token: string): Promise<{ token: string; expiresAt: Date }>;
  revokeAllSessions(userId: string): Promise<void>;
  listCashiers(input: { workshopId: string; ownerId: string }): Promise<Array<{ userId: string; email: string; active: boolean }>>;
  setCashierActive(input: { workshopId: string; ownerId: string; userId: string; active: boolean }): Promise<{ userId: string; email: string; active: boolean } | null>;
};

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("A valid email is required");
  }
  return normalized;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, 64) as Buffer).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }
  const candidate = Buffer.from((await deriveKey(password, salt, 64) as Buffer).toString("hex"), "hex");
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function registerOwner(
  input: { email: string; password: string; workshopName: string },
  port: AuthPort,
) {
  const email = normalizeEmail(input.email);
  if (input.password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }
  const workshopName = input.workshopName.trim();
  if (!workshopName) {
    throw new Error("Workshop name is required");
  }

  return port.createOwner({ email, passwordHash: await hashPassword(input.password), workshopName });
}

export async function registerCashier(
  input: { email: string; password: string; workshopId: string },
  actor: { userId: string; role: "owner" | "cashier" },
  port: AuthPort,
) {
  if (actor.role !== "owner") {
    throw new Error("Only an owner can add a cashier");
  }
  const email = normalizeEmail(input.email);
  if (input.password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }
  return port.createCashier({
    email,
    passwordHash: await hashPassword(input.password),
    workshopId: input.workshopId,
    ownerId: actor.userId,
  });
}

export async function login(input: { email: string; password: string }, port: AuthPort) {
  const user = await port.findUserByEmail(normalizeEmail(input.email));
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error("Invalid email or password");
  }
  return { userId: user.id, ...(await port.createSession(user.id)) };
}

export async function logout(userId: string, token: string, port: AuthPort) {
  await port.revokeSession(userId, token);
}

export async function refreshSession(userId: string, token: string, port: AuthPort) {
  return port.rotateSession(userId, token);
}

export async function logoutAll(userId: string, port: AuthPort) {
  await port.revokeAllSessions(userId);
}

export async function listCashiers(
  workshopId: string,
  actor: { userId: string; role: "owner" | "cashier" },
  port: AuthPort,
) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage cashiers");
  return port.listCashiers({ workshopId, ownerId: actor.userId });
}

export async function setCashierActive(
  input: { workshopId: string; userId: string; active: boolean },
  actor: { userId: string; role: "owner" | "cashier" },
  port: AuthPort,
) {
  if (actor.role !== "owner") throw new Error("Only an owner can manage cashiers");
  return port.setCashierActive({ ...input, ownerId: actor.userId });
}
