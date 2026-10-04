import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export function Login() {
    const [email, setEmail] = useState("admin@finvault.local");
    const [password, setPassword] = useState("password123");
    const [error, setError] = useState<string | null>(null);
    const nav = useNavigate();
    const setSession = useAuthStore(s => s.setSession);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const res = await fetch("/api/auth/login", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return setError((await res.json()).error ?? "Login failed");
        const data = await res.json();
        setSession(data);
        nav("/");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
            <form onSubmit={submit} className="w-full max-w-sm bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-4">
                <div className="text-2xl font-semibold">FinVault</div>
                <div className="text-sm text-slate-400">Enterprise Finance Document Repository</div>
                <input className="w-full bg-slate-800 rounded px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                <input className="w-full bg-slate-800 rounded px-3 py-2" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
                {error && <div className="text-red-400 text-sm">{error}</div>}
                <button className="w-full bg-indigo-600 hover:bg-indigo-500 rounded py-2 font-medium">Sign in</button>
            </form>
        </div>
    );
}