import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useState } from "react";

type Doc = { id: string; title: string; category: string; status: string; classification: string; updatedAt: string };

export function Documents() {
    const qc = useQueryClient();
    const { data: docs = [], isLoading } = useQuery<Doc[]>({
        queryKey: ["docs"],
        queryFn: () => apiFetch<Doc[]>("/api/documents"),
    });

    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("invoice");
    const [classification, setClassification] = useState("internal");

    const create = useMutation({
        mutationFn: () => apiFetch("/api/documents", {
            method: "POST",
            body: JSON.stringify({ title, category, classification }),
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs"] }); setTitle(""); },
    });

    return (
        <div className="space-y-6">
            <div className="flex items-end gap-3 bg-slate-900 p-4 rounded-lg border border-slate-800">
                <input className="flex-1 bg-slate-800 rounded px-3 py-2" placeholder="New document title" value={title} onChange={e => setTitle(e.target.value)} />
                <select className="bg-slate-800 rounded px-3 py-2" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="invoice">Invoice</option><option value="contract">Contract</option>
                    <option value="report">Report</option><option value="statement">Statement</option>
                </select>
                <select className="bg-slate-800 rounded px-3 py-2" value={classification} onChange={e => setClassification(e.target.value)}>
                    <option value="public">Public</option><option value="internal">Internal</option>
                    <option value="confidential">Confidential</option><option value="restricted">Restricted</option>
                </select>
                <button disabled={!title || create.isPending} onClick={() => create.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded px-4 py-2">Create</button>
            </div>

            {isLoading ? <div className="text-slate-400">Loading…</div> : (
                <div className="grid gap-3">
                    {docs.map(d => (
                        <Link key={d.id} to={`/documents/${d.id}`}
                            className="block bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-4">
                            <div className="flex justify-between">
                                <div>
                                    <div className="font-medium">{d.title}</div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {d.category} · {d.classification}
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 h-fit rounded ${d.status === "APPROVED" ? "bg-emerald-900 text-emerald-300" :
                                        d.status === "REJECTED" ? "bg-red-900 text-red-300" :
                                            d.status === "IN_REVIEW" ? "bg-amber-900 text-amber-300" :
                                                "bg-slate-800 text-slate-300"
                                    }`}>{d.status}</span>
                            </div>
                        </Link>
                    ))}
                    {docs.length === 0 && <div className="text-slate-500">No documents yet.</div>}
                </div>
            )}
        </div>
    );
}