import "dotenv/config";
import { login, start, isLoggedIn } from "weixin-agent-sdk";
import { prisma } from "../lib/prisma";
import { createAssistant, type AssistantOpts } from "../lib/assistant";

// 设置页配置优先,未配则回落到 .env(ANTHROPIC_*)
async function loadOpts(): Promise<AssistantOpts> {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  return {
    productContext: setting?.productContext ?? null,
    aiBaseUrl: setting?.aiBaseUrl ?? null,
    aiAuthToken: setting?.aiAuthToken ?? null,
    aiModel: setting?.aiModel ?? null,
  };
}

const sessions = new Map<string, ReturnType<typeof createAssistant>>();

const agent = {
  async chat(req: { conversationId?: string; text?: string; media?: { type?: string } }) {
    const text = req?.text?.trim() ?? "";
    const convId = req?.conversationId ?? "default";
    console.log(`[req] conv=${convId} textLen=${text.length} media=${req?.media?.type ?? "none"} text=${JSON.stringify(text.slice(0, 80))}`);
    try {
      if (!text) return { text: "暂时只能处理文字消息哦。" };
      let session = sessions.get(convId);
      if (!session) {
        session = createAssistant(await loadOpts());
        sessions.set(convId, session);
      }
      const reply = await session.handle(text);
      console.log(`[out] ${reply.slice(0, 300)}${reply.length > 300 ? "…" : ""}`);
      return { text: reply };
    } catch (e) {
      const msg = `bot 内部出错:${e instanceof Error ? e.message : String(e)}`;
      console.error(`[err] ${msg}`);
      return { text: msg };
    }
  },
};

async function main() {
  if (!(await isLoggedIn())) {
    console.log("未检测到登录,开始扫码…");
    await login();
  }
  console.log("=== AI客户经营助手 bot 已启动,等商家微信消息 ===");
  await start(agent);
}

main().catch((e) => {
  console.error("bot 启动失败:", e);
  process.exit(1);
});
