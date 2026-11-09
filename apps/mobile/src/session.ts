import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { ApiError, apiRequest, type Role, type Session } from "./api";

const KEY = "session";

type SessionState = {
  session: Session | null;
  loaded: boolean;
  load: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// shortcut: the API has no endpoint that returns the user's workshop or role. The workshop comes from
// EXPO_PUBLIC_DEV_WORKSHOP_ID and the role is probed via the owner-only /dashboard; replace both once GET /me exists.
async function resolveMembership(token: string, expiresAt: string): Promise<Session> {
  const workshopId = process.env.EXPO_PUBLIC_DEV_WORKSHOP_ID;
  if (!workshopId) throw new ApiError("EXPO_PUBLIC_DEV_WORKSHOP_ID belum diisi di apps/mobile/.env.", 0);
  const probe: Session = { token, expiresAt, workshopId, role: "owner" };
  try {
    await apiRequest(probe, "/dashboard");
    return probe;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return { ...probe, role: "cashier" as Role };
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError("Akun ini tidak terdaftar atau tidak aktif di bengkel ini.", 401);
    }
    throw error;
  }
}

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  loaded: false,
  load: async () => {
    const stored = await SecureStore.getItemAsync(KEY).catch(() => null);
    const session = stored ? (JSON.parse(stored) as Session) : null;
    const valid = session && Date.parse(session.expiresAt) > Date.now() ? session : null;
    set({ session: valid, loaded: true });
  },
  signIn: async (email, password) => {
    const { token, expiresAt } = await apiRequest<{ token: string; expiresAt: string }>(null, "/auth/login", {
      method: "POST",
      body: { email, password },
    });
    const session = await resolveMembership(token, expiresAt);
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    set({ session });
  },
  signOut: async () => {
    const { session } = get();
    set({ session: null });
    await SecureStore.deleteItemAsync(KEY);
    // Best effort: the local session is gone even if the server cannot be reached.
    if (session) await apiRequest(session, "/auth/logout", { method: "POST" }).catch(() => undefined);
  },
}));
