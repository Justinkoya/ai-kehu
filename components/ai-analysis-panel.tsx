"use client";

export type AnalysisResult = {
  record: {
    name: string;
    source: string;
    requirement: string;
    interested: string;
    notes: string;
  };
  stage: string;
  stageReason: string;
  tags: string[];
  infoGaps: string[];
  nextAction: string;
  nextFollowDate: string;
  draftMessage: string;
  risks: string[];
  needHumanConfirm: string[];
  demo?: boolean;
};

export function AiAnalysisPanel({
  result,
  loading,
  onApply,
}: {
  result: AnalysisResult | null;
  loading: boolean;
  onApply?: (r: AnalysisResult) => void;
}) {
  if (loading) {
    return <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-600">AI 正在分析客户记录…</div>;
  }
  if (!result) return null;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <span className="font-medium text-slate-700">{label}: </span>
      <span className="text-slate-600">{children || "无"}</span>
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-blue-900">AI 分析建议(待你审核)</h3>
          {result.demo && (
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">演示模式 · 未接入真实 AI</span>
          )}
        </div>
        {onApply && (
          <button
            onClick={() => onApply(result)}
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
          >
            采纳建议,写入客户
          </button>
        )}
      </div>
      <Row label="建议阶段">{result.stage}</Row>
      <Row label="依据">{result.stageReason}</Row>
      <Row label="建议标签">{result.tags.join("、")}</Row>
      <Row label="信息缺口">{result.infoGaps.join("、")}</Row>
      <Row label="下一动作">{result.nextAction}</Row>
      <Row label="建议跟进日期">{result.nextFollowDate}</Row>
      <div>
        <div className="font-medium text-slate-700">话术初稿:</div>
        <div className="mt-1 whitespace-pre-wrap rounded border border-blue-200 bg-white p-3 text-slate-700">
          {result.draftMessage}
        </div>
      </div>
      <div className="rounded border border-red-200 bg-red-50 p-3">
        <div className="font-semibold text-red-700">风险(采纳时会一并写入客户)</div>
        <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-red-700">
          {result.risks.length ? result.risks.map((r) => <li key={r}>{r}</li>) : <li>无</li>}
        </ul>
      </div>
      <div className="rounded border border-amber-200 bg-amber-50 p-3">
        <div className="font-semibold text-amber-700">需人工确认</div>
        <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-amber-700">
          {result.needHumanConfirm.length ? result.needHumanConfirm.map((r) => <li key={r}>{r}</li>) : <li>无</li>}
        </ul>
      </div>
    </div>
  );
}
