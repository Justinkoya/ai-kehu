"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Customer } from "@prisma/client";
import { stageColor } from "@/lib/constants";
import { NavBar } from "@/components/navbar";

type Row = { name: string; tone: string; dot: string };

const GROUPS: { key: string; label: string; tone: string; dot: string; hint: string }[] = [
  { key: "overdue", label: "已逾期", tone: "text-red-700", dot: "bg-red-500", hint: "过了跟进日期,优先处理" },
  { key: "today", label: "今天", tone: "text-amber-700", dot: "bg-amber-500", hint: "今天到期的跟进" },
  { key: "upcoming", label: "未来 7 天", tone: "text-slate-700", dot: "bg-slate-400", hint: "提前安排,别临期手忙脚乱" },
  { key: "undated", label: "暂无跟进日期", tone: "text-slate-600", dot: "bg-slate-300", hint: "记得去设一个跟进日期" },
];

export default function TodayPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers ?? []);
        setLoading(false);
      });
  }, []);

  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const buckets: Record<string, Customer[]> = { overdue: [], today: [], upcoming: [], undated: [] };
  for (const c of customers) {
    if (!c.nextFollowDate) {
      buckets.undated.push(c);
      continue;
    }
    const d = new Date(c.nextFollowDate);
    d.setHours(0, 0, 0, 0);
    if (d < start) buckets.overdue.push(c);
    else if (dayKey(d) === dayKey(start)) buckets.today.push(c);
    else if (d <= end) buckets.upcoming.push(c);
    else buckets.undated.push(c);
  }

  async function copy(c: Customer) {
    if (!c.lastDraft) return;
    try {
      await navigator.clipboard.writeText(c.lastDraft);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  const total = customers.length;

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">今日跟进</h1>
          <p className="mt-1 text-sm text-slate-700">
            {loading ? "加载中…" : total === 0 ? "还没有客户。" : `共 ${total} 位客户,今天到期 ${buckets.overdue.length + buckets.today.length} 位。`}
          </p>
        </div>

        {!loading && total === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-slate-700">从一个真实对话开始</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-700">
              把和客户的微信/企微聊天记录贴进去,AI 自动建档并生成今天的跟进清单。
            </p>
            <Link
              href="/customers/new"
              className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 粘贴聊天记录建档
            </Link>
          </div>
        )}

        {total > 0 && (
          <div className="space-y-6">
            {GROUPS.map((g) => (
              <section key={g.key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
                  <h2 className={`text-sm font-semibold ${g.tone}`}>
                    {g.label}
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-700">{buckets[g.key].length}</span>
                  </h2>
                </div>
                {buckets[g.key].length === 0 ? (
                  <p className="ml-4 text-xs text-slate-600">{g.hint}</p>
                ) : (
                  <div className="space-y-2">
                    {buckets[g.key].map((c) => (
                      <FollowUpRow key={c.id} c={c} copied={copiedId === c.id} onCopy={() => copy(c)} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FollowUpRow({ c, copied, onCopy }: { c: Customer; copied: boolean; onCopy: () => void }) {
  let tags: string[] = [];
  try {
    tags = c.tags ? JSON.parse(c.tags) : [];
  } catch {}
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/customers/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600">
              {c.name}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-xs ${stageColor(c.stage)}`}>{c.stage || "新认识"}</span>
            {c.riskNotes && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">有风险</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{t}</span>
            ))}
          </div>
          {c.nextAction && <p className="mt-1.5 text-sm text-slate-600">{c.nextAction}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {c.nextFollowDate && (
            <span className="text-xs text-slate-600">{new Date(c.nextFollowDate).toISOString().slice(0, 10)}</span>
          )}
          <button
            onClick={onCopy}
            disabled={!c.lastDraft}
            className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40"
          >
            {copied ? "已复制 ✓" : "复制话术"}
          </button>
        </div>
      </div>
    </div>
  );
}
