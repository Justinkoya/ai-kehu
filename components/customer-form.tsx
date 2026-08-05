"use client";
import { useEffect, useRef, useState } from "react";

export type CustomerInput = {
  name: string;
  source: string;
  requirement: string;
  interested: string;
  stage: string;
  notes: string;
};

export function CustomerForm({
  initial,
  submitLabel,
  onSubmit,
  onAnalyze,
  analyzing,
}: {
  initial?: Partial<CustomerInput>;
  submitLabel: string;
  onSubmit: (v: CustomerInput) => void;
  onAnalyze?: (v: CustomerInput) => void;
  analyzing?: boolean;
}) {
  const [form, setForm] = useState<CustomerInput>({
    name: initial?.name ?? "",
    source: initial?.source ?? "",
    requirement: initial?.requirement ?? "",
    interested: initial?.interested ?? "",
    stage: initial?.stage ?? "",
    notes: initial?.notes ?? "",
  });
  const set = (k: keyof CustomerInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // initial 内容真正变化时(如 AI 建议被采纳写入客户)同步到表单;
  // 用内容比对避免每次渲染都重置用户正在输入的内容。
  const prevInitial = useRef<string>(JSON.stringify(initial));
  useEffect(() => {
    const s = JSON.stringify(initial);
    if (s !== prevInitial.current) {
      prevInitial.current = s;
      setForm({
        name: initial?.name ?? "",
        source: initial?.source ?? "",
        requirement: initial?.requirement ?? "",
        interested: initial?.interested ?? "",
        stage: initial?.stage ?? "",
        notes: initial?.notes ?? "",
      });
    }
  }, [initial]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <Field label="客户代号/称呼 *" v={form.name} onChange={(v) => set("name", v)} ph="如:王姐 / A客户(可脱敏)" />
      <Field label="来源" v={form.source} onChange={(v) => set("source", v)} ph="活动 / 转介绍 / 内容 / 社群" />
      <Field label="明确需求(客户真实表达)" v={form.requirement} onChange={(v) => set("requirement", v)} ph="客户自己说过的话" />
      <Field label="感兴趣产品(不等于购买意愿)" v={form.interested} onChange={(v) => set("interested", v)} />
      <Field label="当前阶段" v={form.stage} onChange={(v) => set("stage", v)} ph="留空让 AI 建议,或手动填" />
      <Field label="沟通记录 / 风险备注" v={form.notes} onChange={(v) => set("notes", v)} ph="上次聊了什么、有什么风险提醒" textarea />

      <div className="flex gap-3">
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700">
          {submitLabel}
        </button>
        {onAnalyze && (
          <button
            type="button"
            onClick={() => onAnalyze(form)}
            disabled={analyzing}
            className="rounded border border-blue-600 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            {analyzing ? "AI 分析中…" : "AI 分析"}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label, v, onChange, ph, textarea,
}: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  ph?: string;
  textarea?: boolean;
}) {
  const cls = "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {textarea ? (
        <textarea value={v} onChange={(e) => onChange(e.target.value)} placeholder={ph} rows={4} className={cls} />
      ) : (
        <input value={v} onChange={(e) => onChange(e.target.value)} placeholder={ph} className={cls} />
      )}
    </label>
  );
}
