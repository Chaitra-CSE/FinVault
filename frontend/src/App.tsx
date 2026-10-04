import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Login } from "./pages/Login";
import { Documents } from "./pages/Documents";
import { DocumentDetail } from "./pages/DocumentDetail";
import { Audit } from "./pages/Audit";
import { useAuthStore } from "./store/auth";

const qc = new QueryClient();

function Shell({ children }: { children: React.ReactNode }) {
    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);
    const nav = useNavigate();
    if (!user) return <Navigate to="/login" replace />;
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <nav className="border-b border-slate-800 bg-slate-900">
                <div className="max-w-6xl mx-auto flex items-center gap-6 px-6 py-3">
                    <Link to="/" className="font-semibold">FinVault</Link>
                    <Link to="/" className="text-sm text-slate-300 hover:text-white">Documents</Link>
                    {(user.role === "AUDITOR" || user.role === "ADMIN") && (
                        <Link to="/audit" className="text-sm text-slate-300 hover:text-white">Audit</Link>
                    )}
                    <div className="ml-auto text-sm text-slate-400">{user.name} · {user.role}</div>
                    <button onClick={() => { logout(); nav("/login"); }} className="text-sm text-slate-400 hover:text-white">Sign out</button>
                </div>
            </nav>
            <main className="max-w-6xl mx-auto p-6">{children}</main>
        </div>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={qc}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<Shell><Documents /></Shell>} />
                    <Route path="/documents/:id" element={<Shell><DocumentDetail /></Shell>} />
                    <Route path="/audit" element={<Shell><Audit /></Shell>} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}