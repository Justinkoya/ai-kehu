"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BOT_NAME } from "@/lib/constants";

const LINKS = [
  { href: "/", label: "今日跟进" },
  { href: "/dashboard", label: "看板" },
  { href: "/customers", label: "客户列表" },
  { href: "/chat-history", label: "聊天记录" },
  { href: "/knowledge", label: "知识库" },
  { href: "/settings", label: "设置" },
];

type BotStatus = { online: boolean; name: string | null };

export function NavBar() {
  const pathname = usePathname();
  const [bot, setBot] = useState<BotStatus>({ online: false, name: null });

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/bot/status")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setBot({ online: !!d.online, name: d.name ?? null });
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-slate-900">
            AI客户经营助手
          </Link>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
              bot.online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
            title={bot.online ? "微信机器人在线" : "微信机器人未启动(用 start-bot.bat 启动)"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${bot.online ? "bg-emerald-500" : "bg-slate-400"}`} />
            {bot.online ? `${bot.name || BOT_NAME} 在线` : "机器人离线"}
          </span>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 ${
                  active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/customers/new"
            className="ml-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + 新客户
          </Link>
        </nav>
      </div>
    </header>
  );
}
