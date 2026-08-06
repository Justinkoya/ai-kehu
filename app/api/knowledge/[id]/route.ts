import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "文档不存在" }, { status: 404 });

  const data = await req.json();
  // 核心背景不能直接取消:先勾选另一篇作为核心,这篇才会自动让位
  if (existing.pinned && data.pinned === false) {
    return NextResponse.json({ error: "「核心背景」不能直接取消,先在另一篇文档上勾选『作为核心背景』" }, { status: 400 });
  }
  const doc = await prisma.$transaction(async (tx) => {
    if (data.pinned) {
      await tx.knowledgeDoc.updateMany({ where: { pinned: true }, data: { pinned: false } });
    }
    return tx.knowledgeDoc.update({
      where: { id },
      data: {
        title: typeof data.title === "string" ? data.title.trim() : existing.title,
        content: typeof data.content === "string" ? data.content : existing.content,
        pinned: typeof data.pinned === "boolean" ? data.pinned : existing.pinned,
      },
    });
  });
  return NextResponse.json({ doc });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  if (existing.pinned) {
    return NextResponse.json({ error: "「核心背景」不能直接删除,先在另一篇文档上勾选『作为核心背景』再回来删" }, { status: 400 });
  }
  await prisma.knowledgeDoc.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
