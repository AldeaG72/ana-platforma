import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-semibold">Pagină indisponibilă</h1>
      <p className="max-w-md text-sm text-muted">Pagina nu există sau nu ai permisiunea de a o vedea.</p>
      <Button asChild className="mt-2"><Link href="/">Înapoi la platformă</Link></Button>
    </main>
  );
}
