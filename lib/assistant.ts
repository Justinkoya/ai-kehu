import type { Customer } from "@prisma/client";
import { prisma } from "./prisma";
import { analyzeCustomer, callChatCompletions, type RelayMessage } from "./ai";

export type AssistantOpts = {
  productContext?: string | null;
  aiBaseUrl?: string | null;
  aiAuthToken?: string | null;
  aiModel?: string | null;
};

type RouterAction =
  | { action: "getTodayFollowUps"; args: Record<string, never> }
  | { action: "findCustomer"; args: { keyword: string } }
  | { action: "createCustomerFromChat"; args: { name?: string; rawConversation: string } }
  | { action: "analyzeCustomer"; args: { name: string } }
  | { action: "draftFollowUp"; args: { name: string } }
  | { action: "general"; args: { text: string } };

const ROUTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_today_follow_ups",
      description: "商家问今天/最近要跟进哪些客户,返回跟进清单。无参数。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "find_customer",
      description: "商家想了解某个客户的情况(阶段、需求、上次动作等),如\"王姐现在什么情况\"。",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string", description: "客户称呼关键词,尽量用消息里出现的称呼" } },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_customer_from_chat",
      description: "商家粘贴了一段与客户的聊天记录,要录入建档并分析。rawConversation 必须逐字保留原文。",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "聊天里客户的称呼,能判断就填,判断不出填空串" },
          rawConversation: { type: "string", description: "聊天记录原文,逐字保留,不要加工" },
        },
        required: ["rawConversation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_customer",
      description: "商家点名要(重新)分析某个已有客户,如\"分析一下王姐\"。",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "客户称呼" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_follow_up",
      description: "商家要某个客户的跟进话术草稿,如\"王姐的跟进话术\"。",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "客户称呼" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "general_talk",
      description: "问候、闲聊、感谢、问你能做什么等,不需要查库。返回一句自然的中文回复。",
      parameters: {
        type: "object",
        properties: { text: { type: "string", description: "给商家的自然中文回复" } },
        required: ["text"],
      },
    },
  },
] as const;

const ROUTER_SYSTEM = `你是"AI客户经营助手"微信端的功能路由。商家(真人助理)在微信里发消息给你,你要把消息路由成【唯一一个】要执行的动作,返回对应函数的参数。只能选一个动作。

可执行动作:
1. get_today_follow_ups:商家问跟进清单,如"今天要跟进谁""今天有什么要跟进的""最近要跟进的"。
2. find_customer:商家想了解某个客户的情况,如"王姐现在什么情况""张哥上次聊了什么""看一下李总的档案"。
3. create_customer_from_chat:商家粘贴了一段与客户的聊天记录(通常是多行、含"称呼:说话内容"的格式),要录入建档。
4. analyze_customer:商家点名要(重新)分析某个客户,如"分析一下王姐""重新分析老李"。
5. draft_follow_up:商家要某个客户的跟进话术,如"王姐的跟进话术""帮我给老李写句跟进的话"。
6. general_talk:问候、闲聊、感谢、问功能、或其他都不是以上动作。

判断要点:
- 消息内容明显是一整段聊天记录(多行、行内有"称呼:")→ create_customer_from_chat;客户称呼取聊天记录里对方的完整称呼,不要截断或缩写(聊天里是"测试客户小李"就填"测试客户小李"),判断不出 name 填空串。
- "分析/重新分析"+"称呼" → analyze_customer;"话术/跟进语/怎么跟进"+"称呼" → draft_follow_up;"什么情况/怎么样/了解下/看下/档案"+"称呼" → find_customer。
- 称呼取消息里出现的客户名字或昵称,不要用"我、你"这类代词。
- 拿不准就选 general_talk,用一句自然的回复引导商家说清楚。

【商家产品/服务背景,供建档后话术参考】
`;

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

