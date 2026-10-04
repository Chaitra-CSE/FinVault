import { create } from "zustand";
import { persist } from "zustand/middleware";

type User = { id: string; email: string; name: string; role: string };
type State = {
    access: string | null; refresh: string | null; user: User | null;
    setSession: (s: { access: string; refresh: string; user: User }) => void;
    setAccess: (a: string) => void;
    logout: () => void;
};

export const useAuthStore = create<State>()(persist((set) => ({
    access: null, refresh: null, user: null,
    setSession: (s) => set({ access: s.access, refresh: s.refresh, user: s.user }),
    setAccess: (a) => set({ access: a }),
    logout: () => set({ access: null, refresh: null, user: null }),
}), { name: "finvault-auth" }));