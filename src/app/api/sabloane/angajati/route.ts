import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

const EMPLOYEE_COLUMNS = [
  "Nume", "Prenume", "CNP", "Funcție", "Departament", "Nr. contract", "Data contract", "Tip contract",
  "Normă (ore/zi)", "Data angajării", "Serie CI", "Număr CI", "Adresă", "Email", "Telefon",
];

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response("Neautorizat", { status: 401 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Angajați");
  ws.addRow(EMPLOYEE_COLUMNS);
  ws.addRow(["Popescu", "Ion", "1900101123456", "Economist", "Financiar", "12", "01.03.2022", "Nedeterminată", 8, "01.03.2022", "RX", "123456", "Str. Exemplu nr. 1, București", "ion.popescu@exemplu.ro", "0722000000"]);
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1F3A" } };
  });
  ws.columns.forEach((c) => { c.width = 20; });
  ws.getColumn(3).numFmt = "@";
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const notes = wb.addWorksheet("Instrucțiuni");
  notes.addRows([
    ["Completează câte un angajat pe rând în foaia „Angajați”. Nu modifica și nu reordona capul de tabel."],
    ["Rândul 2 este un exemplu: șterge-l înainte de import."],
    ["Datele se scriu în formatul ZZ.LL.AAAA. CNP-ul trebuie să aibă 13 cifre."],
    ["Dacă un CNP există deja în platformă, angajatul este actualizat, nu dublat."],
  ]);
  notes.getColumn(1).width = 110;

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sablon-import-angajati.xlsx"',
    },
  });
}
