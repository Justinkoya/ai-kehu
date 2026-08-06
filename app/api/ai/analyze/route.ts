import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeCustomer } from "@/lib/ai";
import { knowledgeForAnalysis, loadDocs } from "@/lib/knowledge";

export async function POST(req: Request) {
  const { customerId, customer } = await req.json();
  let record = customer;
  if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!c) return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    record = c;
  }
  if (!record || (!record.name && !record.rawConversation)) {
    return NextResponse.json({ error: "缺少客户记录或聊天记录" }, { status: 400 });
  }

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const docs = await loadDocs();
  const customerText = [record.name, record.requirement, record.interested, record.rawConversation]
    .filter(Boolean)
    .join("\n");
  try {
    const result = await analyzeCustomer(record, {
      productContext: knowledgeForAnalysis(docs, customerText),
      aiBaseUrl: setting?.aiBaseUrl ?? null,
      aiAuthToken: setting?.aiAuthToken ?? null,
      aiModel: setting?.aiModel ?? null,
    });
    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI 调用失败";
    return NextResponse.json({ error: `AI 调用失败:${message}` }, { status: 500 });
  }
}
