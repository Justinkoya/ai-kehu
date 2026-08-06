import { prisma } from "./prisma";

export type KnowledgeDocItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
};

// 老版 Setting.productContent 首次使用时迁移成一篇 pinned「核心背景」文档。
// count+create 包在事务里:bot loadOpts 与 /api/knowledge GET 可能并发调用,防双建。
export async function ensureKnowledgeSeeded(): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.knowledgeDoc.count();
      if (count > 0) return;
      const setting = await tx.setting.findUnique({ where: { id: 1 } });
      const legacy = setting?.productContext?.trim();
      if (!legacy) return;
      await tx.knowledgeDoc.create({ data: { title: "核心背景", content: legacy, pinned: true } });
      await tx.setting.update({ where: { id: 1 }, data: { productContext: null } });
    });
  } catch (e) {
    console.error("[knowledge] 种子迁移失败:", e);
  }
}

// 查全部文档(种子 + 排序),统一入口,bot 和 API 共用
export async function loadDocs(): Promise<KnowledgeDocItem[]> {
  await ensureKnowledgeSeeded();
  const docs = await prisma.knowledgeDoc.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return docs.map((d) => ({ id: d.id, title: d.title, content: d.content, pinned: d.pinned }));
}

// 核心背景:始终注入的一段(pinned 文档 → 回退第一篇 → 无)
export function coreContext(docs: KnowledgeDocItem[]): string | null {
  const pinned = docs.find((d) => d.pinned)?.content?.trim();
  if (pinned) return pinned;
  const first = docs[0]?.content?.trim();
  return first || null;
}

// 中文 gram 打分检索:query 去标点后取 2-3 字 gram,title 命中 ×3,content 命中 ×1。
// 返回 pinned + 得分>0 的 top-N 非 pinned 文档。
export function retrieveDocs(
  docs: KnowledgeDocItem[],
  query: string,
  opts: { maxDocs?: number } = {}
): KnowledgeDocItem[] {
  const { maxDocs = 2 } = opts;
  const q = (query || "").trim();
  const pinned = docs.find((d) => d.pinned);
  const grams = gramsOf(q);
  if (!q || grams.size === 0) return pinned ? [pinned] : [];

  const scored = docs
    .filter((d) => !d.pinned)
    .map((d) => {
      const titleG = gramsOf(d.title);
      const contentG = gramsOf(d.content);
      let score = 0;
      for (const g of grams) {
        if (titleG.has(g)) score += 3;
        else if (contentG.has(g)) score += 1;
      }
      return { doc: d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDocs)
    .map((x) => x.doc);

  return pinned ? [pinned, ...scored] : scored;
}

// 分析路径的注入文本:核心背景 + 按客户文本(需求/兴趣/聊天原文)检索到的文档
export function knowledgeForAnalysis(docs: KnowledgeDocItem[], customerText: string): string | null {
  const core = coreContext(docs);
  const retrieved = retrieveDocs(docs, customerText, { maxDocs: 2 })
    .filter((d) => !d.pinned)
    .map((d) => d.content.trim().slice(0, 900))
    .filter(Boolean);
  if (!core && !retrieved.length) return null;
  return [core, ...retrieved].filter(Boolean).join("\n\n");
}

// 注入块,所有文档(含 pinned)统一限长,防老 productContext 撑爆 prompt
export function serializeKnowledge(
  docs: KnowledgeDocItem[],
  opts: { maxCharsPerDoc?: number } = {}
): string {
  const { maxCharsPerDoc = 900 } = opts;
  const parts: string[] = [];
  for (const d of docs) {
    const body = d.content.trim().slice(0, maxCharsPerDoc);
    if (!body) continue;
    parts.push(d.pinned ? `· 核心背景:\n${body}` : `· ${d.title}:\n${body}`);
  }
  if (!parts.length) return "";
  return `【商家知识库(以下资料来自你的知识库,回复/话术只能基于这些,严禁编造)】\n${parts.join("\n\n")}`;
}

function gramsOf(text: string): Set<string> {
  const s = text.replace(/[^\p{L}\p{N}]/gu, "");
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3));
  return out;
}
