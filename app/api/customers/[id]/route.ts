import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "客户不存在" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "客户不存在" }, { status: 404 });

  const data = await req.json();
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      rawConversation: data.rawConversation ?? existing.rawConversation,
      source: data.source ?? existing.source,
      requirement: data.requirement ?? existing.requirement,
      interested: data.interested ?? existing.interested,
      stage: data.stage ?? existing.stage,
      tags: data.tags ? JSON.stringify(data.tags) : existing.tags,
      lastAction: data.lastAction ?? existing.lastAction,
      nextAction: data.nextAction ?? existing.nextAction,
      nextFollowDate: data.nextFollowDate ? new Date(data.nextFollowDate) : existing.nextFollowDate,
      lastDraft: data.lastDraft ?? existing.lastDraft,
      riskNotes: data.riskNotes ?? existing.riskNotes,
      notes: data.notes ?? existing.notes,
    },
  });
  return NextResponse.json({ customer });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "客户不存在" }, { status: 404 });
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
