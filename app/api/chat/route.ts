import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit")) || 50), 200);

  const messages = await prisma.chatMessage.findMany({
    where: conversationId ? { conversationId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ messages });
}
