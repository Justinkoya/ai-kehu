import { AI_SYSTEM_PROMPT, customerRecordText } from "./prompts";
import { AI_MODEL, STAGES } from "./constants";

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

// 中转的 OpenAI 兼容端点实测:claude 系列被强制 thinking、tool_choice 关不掉;
// 只有 GPT 模型 + thinking:{type:"disabled"} 支持强制 function calling,拿到保证格式的结构化输出。
// 默认模型来自 constants 的 AI_MODEL,可被设置页保存的 aiModel 覆盖。

const SUBMIT_ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "提交客户分析结果",
    parameters: {
      type: "object",
      properties: {
        record: {
          type: "object",
          properties: {
            name: { type: "string" },
            source: { type: "string" },
            requirement: { type: "string" },
            interested: { type: "string" },
            notes: { type: "string" },
          },
          required: ["name", "source", "requirement", "interested", "notes"],
        },
        stage: { type: "string" },
        stageReason: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        infoGaps: { type: "array", items: { type: "string" } },
        nextAction: { type: "string" },
        nextFollowDate: { type: "string" },
        draftMessage: { type: "string" },
        risks: { type: "array", items: { type: "string" } },
        needHumanConfirm: { type: "array", items: { type: "string" } },
      },
      required: [
        "record",
        "stage",
        "stageReason",
        "tags",
        "infoGaps",
        "nextAction",
        "nextFollowDate",
        "draftMessage",
        "risks",
        "needHumanConfirm",
      ],
    },
  },
} as const;

const REQUIREMENT_KEYWORDS = ["想", "问", "咨询", "怎么", "价格", "收费", "多少钱", "报价", "了解", "方案", "需要", "合适", "对比"];

function chatLines(chat: string): string[] {
  const out: string[] = [];
  for (const line of chat.split("\n")) {
    const m = line.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
    if (m && m[1].trim() === "我") continue;
    if (m) out.push(m[2].trim());
    else if (line.trim()) out.push(line.trim());
  }
  return out;
}

function extractSpeaker(chat: string): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const line of chat.split("\n")) {
    const m = line.match(/^([^:：]{1,12})[:：]\s*.+/);
    if (!m) continue;
    const s = m[1].trim();
    if (!s || s === "我") continue;
    if (!counts.has(s)) order.push(s);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  if (!order.length) return "";
  let best = order[0];
  for (const s of order) if ((counts.get(s) ?? 0) > (counts.get(best) ?? 0)) best = s;
  return best;
}

function extractRequirement(chat: string): string {
  const lines = chatLines(chat);
  if (!lines.length) return "";
  const found = lines.find((l) => REQUIREMENT_KEYWORDS.some((k) => l.includes(k)));
  return (found || lines[lines.length - 1]).slice(0, 60);
}

function addDays(d: number) {
  return new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
}

