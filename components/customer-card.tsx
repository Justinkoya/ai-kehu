import Link from "next/link";
import type { Customer } from "@prisma/client";

export function CustomerCard({ c }: { c: Customer }) {
  let tags: string[] = [];
  try {
    tags = c.tags ? JSON.parse(c.tags) : [];
  } catch {}
  return (
    <Link
      href={`/customers/${c.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-400"
    >
      <div className="text-sm font-medium">{c.name}
        {c.riskNotes && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">有风险</span>}
      </div>
      {tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>
          ))}
        </div>
      )}
      {c.nextAction && <div className="mt-1.5 line-clamp-2 text-xs text-slate-700">{c.nextAction}</div>}
      {c.nextFollowDate && (
        <div className="mt-1 text-xs text-orange-600">
          跟进: {new Date(c.nextFollowDate).toISOString().slice(0, 10)}
        </div>
      )}
    </Link>
  );
}