async function routeMessage(
  text: string,
  history: RelayMessage[],
  opts: AssistantOpts
): Promise<RouterAction> {
  const date = new Date().toISOString().slice(0, 10);
  const res = await callChatCompletions(
    [
      {
        role: "system",
        content: `【今天是${date}】\n${ROUTER_SYSTEM}\n${opts.productContext || "(未填写)"}`,
      },
      ...history.slice(-6),
      { role: "user", content: text },
    ],
    {
      tools: ROUTER_TOOLS,
      toolChoice: "auto",
      maxTokens: 1024,
      aiBaseUrl: opts.aiBaseUrl,
      aiAuthToken: opts.aiAuthToken,
      aiModel: opts.aiModel,
    }
  );
  const tc = res.toolCalls[0];
  if (tc?.name && typeof tc.arguments === "string") {
    const args = (parseJson(tc.arguments) ?? {}) as Record<string, unknown>;
    switch (tc.name) {
      case "get_today_follow_ups":
        return { action: "getTodayFollowUps", args: {} };
      case "find_customer":
        return { action: "findCustomer", args: { keyword: String(args.keyword ?? "") } };
      case "create_customer_from_chat":
        return {
          action: "createCustomerFromChat",
          args: {
            name: args.name ? String(args.name) : "",
            rawConversation: String(args.rawConversation ?? text),
          },
        };
      case "analyze_customer":
        return { action: "analyzeCustomer", args: { name: String(args.name ?? "") } };
      case "draft_follow_up":
        return { action: "draftFollowUp", args: { name: String(args.name ?? "") } };
      case "general_talk":
        return { action: "general", args: { text: String(args.text ?? "") || fallbackHelp() } };
    }
  }
  return { action: "general", args: { text: res.content.trim() || fallbackHelp() } };
}

function fallbackHelp(): string {
  return "我在的。你可以这样问我:\n- 「今天要跟进谁」\n- 把和客户的聊天记录粘贴给我建档\n- 「分析一下王姐」\n- 「王姐的跟进话术」";
}

function fmtDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateInput(s?: string): Date | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s) : null;
}

function tagsText(tags: string | null): string {
  if (!tags) return "";
  try {
    const a = JSON.parse(tags);
    if (Array.isArray(a)) return a.join(" · ");
  } catch {
    // 非 JSON 的旧格式,直接逗号拆分
  }
  return tags.split(",").filter(Boolean).join(" · ");
}

function customerProfile(c: Customer): string {
  const lines = [
    c.name,
    `阶段:${c.stage || "未分阶段"}`,
    ...(c.source ? [`来源:${c.source}`] : []),
    ...(c.requirement ? [`需求:${c.requirement}`] : []),
    ...(c.interested ? [`感兴趣:${c.interested}`] : []),
    ...(c.nextFollowDate ? [`跟进日期:${fmtDate(c.nextFollowDate)}${c.nextFollowDate.getTime() < Date.now() ? "(已逾期)" : ""}`] : []),
    ...(c.lastAction ? [`上次动作:${c.lastAction}`] : []),
    ...(c.nextAction ? [`下步动作:${c.nextAction}`] : []),
    ...(c.riskNotes ? [`风险:${c.riskNotes}`] : []),
  ];
  const tagLine = tagsText(c.tags);
  if (tagLine) lines.push(`标签:${tagLine}`);
  return lines.join("\n");
}

async function searchCustomers(kw: string): Promise<Customer[]> {
  const k = kw.trim();
  if (!k) return [];
  const all = await prisma.customer.findMany({ orderBy: { updatedAt: "desc" } });
  const exact = all.filter((c) => c.name === k);
  const fuzzy = all.filter((c) => !exact.includes(c) && (c.name.includes(k) || k.includes(c.name)));
  return [...exact, ...fuzzy].slice(0, 10);
}

type ResolveResult =
  | { customer: Customer; question?: never; matches?: never }
  | { customer?: never; question: string; matches: Customer[] };

async function resolveCustomer(kw: string): Promise<ResolveResult> {
  const matches = await searchCustomers(kw);
  if (matches.length === 1) return { customer: matches[0] };
  if (matches.length === 0) {
    return {
      question:
        `库里没找到「${kw}」。如果是刚聊完想建档,直接把聊天记录粘贴发我,我来建档分析;` +
        `如果名字记错了,告诉我正确的名字。`,
      matches: [],
    };
  }
  const list = matches.map((c, i) => `${i + 1}. ${c.name} · ${c.stage || "未分阶段"}`).join("\n");
  return { question: `找到几个相关的客户:\n${list}\n你指的是哪个?(回数字或名字)`, matches };
}

