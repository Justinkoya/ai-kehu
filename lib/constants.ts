export const STAGES = [
  "新认识",
  "已完成首次沟通",
  "有明确需求",
  "待方案体验",
  "已成交",
  "服务中",
  "待复购转介绍",
  "暂停跟进",
] as const;

export const STAGE_COLORS: Record<string, string> = {
  "新认识": "bg-slate-100 text-slate-600",
  "已完成首次沟通": "bg-sky-100 text-sky-700",
  "有明确需求": "bg-blue-100 text-blue-700",
  "待方案体验": "bg-violet-100 text-violet-700",
  "已成交": "bg-emerald-100 text-emerald-700",
  "服务中": "bg-teal-100 text-teal-700",
  "待复购转介绍": "bg-amber-100 text-amber-700",
  "暂停跟进": "bg-slate-200 text-slate-700",
};

export const stageColor = (stage: string | null) => STAGE_COLORS[stage ?? ""] ?? "bg-slate-100 text-slate-600";

// 中转的 OpenAI 兼容端点只对 GPT 模型支持强制 function calling(thinking 可关闭),
// 所以模型只开放 GPT 系列,默认 gpt-5.4。
export const AI_MODEL = "gpt-5.4";

export const AI_MODELS = [
  { id: "gpt-5.4", label: "gpt-5.4 (推荐)" },
  { id: "gpt-5.5", label: "gpt-5.5" },
  { id: "gpt-5.4-mini", label: "gpt-5.4-mini (更快更省)" },
  { id: "gpt-5.3", label: "gpt-5.3" },
  { id: "gpt-5.2", label: "gpt-5.2" },
];
