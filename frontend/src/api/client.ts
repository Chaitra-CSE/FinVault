import { useAuthStore } from "../store/auth";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { access, refresh, setAccess, logout } = useAuthStore.getState();
    const headers = new Headers(init.headers);
    if (access) headers.set("Authorization", `Bearer ${access}`);
    if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

    let res = await fetch(path, { ...init, headers });
    if (res.status === 401 && refresh) {
        const r = await fetch("/api/auth/refresh", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
        });
        if (r.ok) {
            const { access: newAccess } = await r.json();
            setAccess(newAccess);
            headers.set("Authorization", `Bearer ${newAccess}`);
            res = await fetch(path, { ...init, headers });
        } else {
            logout();
            throw new Error("Session expired");
        }
    }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
    return res.json();
}