import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

interface Actor {
    id: string;
    name: string;
    email: string;
}

interface AuditEvent {
    id: string;
    actorId?: string;
    actor?: Actor | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, any> | null;
    ip?: string | null;
    userAgent?: string | null;
    prevHash?: string | null;
    hash: string;
    createdAt: string;
}

interface VerifyResult {
    ok: boolean;
    brokenAt?: string;
}

export function Audit() {
    const [actionFilter, setActionFilter] = useState<string>("");
    const [targetFilter, setTargetFilter] = useState<string>("");
    const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

    const queryParams = new URLSearchParams();
    if (actionFilter) queryParams.set("action", actionFilter);
    if (targetFilter.trim()) queryParams.set("targetId", targetFilter.trim());

    const {
        data: events = [],
        isLoading,
        refetch,
    } = useQuery<AuditEvent[]>({
        queryKey: ["audit-events", actionFilter, targetFilter],
        queryFn: () => apiFetch<AuditEvent[]>(`/api/audit?${queryParams.toString()}`),
    });

    const {
        data: verifyResult,
        refetch: verifyChain,
        isFetching: isVerifying,
    } = useQuery<VerifyResult>({
        queryKey: ["audit-verify"],
        queryFn: () => apiFetch<VerifyResult>("/api/audit/verify"),
        enabled: false,
    });

    const getActionBadgeClass = (action: string) => {
        if (action.includes("fail") || action.includes("reject") || action.includes("delete")) {
            return "bg-red-900/60 text-red-300 border-red-700/50";
        }
        if (action.includes("approve") || action.includes("register")) {
            return "bg-emerald-900/60 text-emerald-300 border-emerald-700/50";
        }
        if (action.includes("upload") || action.includes("create")) {
            return "bg-blue-900/60 text-blue-300 border-blue-700/50";
        }
        if (action.includes("login") || action.includes("auth")) {
            return "bg-purple-900/60 text-purple-300 border-purple-700/50";
        }
        return "bg-slate-800 text-slate-300 border-slate-700";
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Audit Trail & Chain Verification</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Cryptographically linked, tamper-evident audit ledger verifying every action in FinVault.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => verifyChain()}
                        disabled={isVerifying}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition"
                    >
                        <span>{isVerifying ? "Verifying Chain…" : "Verify Cryptographic Chain"}</span>
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg transition text-sm"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {verifyResult && (
                <div
                    className={`p-4 rounded-lg border text-sm flex items-start gap-3 transition ${
                        verifyResult.ok
                            ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200"
                            : "bg-red-950/40 border-red-700/60 text-red-200"
                    }`}
                >
                    <div className="font-semibold text-base mt-0.5">
                        {verifyResult.ok ? "PASS" : "FAIL"}
                    </div>
                    <div>
                        <div className="font-semibold">
                            {verifyResult.ok
                                ? "Audit Log Cryptographic Integrity Verified"
                                : "Tampering Detected: Audit Chain Integrity Broken"}
                        </div>
                        <div className="text-xs mt-0.5 opacity-90">
                            {verifyResult.ok
                                ? "All sequential SHA-256 block hashes are intact and verified from genesis to current head."
                                : `Chain validation failed at event record ID: ${verifyResult.brokenAt}. Hash recalculation mismatch.`}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-4 rounded-lg border border-slate-800">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-slate-400 mb-1">Filter by Action</label>
                    <select
                        className="w-full bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                    >
                        <option value="">All Actions</option>
                        <option value="auth.login">auth.login</option>
                        <option value="auth.login.fail">auth.login.fail</option>
                        <option value="auth.register">auth.register</option>
                        <option value="doc.create">doc.create</option>
                        <option value="doc.version.upload">doc.version.upload</option>
                        <option value="doc.download">doc.download</option>
                        <option value="doc.delete">doc.delete</option>
                        <option value="doc.version.delete">doc.version.delete</option>
                        <option value="wf.start">wf.start</option>
                        <option value="wf.approved">wf.approved</option>
                        <option value="wf.rejected">wf.rejected</option>
                        <option value="admin.user.role">admin.user.role</option>
                        <option value="admin.user.active">admin.user.active</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-slate-400 mb-1">Target ID / Resource</label>
                    <input
                        className="w-full bg-slate-800 text-sm border border-slate-700 rounded-md px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="e.g. document ID or user ID"
                        value={targetFilter}
                        onChange={(e) => setTargetFilter(e.target.value)}
                    />
                </div>
                { (actionFilter || targetFilter) && (
                    <button
                        onClick={() => { setActionFilter(""); setTargetFilter(""); }}
                        className="mt-5 text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Target</th>
                                <th className="px-4 py-3">Actor</th>
                                <th className="px-4 py-3">IP / Client</th>
                                <th className="px-4 py-3">Hash (SHA-256)</th>
                                <th className="px-4 py-3 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        Loading audit trail…
                                    </td>
                                </tr>
                            ) : events.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                        No audit records found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                events.map((ev) => (
                                    <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                                            {new Date(ev.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span
                                                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getActionBadgeClass(
                                                    ev.action
                                                )}`}
                                            >
                                                {ev.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <span className="text-slate-400">{ev.targetType}: </span>
                                            <span className="font-mono text-slate-300">{ev.targetId.slice(0, 16)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                                            {ev.actor ? (
                                                <div>
                                                    <div className="text-slate-200 font-medium">{ev.actor.name}</div>
                                                    <div className="text-slate-500 text-[11px]">{ev.actor.email}</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 italic">System / Anonymous</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                            {ev.ip || "—"}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                            <span title={ev.hash} className="cursor-help">
                                                {ev.hash.slice(0, 10)}…{ev.hash.slice(-6)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => setSelectedEvent(ev)}
                                                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedEvent && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-semibold text-lg text-slate-100">Audit Record Detail</h3>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="text-slate-400 hover:text-slate-200 text-lg"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                                <div>
                                    <span className="text-slate-500 block">Event ID:</span>
                                    <span className="font-mono text-slate-300">{selectedEvent.id}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Action:</span>
                                    <span className="text-slate-200 font-medium">{selectedEvent.action}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Target:</span>
                                    <span className="text-slate-300">{selectedEvent.targetType} ({selectedEvent.targetId})</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Timestamp:</span>
                                    <span className="text-slate-300">{new Date(selectedEvent.createdAt).toISOString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Actor:</span>
                                    <span className="text-slate-300">
                                        {selectedEvent.actor ? `${selectedEvent.actor.name} (${selectedEvent.actor.email})` : "System / Anonymous"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Client IP:</span>
                                    <span className="text-slate-300">{selectedEvent.ip || "—"}</span>
                                </div>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                                <div>
                                    <span className="text-slate-500 block">Current Record Hash:</span>
                                    <span className="font-mono text-[11px] text-emerald-400 break-all">{selectedEvent.hash}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Previous Linked Hash:</span>
                                    <span className="font-mono text-[11px] text-slate-400 break-all">{selectedEvent.prevHash || "(Genesis Block - None)"}</span>
                                </div>
                            </div>

                            <div>
                                <span className="text-slate-400 font-medium block mb-1">Payload / Metadata:</span>
                                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                                    {JSON.stringify(selectedEvent.metadata, null, 2) || "{}"}
                                </pre>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
