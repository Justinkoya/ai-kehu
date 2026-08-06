import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let setting = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!setting) {
    setting = await prisma.setting.create({ data: { id: 1 } });
  }
  // 不回传完整 token,只告诉前端"已配置"
  return NextResponse.json({
    setting: {
      id: setting.id,
      aiBaseUrl: setting.aiBaseUrl,
      aiModel: setting.aiModel,
      botName: setting.botName,
      welcomeMessage: setting.welcomeMessage,
      reminderEnabled: setting.reminderEnabled,
      reminderStart: setting.reminderStart,
      reminderEnd: setting.reminderEnd,
      aiAuthTokenConfigured: !!setting.aiAuthToken,
      updatedAt: setting.updatedAt,
    },
  });
}

export async function PUT(req: Request) {
  const data = await req.json();

  const update: Record<string, unknown> = {};
  if (typeof data.aiBaseUrl === "string") {
    update.aiBaseUrl = data.aiBaseUrl.trim() || null;
  }
  if (typeof data.aiModel === "string") {
    update.aiModel = data.aiModel.trim() || null;
  }
  if (typeof data.botName === "string") {
    update.botName = data.botName.trim() || null;
  }
  if (typeof data.welcomeMessage === "string") {
    update.welcomeMessage = data.welcomeMessage.trim() || null;
  }
  // token 输入框留空 = 保留原值;填了 = 覆盖;clearAi = 清空
  if (typeof data.aiAuthToken === "string" && data.aiAuthToken.trim()) {
    update.aiAuthToken = data.aiAuthToken.trim();
  }
  if (data.clearAi) {
    update.aiBaseUrl = null;
    update.aiAuthToken = null;
  }
  if (typeof data.reminderEnabled === "boolean") {
    update.reminderEnabled = data.reminderEnabled;
  }
  // 时段只接受 HH:mm(小时可一位);用字典序比较判断是否在窗口内,补齐前导零保证一致
  for (const k of ["reminderStart", "reminderEnd"] as const) {
    if (typeof data[k] === "string" && /^\d{1,2}:\d{2}$/.test(data[k])) {
      update[k] = data[k].replace(/^(\d):/, "0$1");
    }
  }

  const setting = await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, ...update },
    update,
  });
  return NextResponse.json({
    setting: {
      id: setting.id,
      aiBaseUrl: setting.aiBaseUrl,
      aiModel: setting.aiModel,
      botName: setting.botName,
      welcomeMessage: setting.welcomeMessage,
      reminderEnabled: setting.reminderEnabled,
      reminderStart: setting.reminderStart,
      reminderEnd: setting.reminderEnd,
      aiAuthTokenConfigured: !!setting.aiAuthToken,
      updatedAt: setting.updatedAt,
    },
  });
}
