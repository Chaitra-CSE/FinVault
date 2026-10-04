import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useRef, useState } from "react";

export function DocumentDetail() {
    const { id = "" } = useParams();
    const qc = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [comment, setComment] = useState("");

    const { data: doc } = useQuery<any>({
        queryKey: ["doc", id],
        queryFn: () => apiFetch(`/api/documents/${id}`),
    });

    const upload = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("comment", comment);
            return apiFetch(`/api/documents/${id}/versions`, { method: "POST", body: fd });
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["doc", id] }),
    });

    const download = async (versionId?: string) => {
        const q = versionId ? `?versionId=${versionId}` : "";
        const { url } = await apiFetch<{ url: string }>(`/api/documents/${id}/download${q}`);
        window.location.href = url;
    };

    const startWf = useMutation({
        mutationFn: (templateId: string) =>
            apiFetch("/api/workflows", { method: "POST", body: JSON.stringify({ documentId: id, templateId }) }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["doc", id] }),
    });

    const { data: templates = [] } = useQuery<any[]>({
        queryKey: ["wf-templates"],
        queryFn: () => apiFetch("/api/workflows/templates"),
    });

    if (!doc) return <div className="text-slate-400">Loading…</div>;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">{doc.title}</h1>
                <div className="text-sm text-slate-400 mt-1">
                    {doc.category} · {doc.classification} · owned by {doc.owner?.name} · <span>{doc.status}</span>
                </div>
            </header>

            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                <h2 className="font-medium">Upload new version</h2>
                <div className="flex gap-3">
                    <input ref={fileRef} type="file" className="flex-1 bg-slate-800 rounded p-2" />
                    <input className="flex-1 bg-slate-800 rounded px-3" placeholder="Version comment" value={comment} onChange={e => setComment(e.target.value)} />
                    <button className="bg-indigo-600 hover:bg-indigo-500 rounded px-4"
                        onClick={() => fileRef.current?.files?.[0] && upload.mutate(fileRef.current.files[0])}>
                        Upload
                    </button>
                </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <h2 className="font-medium mb-3">Versions</h2>
                <table className="w-full text-sm">
                    <thead className="text-slate-400 text-left">
                        <tr><th className="py-1">#</th><th>File</th><th>Size</th><th>SHA-256</th><th>Uploaded</th><th></th></tr>
                    </thead>
                    <tbody>
                        {doc.versions.map((v: any) => (
                            <tr key={v.id} className="border-t border-slate-800">
                                <td className="py-2">v{v.version}</td>
                                <td>{v.filename}</td>
                                <td>{(v.sizeBytes / 1024).toFixed(1)} KB</td>
                                <td className="font-mono text-xs">{v.sha256.slice(0, 12)}…</td>
                                <td>{new Date(v.createdAt).toLocaleString()}</td>
                                <td><button className="text-indigo-400 hover:underline" onClick={() => download(v.id)}>Download</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <h2 className="font-medium mb-3">Workflow</h2>
                {doc.workflows.length === 0 ? (
                    <div className="flex gap-3">
                        <select id="tpl" className="bg-slate-800 rounded px-3 py-2">
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button className="bg-indigo-600 hover:bg-indigo-500 rounded px-4"
                            onClick={() => startWf.mutate((document.getElementById("tpl") as HTMLSelectElement).value)}>
                            Start workflow
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {doc.workflows.map((wf: any) => (
                            <div key={wf.id} className="border border-slate-800 rounded p-3">
                                <div className="flex justify-between">
                                    <div className="font-medium">Workflow {wf.status}</div>
                                </div>
                                <ol className="mt-2 space-y-1 text-sm">
                                    {wf.steps.map((s: any) => (
                                        <li key={s.id} className="flex justify-between">
                                            <span>{s.order}. {s.name} <span className="text-slate-500">({s.role})</span></span>
                                            <span className={s.decision === "APPROVED" ? "text-emerald-400" : s.decision === "REJECTED" ? "text-red-400" : "text-slate-400"}>
                                                {s.decision}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                                <WorkflowActions workflowId={wf.id} disabled={wf.status !== "PENDING"} onDone={() => qc.invalidateQueries({ queryKey: ["doc", id] })} />
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function WorkflowActions({ workflowId, disabled, onDone }: { workflowId: string; disabled: boolean; onDone: () => void }) {
    const [comment, setComment] = useState("");
    const decide = async (decision: "APPROVED" | "REJECTED") => {
        await apiFetch(`/api/workflows/${workflowId}/decide`, {
            method: "POST", body: JSON.stringify({ decision, comment }),
        });
        onDone();
    };
    return (
        <div className="mt-3 flex gap-2">
            <input className="flex-1 bg-slate-800 rounded px-3 py-1 text-sm" placeholder="Comment" value={comment} onChange={e => setComment(e.target.value)} disabled={disabled} />
            <button disabled={disabled} onClick={() => decide("APPROVED")} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded px-3 py-1 text-sm">Approve</button>
            <button disabled={disabled} onClick={() => decide("REJECTED")} className="bg-red-700 hover:bg-red-600 disabled:opacity-40 rounded px-3 py-1 text-sm">Reject</button>
        </div>
    );
}