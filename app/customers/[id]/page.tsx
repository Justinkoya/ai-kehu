"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";
import { stageColor } from "@/lib/constants";
import { NavBar } from "@/components/navbar";
import { CustomerForm, type CustomerInput } from "@/components/customer-form";
import { AiAnalysisPanel, type AnalysisResult } from "@/components/ai-analysis-panel";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newChat, setNewChat] = useState("");

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => setCustomer(d.customer));
  }, [id]);

  const tagsOf = (c: Customer) => {
    try {
      return c.tags ? JSON.parse(c.tags) : [];
    } catch {
      return [];
    }
  };

  async function handleSave(v: CustomerInput) {
    setSaving(true);
    await fetch(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setSaving(false);
    const d = await fetch(`/api/customers/${id}`).then((r) => r.json());
    setCustomer(d.customer);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: id }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setResult(data.result);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleReanalyze() {
    const chat = newChat.trim();
    if (!chat || !customer) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const merged = customer.rawConversation ? `${customer.rawConversation}\n\n${chat}` : chat;
      const up = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawConversation: merged }),
      });
      const upd = await up.json();
      if (upd.customer) setCustomer(upd.customer);

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: id }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setResult(data.result);
        setNewChat("");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleApply(r: AnalysisResult) {
    setSaving(true);
    await fetch(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: r.stage,
        tags: r.tags,
        nextAction: r.nextAction,
        nextFollowDate: r.nextFollowDate,
        lastDraft: r.draftMessage,
        riskNotes: [...(r.risks ?? []), ...(r.needHumanConfirm ?? [])].join("\n"),
      }),
    });
    setSaving(false);
    const d = await fetch(`/api/customers/${id}`).then((r) => r.json());
    setCustomer(d.customer);
  }

  async function handleDelete() {
    if (!confirm("确定删除这个客户?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  async function copyDraft() {
    if (!customer?.lastDraft) return;
    try {
      await navigator.clipboard.writeText(customer.lastDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-100">
        <NavBar />
        <main className="mx-auto max-w-3xl p-6 text-sm text-slate-700">加载中…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{customer.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${stageColor(customer.stage)}`}>{customer.stage || "新认识"}</span>
          </div>
          <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">删除客户</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <CustomerForm
            initial={{
              name: customer.name,
              source: customer.source ?? "",
              requirement: customer.requirement ?? "",
              interested: customer.interested ?? "",
              stage: customer.stage ?? "",
              notes: customer.notes ?? "",
            }}
            submitLabel={saving ? "保存中…" : "保存修改"}
            onSubmit={handleSave}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
          />
        </div>

        {customer.tags && (
          <div className="mt-4 flex flex-wrap gap-1">
            {tagsOf(customer).map((t: string) => (
              <span key={t} className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{t}</span>
            ))}
          </div>
        )}

        {customer.riskNotes && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-red-700">风险 / 待确认事项</h2>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-red-600">{customer.riskNotes}</pre>
          </div>
        )}

        {customer.lastDraft && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-800">最近话术草稿</h2>
              <button onClick={copyDraft} className="rounded-lg border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                {copied ? "已复制 ✓" : "复制"}
              </button>
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{customer.lastDraft}</p>
          </div>
        )}

        {customer.rawConversation && (
          <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">查看原始聊天记录</summary>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{customer.rawConversation}</p>
          </details>
        )}

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <h2 className="text-sm font-medium text-blue-900">贴最新对话,重新分析</h2>
          <p className="mt-1 text-xs text-blue-800/70">
            把和客户最近聊的内容贴进来,会追加到原有对话后面,AI 重新生成阶段、跟进动作和话术草稿。
          </p>
          <textarea
            value={newChat}
            onChange={(e) => setNewChat(e.target.value)}
            rows={4}
            placeholder={"例如:\n我: 上次发您的资料看了吗\n王姐: 看了,觉得基础班挺适合我,想问问怎么报名"}
            className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={handleReanalyze}
            disabled={analyzing || !newChat.trim()}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? "AI 分析中…" : "重新分析"}
          </button>
        </div>

        <div className="mt-6">
          <AiAnalysisPanel result={result} loading={analyzing} onApply={handleApply} />
        </div>
      </main>
    </div>
  );
}
