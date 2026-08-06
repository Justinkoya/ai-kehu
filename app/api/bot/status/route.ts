import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BOT_NAME } from "@/lib/constants";

// 读 bot 心跳文件判断在线/离线;文件不存在或超过 90s 未更新视为离线
export async function GET() {
  try {
    const file = path.join(process.cwd(), "bot", ".status.json");
    const raw = readFileSync(file, "utf8");
    const s = JSON.parse(raw) as { online?: boolean; name?: string; pid?: number; messageCount?: number; updatedAt?: string };
    const lastSeen = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
    const online = s.online === true && Date.now() - lastSeen < 90_000;
    return NextResponse.json({
      online,
      name: s.name || BOT_NAME,
      pid: online ? s.pid ?? null : null,
      messageCount: online ? s.messageCount ?? 0 : 0,
      updatedAt: s.updatedAt ?? null,
    });
  } catch {
    return NextResponse.json({ online: false, name: BOT_NAME, pid: null, messageCount: 0, updatedAt: null });
  }
}
