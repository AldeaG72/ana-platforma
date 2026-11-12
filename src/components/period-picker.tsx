"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/utils";

export function PeriodPicker({ year, month, yearOnly }: { year: number; month: number; yearOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 2019 }, (_, i) => thisYear + 1 - i).filter((y) => y <= thisYear || y === year);

  const go = (y: number, m: number) => {
    const next = new URLSearchParams(sp);
    next.set("an", String(y));
    next.set("luna", String(m));
    router.push(`${pathname}?${next}`);
  };
  const step = (d: number) => {
    if (yearOnly) return go(year + d, month);
    const idx = year * 12 + (month - 1) + d;
    go(Math.floor(idx / 12), (idx % 12) + 1);
  };
  const cls = "h-9 rounded-md border border-line bg-white px-2 text-sm font-medium text-navy-900";

  return (
    <div className="flex items-center gap-1.5">
      <button className={`${cls} cursor-pointer px-1.5 hover:bg-navy-50`} onClick={() => step(-1)} aria-label="Perioada anterioară"><ChevronLeft className="size-4" /></button>
      {!yearOnly ? (
        <select className={cls} value={month} onChange={(e) => go(year, Number(e.target.value))} aria-label="Luna">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      ) : null}
      <select className={cls} value={year} onChange={(e) => go(Number(e.target.value), month)} aria-label="Anul">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button className={`${cls} cursor-pointer px-1.5 hover:bg-navy-50`} onClick={() => step(1)} aria-label="Perioada următoare"><ChevronRight className="size-4" /></button>
    </div>
  );
}
