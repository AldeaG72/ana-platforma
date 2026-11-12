import { RequestsBoard } from "@/components/requests-board";
import { requireArea } from "@/lib/session";

export const metadata = { title: "Solicitări" };

export default async function Page({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<{ arata?: string }> }) {
  const ctx = await requireArea((await params).cid, "hr");
  const filter = (await searchParams).arata === "toate" ? "toate" : "deschise";
  return <RequestsBoard ctx={ctx} area="hr" filter={filter} />;
}
