"use client";
import { useEffect, useState } from "react";
import { NavBar } from "@/components/navbar";
import { AI_MODEL, AI_MODELS } from "@/lib/constants";

const EXAMPLE = `- 我们做家庭/企业保障方案,合作多家保险公司,可对比报价
- 主打产品:XX 医疗险,保额 XX 起,含门诊报销
- 价格区间:XXXX 元/年 起
- 常见问题:异地投保、健康告知、理赔时效
- 禁止承诺:收益、保证理赔、返佣`;

export default function SettingsPage() {
  const [productContext, setProductContext] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiToken, setAiToken] = useState("");
  const [aiModel, setAiModel] = useState(AI_MODEL);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.setting ?? {};
        setProductContext(s.productContext ?? "");
        setAiBaseUrl(s.aiBaseUrl ?? "");
        setAiModel(s.aiModel ?? AI_MODEL);
        setAiConfigured(!!s.aiAuthTokenConfigured && !!s.aiBaseUrl);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productContext,
        aiBaseUrl,
        aiModel,
        aiAuthToken: aiToken.trim() || undefined,
      }),
    });
    setSaving(false);
    setAiToken("");
    setAiConfigured(Boolean(aiBaseUrl.trim()) && Boolean(aiToken.trim() || aiConfigured));
    setSaved(true);
  }

  async function handleClearAi() {
    if (!confirm("清除 AI 中转配置?")) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAi: true }),
    });
    setAiBaseUrl("");
    setAiToken("");
    setAiModel(AI_MODEL);
    setAiConfigured(false);
    setSaved(true);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">设置</h1>
        <p className="mt-1 text-sm text-slate-600">
          在这里告诉 AI 你们卖什么,以及接哪里的 AI 服务。改完点保存立即生效。
        </p>

        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-medium text-blue-900">这个页面是干嘛的?</div>
          <ul className="mt-2 space-y-1 text-sm text-blue-800/80">
            <li>· 上半部分:写清"我们卖什么、多少钱、能承诺什么",AI 生成话术时照着说</li>
            <li>· 下半部分:填 AI 服务的中转地址和密钥,还能选一个分析模型(GPT 系列)</li>
            <li>· 改完点「保存设置」立即生效,后续每次 AI 分析都会带上</li>
          </ul>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">产品 / 服务背景</span>
            <textarea
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
              rows={8}
              placeholder={"把你卖的东西、价格、常见问题写清楚,例如:\n\n- 我们做家庭/企业保障方案\n- 主打产品:XX 医疗险\n- 价格区间:XXXX 元/年 起\n- 禁止承诺:收益、保证理赔"}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="mt-3 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setProductContext(EXAMPLE)}
              className="rounded border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
            >
              填入示例(照这个格式改成你的)
            </button>
            <button
              type="button"
              onClick={() => setProductContext("")}
              className="rounded border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-slate-50"
            >
              清空
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存设置"}
            </button>
            {saved && <span className="text-sm text-emerald-600">已保存 ✓</span>}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-800">AI 服务配置</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs ${aiConfigured ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
              {aiConfigured ? "真实 AI 已启用" : "演示模式 / 未配置"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            填上中转地址和密钥,AI 分析就走真实模型。这里留空则回退使用服务器 .env 里的配置;再没有就用演示模式。
          </p>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">分析模型</span>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                只列 GPT 模型:结构化输出依赖强制工具调用,claude 系列会被中转强制 thinking 而不可用。
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">中转地址(Base URL)</span>
              <input
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Token(密钥,不会明文显示)</span>
              <input
                type="password"
                value={aiToken}
                onChange={(e) => setAiToken(e.target.value)}
                placeholder="留空 = 保持已保存的密钥不变"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存设置"}
            </button>
            <button onClick={handleClearAi} className="text-xs text-red-600 hover:underline">
              清除此配置,回退到 .env
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-slate-800">推荐格式(照着填)</h2>
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{EXAMPLE}</pre>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="mb-2 font-medium text-slate-800">说明</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>AI 生成话术只会在你给的范围内发挥,不会编造你们没有的能力。</li>
            <li>不写产品背景也没关系,AI 仍会根据客户聊天原文生成话术,但会更"通用"一些。</li>
            <li>所有 AI 输出都是待你审核的初稿,确认后再发给客户。</li>
            <li>密钥只保存在本机数据库里,不会明文显示、不会上传到其他地方。</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