async function execGetTodayFollowUps(): Promise<string> {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = today.getTime() + 86400_000;
  const customers = await prisma.customer.findMany({
    where: { nextFollowDate: { not: null } },
    orderBy: { nextFollowDate: "asc" },
  });
  const overdue = customers.filter((c) => c.nextFollowDate!.getTime() < today.getTime());
  const dueToday = customers.filter(
    (c) => c.nextFollowDate!.getTime() >= today.getTime() && c.nextFollowDate!.getTime() < tomorrow
  );
  const upcoming = customers
    .filter((c) => c.nextFollowDate!.getTime() >= tomorrow)
    .slice(0, 5);

  const lines = ["今天要跟进的客户:"];
  for (const c of overdue) {
    lines.push(`[逾期] ${c.name} · ${c.stage || "未分阶段"} · 原定 ${fmtDate(c.nextFollowDate!)}${c.lastAction ? ` · 上次:${c.lastAction}` : ""}`);
  }
  for (const c of dueToday) {
    lines.push(`[今天] ${c.name} · ${c.stage || "未分阶段"}${c.lastAction ? ` · 上次:${c.lastAction}` : ""}`);
  }
  if (!overdue.length && !dueToday.length) lines.push("(今天没有该跟进的,省心)");
  if (upcoming.length) {
    lines.push("\n未来几天:");
    for (const c of upcoming) lines.push(`· ${fmtDate(c.nextFollowDate!)} ${c.name} · ${c.stage || "未分阶段"}`);
  }
  lines.push("\n想了解哪位客户,直接说名字;想写跟进话术,说「XX 的跟进话术」。");
  return lines.join("\n");
}

function profileReply(c: Customer): string {
  return customerProfile(c) + "\n\n要话术回「XX 的跟进话术」;要重新分析回「分析 XX」。";
}

async function execCreateCustomerFromChat(
  args: { name?: string; rawConversation: string },
  opts: AssistantOpts
): Promise<string> {
  const chat = (args.rawConversation || "").trim();
  if (!chat) return "没收到聊天记录,把和客户的聊天内容粘贴发我。";

  const name = args.name?.trim() || "";
  // 建档只在名字完全一致时才视为同一客户(更新),避免模糊匹配误覆盖别的客户
  const existing = name ? await prisma.customer.findFirst({ where: { name } }) : undefined;
  const result = await analyzeCustomer(
    {
      name: existing?.name ?? name,
      rawConversation: chat,
      source: existing?.source ?? "微信",
    },
    opts
  );

  const data = {
    name: result.record.name || name || "微信客户",
    rawConversation: chat,
    source: existing?.source || "微信",
    requirement: result.record.requirement || existing?.requirement || null,
    interested: result.record.interested || existing?.interested || null,
    notes: result.record.notes || existing?.notes || null,
    stage: result.stage,
    tags: JSON.stringify(result.tags),
    nextAction: result.nextAction,
    nextFollowDate: toDateInput(result.nextFollowDate),
    lastDraft: result.draftMessage,
    riskNotes: result.risks.length ? result.risks.join("; ") : existing?.riskNotes || null,
  };

  const saved = existing
    ? await prisma.customer.update({ where: { id: existing.id }, data })
    : await prisma.customer.create({ data });

  return [
    existing ? `已更新客户「${saved.name}」并重新分析:` : `已建档(系统里叫「${saved.name}」,可在后台改名):`,
    `阶段:${result.stage}`,
    result.tags.length ? `标签:${result.tags.join(" · ")}` : "",
    `信息缺口:${result.infoGaps.join("、") || "无"}`,
    `下步动作:${result.nextAction}`,
    result.nextFollowDate ? `建议跟进:${result.nextFollowDate}` : "",
    `\n话术草稿:\n${result.draftMessage}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function execAnalyzeCustomer(customer: Customer, opts: AssistantOpts): Promise<string> {
  const result = await analyzeCustomer(customer, opts);
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      stage: result.stage,
      tags: JSON.stringify(result.tags),
      requirement: result.record.requirement || customer.requirement,
      interested: result.record.interested || customer.interested,
      notes: result.record.notes || customer.notes,
      nextAction: result.nextAction,
      nextFollowDate: toDateInput(result.nextFollowDate),
      lastDraft: result.draftMessage,
      riskNotes: result.risks.length ? result.risks.join("; ") : customer.riskNotes,
    },
  });
  return [
    `重新分析完成(已更新到库):`,
    `阶段:${result.stage}`,
    result.tags.length ? `标签:${result.tags.join(" · ")}` : "",
    `信息缺口:${result.infoGaps.join("、") || "无"}`,
    `下步动作:${result.nextAction}`,
    result.nextFollowDate ? `建议跟进:${result.nextFollowDate}` : "",
    `\n话术草稿:\n${result.draftMessage}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function execDraftFollowUp(customer: Customer, opts: AssistantOpts): Promise<string> {
  if (customer.lastDraft) {
    return `${customer.name} 的跟进话术:\n\n${customer.lastDraft}\n\n(历史草稿,需要重新生成就回「重新分析 ${customer.name}」)`;
  }
  const result = await analyzeCustomer(customer, opts);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastDraft: result.draftMessage },
  });
  return `${customer.name} 的跟进话术:\n\n${result.draftMessage}`;
}

