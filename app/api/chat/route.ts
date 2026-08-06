import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit")) || 50), 200);
  const skip = Math.max(0, Number(url.searchParams.get("skip")) || 0);

  const messages = await prisma.chatMessage.findMany({
    where: {
      ...(conversationId ? { conversationId } : {}),
      ...(q ? { content: { contains: q } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip,
  });
  return NextResponse.json({ messages });
}
