import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MONTHS, isUuid, sanitizeFileName } from "@/lib/utils";

const NAVY = "FF0B1F3A";
const GOLD = "FFF5ECD7";
const WEEKEND = "FFE4E1D8";

/** Șablonul de pontaj al lunii, precompletat cu angajații activi ai firmei (RLS decide cine îl poate genera). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const companyId = sp.get("firma");
  const year = Number(sp.get("an"));
  const month = Number(sp.get("luna"));
  if (!isUuid(companyId) || !(year >= 2015 && year <= 2100) || !(month >= 1 && month <= 12)) return new Response("Parametri invalizi", { status: 400 });

  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("name, cui").eq("id", companyId).maybeSingle();
  if (!company) return new Response("Neautorizat", { status: 403 });
  const { data: employees } = await supabase.from("employees").select("last_name, first_name, job_title, work_hours, hire_date, end_date")
    .eq("company_id", companyId).neq("status", "incetat").order("last_name");

  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isWeekend = (d: number) => [0, 6].includes(new Date(Date.UTC(year, month - 1, d)).getUTCDay());
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pontaj", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  const lastCol = 4 + days + 4;

  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell(1, 1).value = `FOAIE COLECTIVĂ DE PREZENȚĂ (PONTAJ) — ${MONTHS[month - 1].toUpperCase()} ${year}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell(2, 1).value = `${company.name}${company.cui ? ` · CUI ${company.cui}` : ""}`;

  const header = ["Nr.", "Nume și prenume", "Funcție", "Normă", ...Array.from({ length: days }, (_, i) => i + 1), "Total ore", "CO (zile)", "CM (zile)", "Absențe (zile)"];
  const head = ws.getRow(4);
  header.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  head.height = 30;

  const list = employees?.length ? employees : Array.from({ length: 10 }, () => null);
  list.forEach((e, idx) => {
    const r = 5 + idx;
    const row = ws.getRow(r);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = e ? `${e.last_name} ${e.first_name}` : "";
    row.getCell(3).value = e?.job_title ?? "";
    row.getCell(4).value = e?.work_hours ? Number(e.work_hours) : "";
    const first = ws.getColumn(5).letter, last = ws.getColumn(4 + days).letter;
    row.getCell(5 + days).value = { formula: `SUM(${first}${r}:${last}${r})` };
    row.getCell(6 + days).value = { formula: `COUNTIF(${first}${r}:${last}${r},"CO")` };
    row.getCell(7 + days).value = { formula: `COUNTIF(${first}${r}:${last}${r},"CM")` };
    row.getCell(8 + days).value = { formula: `COUNTIF(${first}${r}:${last}${r},"N")+COUNTIF(${first}${r}:${last}${r},"CFS")` };
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (c > 4) cell.alignment = { horizontal: "center" };
      if (c > 4 && c <= 4 + days && isWeekend(c - 4)) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEKEND } };
      if (c > 4 + days) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    }
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 7;
  for (let d = 1; d <= days; d++) ws.getColumn(4 + d).width = 4.5;
  for (let c = 5 + days; c <= lastCol; c++) ws.getColumn(c).width = 10;
  ws.views = [{ state: "frozen", xSplit: 4, ySplit: 4 }];

  const legendRow = 5 + list.length + 1;
  [
    "Cum se completează: în fiecare zi lucrată se trec orele lucrate (ex. 8). Pentru zilele nelucrate se folosesc codurile:",
    "CO = concediu de odihnă · CM = concediu medical · CFS = concediu fără salariu · N = absență nemotivată · LP = liber plătit · D = delegație (se trec orele)",
    "Zilele de weekend sunt marcate cu gri. Sărbătorile legale se lasă necompletate dacă nu s-a lucrat.",
    "Atașează în platformă documentele justificative: cereri de concediu, certificate medicale, decizii.",
    "Întocmit de: ____________________    Data: ____________    Semnătura: ____________________",
  ].forEach((t, i) => {
    ws.mergeCells(legendRow + i, 1, legendRow + i, lastCol);
    ws.getCell(legendRow + i, 1).value = t;
    ws.getCell(legendRow + i, 1).font = { size: 9, italic: i < 4 };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const file = `pontaj-${sanitizeFileName(company.name)}-${year}-${String(month).padStart(2, "0")}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
