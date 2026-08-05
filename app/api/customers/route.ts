import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const data = await req.json();
  if (!data.name) return NextResponse.json({ error: "客户代号/称呼必填" }, { status: 400 });

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      rawConversation: data.rawConversation || null,
      source: data.source || null,
      requirement: data.requirement || null,
      interested: data.interested || null,
      stage: data.stage || null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      lastAction: data.lastAction || null,
      nextAction: data.nextAction || null,
      nextFollowDate: data.nextFollowDate ? new Date(data.nextFollowDate) : null,
      lastDraft: data.lastDraft || null,
      riskNotes: data.riskNotes || null,
      notes: data.notes || null,
    },
  });
  return NextResponse.json({ customer });
}
