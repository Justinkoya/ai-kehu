"use client";
import { useEffect, useState } from "react";
import type { Customer } from "@prisma/client";
import { STAGES, stageColor } from "@/lib/constants";
import { NavBar } from "@/components/navbar";
import { CustomerCard } from "@/components/customer-card";

export default function DashboardPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.customers ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="mb-4 text-xl font-semibold">跟进看板</h1>
        {loading ? (
          <p className="text-sm text-slate-700">加载中…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {STAGES.map((stage) => {
              const list = customers.filter((c) => (c.stage ?? "新认识") === stage);
              return (
                <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm font-medium">
                    <span className={`rounded-full px-2 py-0.5 ${stageColor(stage)}`}>{stage}</span>
                    <span className="rounded-full bg-white px-2 text-xs text-slate-700">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((c) => (
                      <CustomerCard key={c.id} c={c} />
                    ))}
                    {list.length === 0 && <p className="text-xs text-slate-600">暂无</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
