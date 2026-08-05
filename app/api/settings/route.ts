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
      productContext: setting.productContext,
      aiBaseUrl: setting.aiBaseUrl,
      aiModel: setting.aiModel,
      aiAuthTokenConfigured: !!setting.aiAuthToken,
      updatedAt: setting.updatedAt,
    },
  });
}

export async function PUT(req: Request) {
  const data = await req.json();

  const update: Record<string, unknown> = {};
  if (typeof data.productContext === "string") {
    update.productContext = data.productContext;
  }
  if (typeof data.aiBaseUrl === "string") {
    update.aiBaseUrl = data.aiBaseUrl.trim() || null;
  }
  if (typeof data.aiModel === "string") {
    update.aiModel = data.aiModel.trim() || null;
  }
  // token 输入框留空 = 保留原值;填了 = 覆盖;clearAi = 清空
  if (typeof data.aiAuthToken === "string" && data.aiAuthToken.trim()) {
    update.aiAuthToken = data.aiAuthToken.trim();
  }
  if (data.clearAi) {
    update.aiBaseUrl = null;
    update.aiAuthToken = null;
  }

  const setting = await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, ...update },
    update,
  });
  return NextResponse.json({
    setting: {
      id: setting.id,
      productContext: setting.productContext,
      aiBaseUrl: setting.aiBaseUrl,
      aiModel: setting.aiModel,
      aiAuthTokenConfigured: !!setting.aiAuthToken,
      updatedAt: setting.updatedAt,
    },
  });
}
