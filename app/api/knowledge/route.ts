import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureKnowledgeSeeded } from "@/lib/knowledge";

export async function GET() {
  await ensureKnowledgeSeeded();
  const docs = await prisma.knowledgeDoc.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ docs });
}

export async function POST(req: Request) {
  const data = await req.json();
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return NextResponse.json({ error: "标题必填" }, { status: 400 });
  const content = typeof data.content === "string" ? data.content : "";
  const pinned = !!data.pinned;

  // 单 pinned:新的设为核心背景时,先取消所有旧的
  const doc = await prisma.$transaction(async (tx) => {
    if (pinned) {
      await tx.knowledgeDoc.updateMany({ where: { pinned: true }, data: { pinned: false } });
    }
    return tx.knowledgeDoc.create({ data: { title, content, pinned } });
  });
  return NextResponse.json({ doc });
}
