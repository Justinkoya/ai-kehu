"use client";
import { useCallback, useEffect, useState } from "react";
import { NavBar } from "@/components/navbar";

type ChatMsg = { id: string; conversationId: string; role: string; content: string; createdAt: string };

const PAGE = 100;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ChatHistoryPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (query: string, skip: number, replace: boolean) => {
    if (replace) setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE), skip: String(skip) });
    if (query.trim()) params.set("q", query.trim());
    try {
      const res = await fetch(`/api/chat?${params.toString()}`);
      const d = await res.json();
      const list: ChatMsg[] = d.messages ?? [];
      setMessages((prev) => (replace ? list : [...prev, ...list]));
      setHasMore(list.length === PAGE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load("", 0, true);
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(input.trim());
    load(input.trim(), 0, true);
  }

  function handleClear() {
    setInput("");
    setQ("");
    load("", 0, true);
  }

  function handleLoadMore() {
    setLoadingMore(true);
    load(q, messages.length, false);
  }

  const sorted = [...messages].reverse(); // API 按时间倒序,页面按时间正序展示

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">聊天记录</h1>
        <p className="mt-1 text-sm text-slate-600">你和微信机器人之间的历史对话,可以按关键词搜索。</p>

        <form onSubmit={handleSearch} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="搜索聊天内容,如「报价」「合同」…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            搜索
          </button>
        </form>
        {q && (
          <div className="mt-2 text-sm text-slate-500">
            搜索「{q}」,共 {sorted.length} 条
            <button onClick={handleClear} className="ml-2 text-blue-600 hover:underline">
              清除
            </button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {sorted.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {q ? "没有找到匹配的聊天记录" : "还没有聊天记录。在微信里跟机器人说几句话,这里就能看到了。"}
            </div>
          )}
          {sorted.map((m, i) => {
            const day = fmtDay(m.createdAt);
            const showDay = i === 0 || fmtDay(sorted[i - 1].createdAt) !== day;
            const mine = m.role === "user";
            return (
              <div key={m.id}>
                {showDay && <div className="my-3 text-center text-xs text-slate-400">{day}</div>}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                      mine ? "bg-blue-600 text-white" : "bg-white text-slate-800"
                    }`}
                  >
                    <div className={`text-xs ${mine ? "text-blue-200" : "text-slate-400"}`}>
                      {mine ? "我" : "机器人"} · {fmtTime(m.createdAt)}
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {loading && <div className="py-8 text-center text-sm text-slate-400">加载中…</div>}
        </div>

        {hasMore && !loading && (
          <div className="mt-4 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? "加载中…" : "加载更多"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
