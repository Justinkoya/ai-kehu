"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/navbar";
import { CustomerForm, type CustomerInput } from "@/components/customer-form";
import { AiAnalysisPanel, type AnalysisResult } from "@/components/ai-analysis-panel";

export default function NewCustomerPage() {
  const router = useRouter();
  const [chat, setChat] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function handleBuild() {
    if (!chat.trim()) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: { rawConversation: chat } }),
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

  async function handleSave(v: CustomerInput) {
    setSaving(true);
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        rawConversation: chat || null,
        ...(result && {
          stage: result.stage,
          tags: result.tags,
          nextAction: result.nextAction,
          nextFollowDate: result.nextFollowDate,
          lastDraft: result.draftMessage,
        }),
      }),
    });
    setSaving(false);
    router.push("/");
    router.refresh();
  }

  const initial = result
    ? { name: result.record.name, source: result.record.source, requirement: result.record.requirement, interested: result.record.interested, stage: result.stage, notes: result.record.notes }
    : undefined;

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-5 text-xl font-semibold">添加客户</h1>

        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h2 className="font-semibold text-blue-900">AI 一键建档</h2>
          <p className="mt-1 text-sm text-blue-800/70">
            把微信/企微里和客户的真实对话直接贴进来,AI 自动提取档案、阶段、标签、跟进动作和话术初稿。
          </p>
          <textarea
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            rows={6}
            placeholder={"例如:\n我: 王姐你好,上次您说的那个事儿我记着呢\n王姐: 想先了解下你们是怎么收费的,家里有两个孩子\n我: 好的,我整理份资料给您\n王姐: 行,发我看看"}
            className="mt-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={handleBuild}
            disabled={analyzing || !chat.trim()}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? "AI 分析中…" : "AI 建档"}
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-600">AI 建档后,核对下面内容再保存;也可以直接手动填写</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <CustomerForm
          key={result ? JSON.stringify(result.record) : "empty"}
          initial={initial}
          submitLabel={saving ? "保存中…" : "保存客户"}
          onSubmit={handleSave}
        />

        <div className="mt-6">
          <AiAnalysisPanel result={result} loading={analyzing} />
        </div>
      </main>
    </div>
  );
}
