"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "今日跟进" },
  { href: "/dashboard", label: "看板" },
  { href: "/customers", label: "客户列表" },
  { href: "/settings", label: "设置" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-semibold text-slate-900">
          AI客户经营助手
        </Link>
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