type Outcome =
  | { kind: "reply"; text: string }
  | { kind: "ask"; action: RouterAction; matches: Customer[]; text: string };

async function dispatch(action: RouterAction, opts: AssistantOpts): Promise<Outcome> {
  switch (action.action) {
    case "getTodayFollowUps":
      return { kind: "reply", text: await execGetTodayFollowUps() };
    case "findCustomer": {
      const r = await resolveCustomer(action.args.keyword);
      if (!r.customer) return { kind: "ask", action, matches: r.matches, text: r.question };
      return { kind: "reply", text: profileReply(r.customer) };
    }
    case "analyzeCustomer": {
      const r = await resolveCustomer(action.args.name);
      if (!r.customer) return { kind: "ask", action, matches: r.matches, text: r.question };
      return { kind: "reply", text: await execAnalyzeCustomer(r.customer, opts) };
    }
    case "draftFollowUp": {
      const r = await resolveCustomer(action.args.name);
      if (!r.customer) return { kind: "ask", action, matches: r.matches, text: r.question };
      return { kind: "reply", text: await execDraftFollowUp(r.customer, opts) };
    }
    case "createCustomerFromChat":
      return { kind: "reply", text: await execCreateCustomerFromChat(action.args, opts) };
    case "general":
      return { kind: "reply", text: action.args.text };
  }
}

async function executeOnCustomer(action: RouterAction, customer: Customer, opts: AssistantOpts): Promise<string> {
  switch (action.action) {
    case "analyzeCustomer":
      return execAnalyzeCustomer(customer, opts);
    case "draftFollowUp":
      return execDraftFollowUp(customer, opts);
    default:
      return profileReply(customer);
  }
}

export function createAssistant(opts: AssistantOpts) {
  let pending: { action: RouterAction; matches: Customer[] } | null = null;
  const history: RelayMessage[] = [];

  async function handle(text: string): Promise<string> {
    const trimmed = text.trim();
    try {
      // 反问确认的答复:回数字,直接命中列表里的客户
      if (pending && /^\d{1,2}$/.test(trimmed)) {
        const customer = pending.matches[Number(trimmed) - 1];
        const action = pending.action;
        pending = null;
        if (customer) return await executeOnCustomer(action, customer, opts);
        return "没看懂是哪个,再发一次名字或编号。";
      }

      const action = await routeMessage(trimmed, history, opts);
      const outcome = await dispatch(action, opts);
      history.push({ role: "user", content: trimmed });
      history.push({ role: "assistant", content: outcome.text });
      if (history.length > 30) history.splice(0, history.length - 30);

      if (outcome.kind === "ask") {
        pending = { action: outcome.action, matches: outcome.matches };
      } else {
        pending = null;
      }
      return outcome.text;
    } catch (e) {
      return `出错了:${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return { handle };
}
