"use client";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/navbar";

type Doc = { id: string; title: string; content: string; pinned: boolean };

export default function KnowledgePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  // editing:null = 收起;{id:""} = 新增;{id} = 编辑某篇
  const [editing, setEditing] = useState<Doc | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/knowledge");
      const d = await r.json();
      setDocs(d.docs ?? []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditing({ id: "", title: "", content: "", pinned: false });
    setTitle("");
    setContent("");
    setPinned(false);
    setError("");
  }

  function startEdit(d: Doc) {
    setEditing(d);
    setTitle(d.title);
    setContent(d.content);
    setPinned(d.pinned);
    setError("");
  }

  function cancel() {
    setEditing(null);
    setError("");
  }

  async function save() {
    if (!title.trim()) {
      setError("标题必填");
      return;
    }
    if (editing?.pinned && !pinned) {
      setError("「核心背景」不能直接取消,先在另一篇文档上勾选『作为核心背景』");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    const isNew = !editing?.id;
    const res = await fetch(isNew ? "/api/knowledge" : `/api/knowledge/${editing!.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, pinned }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "保存失败");
      return;
    }
    setSaved(true);
    setEditing(null);
    await load();
  }

  async function remove(d: Doc) {
    if (d.pinned) {
      alert("「核心背景」不能直接删除。\n\n先在另一篇文档上勾选『作为核心背景』,这篇自动让位后,再回来删除。");
      return;
    }
    if (!confirm(`删除「${d.title}」?`)) return;
    const res = await fetch(`/api/knowledge/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("删除失败");
      return;
    }
    await load();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">知识库</h1>
          {!editing && (
            <button
              onClick={startNew}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 新增文档
            </button>
          )}
        </div>

        <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          把产品手册、价格表、常见问题、服务流程等商家资料贴进来。机器人只把相关的一两篇检索进对话,「核心背景」
          那篇则始终带上。话术和回复只会基于这些资料,不会编造。
        </div>

        {loading ? (
          <div className="mt-5 text-sm text-slate-500">加载中…</div>
        ) : (
          <div className="mt-5 space-y-3">
            {docs.length === 0 && !editing && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                还没有资料。点右上角「+ 新增文档」贴第一篇,比如把你们卖什么、多少钱写进去。
              </div>
            )}

            {docs.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{d.title}</span>
                    {d.pinned && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        核心背景
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-slate-400">{d.content.length} 字</span>
                    <button onClick={() => startEdit(d)} className="text-blue-600 hover:underline">
                      编辑
                    </button>
                    <button onClick={() => remove(d)} className="text-red-600 hover:underline">
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-medium text-slate-800">{editing.id ? "编辑文档" : "新增文档"}</h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">标题</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="比如:产品手册 / 价格表 / 常见问题"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">内容</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder={"把商家资料贴进来,例如:\n\n- 主营:家庭/企业保障方案,合作多家保险公司\n- 主打:XX 医疗险,保额 XX 起\n- 理赔时效:3 个工作日\n- 常见问题:异地投保、健康告知"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                作为核心背景(每次对话都带上)
              </label>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
              <button onClick={cancel} className="text-sm text-slate-600 hover:underline">
                取消
              </button>
              {saved && <span className="text-sm text-emerald-600">已保存 ✓</span>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
