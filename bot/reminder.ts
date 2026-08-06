import { prisma } from "../lib/prisma";

// 本地时区的 YYYY-MM-DD(不用 toISOString,避免 UTC 偏移)
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMMDD(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 找出「今天到期或已逾期」且今天还没提醒过的客户,生成提醒文案。
// 返回 null 表示没有要提醒的。sendMessage 成功后才调用 markReminded。
export async function collectDue(): Promise<{ text: string; ids: string[] } | null> {
  const now = new Date();
  const todayStr = localDateStr(now);
  const customers = await prisma.customer.findMany({ where: { nextFollowDate: { not: null } } });

  const due = customers
    .filter((c) => localDateStr(c.nextFollowDate!) <= todayStr)
    .filter((c) => c.lastReminderDate !== todayStr);

  if (!due.length) return null;

  const lines = [`跟进提醒(今天 ${fmtMMDD(now)}):`];
  for (const c of due) {
    const tag = localDateStr(c.nextFollowDate!) < todayStr ? "[逾期]" : "[今天]";
    const parts = [tag, c.name, c.stage || "未分阶段", `原定 ${fmtMMDD(c.nextFollowDate!)}`];
    if (c.lastAction) parts.push(`上次:${c.lastAction}`);
    lines.push(parts.join(" · "));
  }
  lines.push("", "回复「XX 什么情况」看详情,「XX 的跟进话术」要话术。");
  return { text: lines.join("\n"), ids: due.map((c) => c.id) };
}

// 提醒已成功推送后,给这些客户打上「今天已提醒」,防每 5 分钟重复推
export async function markReminded(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const todayStr = localDateStr(new Date());
  await prisma.customer.updateMany({
    where: { id: { in: ids } },
    data: { lastReminderDate: todayStr },
  });
}
