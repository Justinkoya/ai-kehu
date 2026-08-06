"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/navbar";
import { AI_MODEL, AI_MODELS, BOT_NAME, BOT_WELCOME } from "@/lib/constants";

export default function SettingsPage() {
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiToken, setAiToken] = useState("");
  const [aiModel, setAiModel] = useState(AI_MODEL);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [botName, setBotName] = useState(BOT_NAME);
  const [welcomeMessage, setWelcomeMessage] = useState(BOT_WELCOME);
  const [savingBot, setSavingBot] = useState(false);
  const [savedBot, setSavedBot] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartSaving, setAutoStartSaving] = useState(false);
  const [autoStartError, setAutoStartError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.setting ?? {};
        setAiBaseUrl(s.aiBaseUrl ?? "");
        setAiModel(s.aiModel ?? AI_MODEL);
        setBotName(s.botName ?? BOT_NAME);
        setWelcomeMessage(s.welcomeMessage ?? BOT_WELCOME);
        setAiConfigured(!!s.aiAuthTokenConfigured && !!s.aiBaseUrl);
      });
    fetch("/api/bot/autostart")
      .then((r) => r.json())
      .then((d) => setAutoStart(!!d.enabled))
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

  async function handleSaveBot() {
    setSavingBot(true);
    setSavedBot(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botName, welcomeMessage }),
    });
    setSavingBot(false);
    setSavedBot(true);
  }

  async function handleToggleAutoStart() {
    const next = !autoStart;
    setAutoStartSaving(true);
    setAutoStartError("");
    try {
      const res = await fetch("/api/bot/autostart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await res.json();
      if (!res.ok) {
        setAutoStartError(d.error ?? "设置失败");
      } else {
        setAutoStart(!!d.enabled);
      }
    } catch {
      setAutoStartError("设置失败,请稍后再试");
    }
    setAutoStartSaving(false);
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
            <li>· 上半部分:设置微信机器人(名字、欢迎语、开机自启);商家资料在「知识库」页管</li>
            <li>· 下半部分:填 AI 服务的中转地址和密钥,还能选一个分析模型(GPT 系列)</li>
            <li>· 改完点「保存设置」立即生效,后续每次 AI 分析都会带上</li>
          </ul>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-800">商家知识库</h2>
            <Link href="/knowledge" className="text-sm text-blue-600 hover:underline">
              去维护 →
            </Link>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            产品背景、价格、FAQ 等商家资料统一在「知识库」管理。机器人按客户对话内容检索相关资料,不填资料也能用,但话术会更"通用"。
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-800">微信机器人</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              在手机微信里陪你跟进客户的那个
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            改名字和欢迎语,保存后 bot 收到下一条消息就会用新的。左上角 header 会显示这个名字和在线状态。
          </p>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">机器人名字</span>
              <input
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder={BOT_NAME}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">欢迎语 / 功能说明</span>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={5}
                placeholder={BOT_WELCOME}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                商家在微信里发「你好 / 在吗 / 你能做什么」时,机器人会回复这段。
              </span>
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveBot}
              disabled={savingBot}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingBot ? "保存中…" : "保存机器人设置"}
            </button>
            {savedBot && <span className="text-sm text-emerald-600">已保存 ✓</span>}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                开机自动启动
                {autoStartSaving && <span className="text-xs font-normal text-slate-400">保存中…</span>}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Windows 开机后自动启动微信机器人(最小化窗口),不用每次手动开 start-bot.bat
              </p>
              {autoStartError && <p className="mt-1 text-xs text-red-600">{autoStartError}</p>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoStart}
              aria-label="开机自动启动"
              onClick={handleToggleAutoStart}
              disabled={autoStartSaving}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                autoStart ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  autoStart ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
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

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="mb-2 font-medium text-slate-800">说明</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>AI 生成话术只会在你给的范围内发挥,不会编造你们没有的能力。</li>
            <li>知识库里不填资料也没关系,AI 仍会根据客户聊天原文生成话术,但会更"通用"一些。</li>
            <li>所有 AI 输出都是待你审核的初稿,确认后再发给客户。</li>
            <li>密钥只保存在本机数据库里,不会明文显示、不会上传到其他地方。</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