// 未配置真实 API key 时的离线回退:根据输入的客户记录/聊天原文做确定性提取,
// 保证即使没有 key,输出也真实地反映用户输入(不是固定假数据)。
function demoAnalyze(customer: Parameters<typeof customerRecordText>[0]): AnalysisResult {
  const chat = customer.rawConversation || "";
  const kw = chat + (customer.requirement || "");
  const name = customer.name?.trim() || extractSpeaker(chat) || "客户";
  const requirement = customer.requirement?.trim() || extractRequirement(chat);
  const quote = requirement.replace(/[。！？!?]$/, "");

  const tags: string[] = [];
  if (customer.source?.trim()) tags.push(`来源:${customer.source.trim()}`);
  if (/价格|收费|多少钱|报价|费用|预算/.test(kw)) tags.push("需求:询问价格");
  if (/方案|计划|对比|推荐|资料/.test(kw)) tags.push("需求:要方案");
  if (/买了|已经|下单|成交|签约|确定了/.test(kw)) tags.push("阶段:有意向");
  if (!customer.interested && /产品|服务|险|课程|套餐|项目/.test(kw)) tags.push("产品:待确认");

  let stage = "新认识";
  if (/买了|已经|下单|成交|签约/.test(kw)) stage = "已成交";
  else if (requirement) stage = /方案|资料|发我|看看|预算|价格|收费|对比/.test(kw) ? "待方案体验" : "有明确需求";

  let nextAction = "主动联系客户,确认需求和购买意向";
  if (stage === "待方案体验") nextAction = "整理一份方案/资料发给客户,约时间确认下一步";
  else if (stage === "新认识") nextAction = "回访客户,了解初步意向,补充沟通";
  else if (stage === "已成交") nextAction = "安排交付/服务,确认满意度";

  const draftMessage = quote
    ? `${name},看到你提到"${quote}",我这边整理了一下相关的说明和方案,方便的话发你参考;不着急的话也先放着,有需要随时找我。`
    : `${name},上次聊完之后我这边一直记着,想再看看你那边有没有新的考虑,有任何问题随时找我。`;

  return {
    record: {
      name,
      source: customer.source?.trim() || "",
      requirement,
      interested: customer.interested?.trim() || "",
      notes: requirement
        ? `${name}通过${customer.source?.trim() || "对话"}联系,提到"${quote}"。`
        : `${name}已建立联系,初步沟通中。`,
    },
    stage,
    stageReason: requirement
      ? `客户在对话中明确提出了需求("${quote}"),据此判断阶段。`
      : "客户信息较少,暂归为新认识,建议先回访确认。",
    tags: tags.length ? tags : ["阶段:待确认"],
    infoGaps: ["客户预算范围", "期望成交时间"],
    nextAction,
    nextFollowDate: addDays(2),
    draftMessage,
    risks: ["客户意愿尚未充分验证,不要急于推销"],
    needHumanConfirm: ["价格和优惠需负责人确认"],
    demo: true,
  };
}

export type RelayMessage = { role: "system" | "user" | "assistant"; content: string };
export type ToolCall = { name: string; arguments: string };
export type RelayResult = { content: string; toolCalls: ToolCall[] };

