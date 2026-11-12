import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export function periodLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

const dateFmt = new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Bucharest" });
const dateTimeFmt = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest",
});
const moneyFmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return dateFmt.format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return dateTimeFmt.format(new Date(value));
}

export function formatMoney(value: number | string | null | undefined) {
  return `${moneyFmt.format(Number(value ?? 0))} lei`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Perioada curentă în fusul orar al României. */
export function currentPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "numeric" }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value),
  };
}

/** Luna de lucru implicită: luna anterioară (cea pentru care se strâng documentele). */
export function workPeriod() {
  const now = currentPeriod();
  return now.month === 1 ? { year: now.year - 1, month: 12 } : { year: now.year, month: now.month - 1 };
}

/** Citește ?an=&luna= din URL; implicit luna de lucru. */
export function parsePeriod(sp: Record<string, string | string[] | undefined>) {
  const now = currentPeriod();
  const def = workPeriod();
  const year = Number(sp.an);
  const month = Number(sp.luna);
  return {
    year: Number.isInteger(year) && year >= 2015 && year <= now.year + 1 ? year : def.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : def.month,
  };
}

export function sanitizeFileName(name: string) {
  const cleaned = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-120) || "fisier";
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
