"use client";
import { useEffect, useState } from "react";
import type { Customer } from "@prisma/client";
import Link from "next/link";
import { stageColor } from "@/lib/constants";
import { NavBar } from "@/components/navbar";

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"card" | "table">("card");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers ?? []);
        setLoading(false);
      });
  }, []);

  const tagsOf = (c: Customer) => {
    try {
      return c.tags ? JSON.parse(c.tags) : [];
    } catch {
      return [];
    }
  };

  const dateColor = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    if (dt.getTime() < today.getTime()) return "font-medium text-red-600";
    if (dt.getTime() === today.getTime()) return "font-medium text-amber-600";
    return "text-slate-600";
  };

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const pageItems = customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const switchView = (v: "card" | "table") => {
    setView(v);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">客户列表</h1>
            <p className="mt-1 text-sm text-slate-600">
              {loading ? "加载中…" : `共 ${customers.length} 位客户`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                onClick={() => switchView("card")}
                className={`rounded-md px-3 py-1 text-sm ${view === "card" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                卡片
              </button>
              <button
                onClick={() => switchView("table")}
                className={`rounded-md px-3 py-1 text-sm ${view === "table" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                表格
              </button>
            </div>
            <Link href="/customers/new" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              + 新客户
            </Link>
          </div>
        </div>

        {!loading && customers.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-600">还没有客户</p>
            <Link href="/customers/new" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + 添加第一个客户
            </Link>
          </div>
        )}

        {view === "card" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900 group-hover:text-blue-600">{c.name}</div>
                    {c.source && <div className="mt-0.5 text-xs text-slate-600">来源:{c.source}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {c.riskNotes && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">有风险</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${stageColor(c.stage)}`}>{c.stage || "新认识"}</span>
                  </div>
                </div>

                {tagsOf(c).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagsOf(c).slice(0, 3).map((t: string) => (
                      <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>
                    ))}
                  </div>
                )}

                {c.nextAction && <p className="mt-2 line-clamp-2 text-sm text-slate-700">{c.nextAction}</p>}

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                  <span className={c.nextFollowDate ? dateColor(new Date(c.nextFollowDate)) : "text-slate-600"}>
                    {c.nextFollowDate ? `跟进 ${new Date(c.nextFollowDate).toISOString().slice(0, 10)}` : "未设跟进日期"}
                  </span>
                  <span className="text-blue-600">查看 →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {view === "table" && (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-2">客户</th>
                    <th className="px-4 py-2">来源</th>
                    <th className="px-4 py-2">阶段</th>
                    <th className="px-4 py-2">下一动作</th>
                    <th className="px-4 py-2">跟进日期</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link href={`/customers/${c.id}`} className="font-medium hover:text-blue-600">{c.name}</Link>
                        {c.riskNotes && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">有风险</span>}
                      </td>
                      <td className="px-4 py-2">{c.source || "-"}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${stageColor(c.stage)}`}>{c.stage || "新认识"}</span>
                      </td>
                      <td className="px-4 py-2">{c.nextAction || "-"}</td>
                      <td className={`px-4 py-2 ${c.nextFollowDate ? dateColor(new Date(c.nextFollowDate)) : "text-slate-600"}`}>
                        {c.nextFollowDate ? new Date(c.nextFollowDate).toISOString().slice(0, 10) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-slate-600">
                第 {page} / {totalPages} 页,共 {customers.length} 条
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