// 中转 OpenAI 兼容端点的通用调用:设置页配置优先,.env 兜底;关 thinking;
// 带 tools 时由调用方决定 tool_choice(auto 让模型选,或指定函数名强制)。
export async function callChatCompletions(
  messages: RelayMessage[],
  opts?: {
    tools?: readonly unknown[];
    toolChoice?: unknown;
    maxTokens?: number;
    aiBaseUrl?: string | null;
    aiAuthToken?: string | null;
    aiModel?: string | null;
  }
): Promise<RelayResult> {
  const authToken = (opts?.aiAuthToken?.trim() || process.env.ANTHROPIC_AUTH_TOKEN || "").trim();
  const baseURL = opts?.aiBaseUrl?.trim() || process.env.ANTHROPIC_BASE_URL || "";
  const model = opts?.aiModel?.trim() || AI_MODEL;
  if (!authToken || !baseURL.trim()) throw new Error("未配置中转地址或密钥");

  const url = `${baseURL.replace(/\/+$/, "")}/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({
      model,
      max_tokens: opts?.maxTokens ?? 4096,
      thinking: { type: "disabled" },
      messages,
      ...(opts?.tools?.length ? { tools: opts.tools } : {}),
      ...(opts?.toolChoice ? { tool_choice: opts.toolChoice } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 调用失败:HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message as
    | { content?: unknown; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> }
    | undefined;
  const toolCalls: ToolCall[] = Array.isArray(msg?.tool_calls)
    ? msg.tool_calls
        .filter((tc) => tc?.function?.name)
        .map((tc) => ({
          name: tc.function!.name!,
          arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : "",
        }))
    : [];
  return { content: typeof msg?.content === "string" ? msg.content : "", toolCalls };
}

async function callOpenAi(
  customer: Parameters<typeof customerRecordText>[0],
  opts?: { productContext?: string | null; aiBaseUrl?: string | null; aiAuthToken?: string | null; aiModel?: string | null }
): Promise<AnalysisResult> {
  const authToken = (opts?.aiAuthToken?.trim() || process.env.ANTHROPIC_AUTH_TOKEN || "").trim();
  const baseURL = opts?.aiBaseUrl?.trim() || process.env.ANTHROPIC_BASE_URL || "";
  if (!authToken || !baseURL.trim()) return demoAnalyze(customer);

  const { toolCalls, content } = await callChatCompletions(
    [
      { role: "system", content: `【今天是${new Date().toISOString().slice(0, 10)}】\n` + AI_SYSTEM_PROMPT },
      { role: "user", content: customerRecordText(customer, opts?.productContext) },
    ],
    {
      tools: [SUBMIT_ANALYSIS_TOOL],
      toolChoice: { type: "function", function: { name: "submit_analysis" } },
      maxTokens: 4096,
      aiBaseUrl: opts?.aiBaseUrl,
      aiAuthToken: opts?.aiAuthToken,
      aiModel: opts?.aiModel,
    }
  );
  const args = toolCalls[0]?.arguments;
  if (typeof args === "string" && args.trim()) {
    const obj = tryParseJson(args);
    if (obj !== undefined) return normalizeAnalysis(obj);
  }
  // 兜底:极端情况下没走工具调用,尝试从 content 解析
  if (content.trim()) return parseAnalysisJson(content);
  throw new Error("AI 输出不是合法 JSON");
}

export async function analyzeCustomer(
  customer: Parameters<typeof customerRecordText>[0],
  opts?: { productContext?: string | null; aiBaseUrl?: string | null; aiAuthToken?: string | null; aiModel?: string | null }
): Promise<AnalysisResult> {
  try {
    return await callOpenAi(customer, opts);
  } catch (e) {
    // 偶发返回空/无 JSON,重试一次吸收
    if (e instanceof Error && e.message.includes("不是合法 JSON")) {
      return await callOpenAi(customer, opts);
    }
    throw e;
  }
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// 按花括号配平提取第一个 JSON 对象,跳过前/后缀文本,且不受字符串里的 } 干扰。
function extractJsonObject(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// 把模型输出规整成 AnalysisResult,字段级兜底。
function normalizeAnalysis(obj: unknown): AnalysisResult {
  const r = (obj ?? {}) as Partial<AnalysisResult>;
  const record = (r.record ?? {}) as Partial<AnalysisResult["record"]>;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(r.nextFollowDate ?? "");
  const stageOk = !!r.stage && (STAGES as readonly string[]).includes(r.stage);

  return {
    record: {
      name: record.name ?? "",
      source: record.source ?? "",
      requirement: record.requirement ?? "",
      interested: record.interested ?? "",
      notes: record.notes ?? "",
    },
    stage: stageOk ? r.stage! : "新认识",
    stageReason: r.stageReason ?? "",
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
    infoGaps: Array.isArray(r.infoGaps) ? r.infoGaps.filter((t): t is string => typeof t === "string") : [],
    nextAction: r.nextAction ?? "",
    nextFollowDate: dateOk ? r.nextFollowDate! : addDays(2),
    draftMessage: r.draftMessage ?? "",
    risks: Array.isArray(r.risks) ? r.risks.filter((t): t is string => typeof t === "string") : [],
    needHumanConfirm: Array.isArray(r.needHumanConfirm)
      ? r.needHumanConfirm.filter((t): t is string => typeof t === "string")
      : [],
  };
}

function parseAnalysisJson(text: string): AnalysisResult {
  let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let obj = tryParseJson(cleaned);
  if (obj === undefined) {
    const json = extractJsonObject(cleaned);
    if (json !== null) obj = tryParseJson(json);
  }
  if (obj === undefined) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) obj = tryParseJson(cleaned.slice(start, end + 1));
  }
  if (obj === undefined) throw new Error("AI 输出不是合法 JSON");
  return normalizeAnalysis(obj);
}
