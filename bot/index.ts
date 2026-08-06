import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { login, start, isLoggedIn } from "weixin-agent-sdk";
import { prisma } from "../lib/prisma";
import { createAssistant, type AssistantOpts } from "../lib/assistant";
import { coreContext, loadDocs } from "../lib/knowledge";
import { collectDue, markReminded } from "./reminder";

// 设置页配置优先,未配则回落到 .env(ANTHROPIC_*)
async function loadOpts(): Promise<AssistantOpts> {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const docs = await loadDocs();
  return {
    productContext: coreContext(docs),
    aiBaseUrl: setting?.aiBaseUrl ?? null,
    aiAuthToken: setting?.aiAuthToken ?? null,
    aiModel: setting?.aiModel ?? null,
    botName: setting?.botName ?? null,
    welcomeMessage: setting?.welcomeMessage ?? null,
    knowledgeDocs: docs,
  };
}

// 心跳:周期写 bot/.status.json,web 端 /api/bot/status 据此判断在线/离线
const STATUS_FILE = path.join(__dirname, ".status.json");
let statusName = "";
let messageCount = 0;

function writeStatus() {
  try {
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({
        online: true,
        name: statusName,
        pid: process.pid,
        messageCount,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.error("[heartbeat] 写状态失败:", e);
  }
}

const sessions = new Map<string, ReturnType<typeof createAssistant>>();

const agent = {
  async chat(req: { conversationId?: string; text?: string; media?: { type?: string } }) {
    const text = req?.text?.trim() ?? "";
    const convId = req?.conversationId ?? "default";
    messageCount++;
    console.log(`[req] conv=${convId} textLen=${text.length} media=${req?.media?.type ?? "none"} text=${JSON.stringify(text.slice(0, 80))}`);
    try {
      if (!text) return { text: "暂时只能处理文字消息哦。" };
      const opts = await loadOpts();
      let session = sessions.get(convId);
      if (!session) {
        session = createAssistant(opts);
        sessions.set(convId, session);
      } else {
        // 设置页改动后,下一条消息立即生效
        session.setOpts(opts);
      }
      statusName = opts.botName || "";
      const reply = await session.handle(text);
      console.log(`[out] ${reply.slice(0, 300)}${reply.length > 300 ? "…" : ""}`);
      // 聊天落库(失败只记日志,不影响回复)
      try {
        await prisma.chatMessage.createMany({
          data: [
            { conversationId: convId, role: "user", content: text },
            { conversationId: convId, role: "assistant", content: reply },
          ],
        });
      } catch (e) {
        console.error("[chat] 落库失败:", e);
      }
      return { text: reply };
    } catch (e) {
      const msg = `bot 内部出错:${e instanceof Error ? e.message : String(e)}`;
      console.error(`[err] ${msg}`);
      return { text: msg };
    }
  },
};

// 跟进提醒轮询:每 5 分钟扫一次今天到期/逾期的客户,主动推送提醒。
// sendMessage 需要商家近期发过消息才有会话凭证;失败不标记,下轮重试。
function startReminderLoop(bot: { sendMessage: (message: string) => Promise<void> }) {
  const check = async () => {
    try {
      const due = await collectDue();
      if (!due) return;
      await bot.sendMessage(due.text);
      await markReminded(due.ids);
      console.log(`[reminder] 已推送 ${due.ids.length} 个跟进提醒`);
    } catch (e) {
      console.error("[reminder] 推送失败(下轮重试):", e instanceof Error ? e.message : String(e));
    }
  };
  setInterval(check, 5 * 60_000);
  setTimeout(check, 30_000); // 启动后先试一次,免得等 5 分钟
}

async function main() {
  if (!(await isLoggedIn())) {
    console.log("未检测到登录,开始扫码…");
    await login();
  }
  const opts = await loadOpts();
  statusName = opts.botName || "";
  writeStatus();
  setInterval(writeStatus, 30_000);
  console.log(`=== AI客户经营助手 bot 已启动(${statusName || "小助理"}),等商家微信消息 ===`);
  const bot = await start(agent);
  startReminderLoop(bot);
}

main().catch((e) => {
  console.error("bot 启动失败:", e);
  process.exit(1);
});
