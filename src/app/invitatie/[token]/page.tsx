import Image from "next/image";
import Link from "next/link";
import { acceptInvitation } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button, Card, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata = { title: "Invitație" };

type Info = { valid: boolean; reason?: string; kind?: "client" | "staff" | "resetare"; email?: string; full_name?: string; company_name?: string; has_account?: boolean };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = isUuid(token) ? await supabase.rpc("invitation_info", { p_token: token }) : { data: null };
  const info: Info = data ?? { valid: false, reason: "Link de invitație invalid." };

  const isReset = info.kind === "resetare";
  const needsPassword = isReset || !info.has_account;
  const loggedInAsInvitee = !!auth.user && auth.user.email?.toLowerCase() === info.email?.toLowerCase();

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Image src="/brand/gana-stacked-color.svg" alt="Gana Finance & Accounting" width={150} height={90} className="mx-auto mb-8" priority />
        <Card className="p-6">
          {!info.valid ? (
            <>
              <h1 className="text-2xl font-semibold">Invitație indisponibilă</h1>
              <p className="mt-2 text-sm text-muted">{info.reason} Cere un link nou persoanei care te-a invitat.</p>
              <Button asChild variant="outline" className="mt-6"><Link href="/login">Mergi la autentificare</Link></Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{isReset ? "Setează o parolă nouă" : "Bine ai venit"}</h1>
              <p className="mt-2 text-sm text-muted">
                {isReset
                  ? <>Alege o parolă nouă pentru contul <strong>{info.email}</strong>.</>
                  : info.kind === "staff"
                    ? <>Ai fost invitat în echipa Gana cu adresa <strong>{info.email}</strong>.</>
                    : <>Ai primit acces la firma <strong>{info.company_name}</strong> cu adresa <strong>{info.email}</strong>.</>}
              </p>

              {!needsPassword && !loggedInAsInvitee ? (
                <div className="mt-6">
                  <p className="text-sm">Ai deja un cont pe platformă. Autentifică-te, apoi vei reveni aici pentru a accepta invitația.</p>
                  <Button asChild className="mt-4"><Link href={`/login?next=/invitatie/${token}`}>Autentifică-te</Link></Button>
                </div>
              ) : (
                <ActionForm action={acceptInvitation} resetOnDone={false} className="mt-6 flex flex-col gap-4">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="needs_password" value={needsPassword ? "1" : "0"} />
                  {needsPassword && !isReset ? (
                    <Field label="Nume și prenume">
                      <Input name="full_name" defaultValue={info.full_name ?? ""} required minLength={3} autoComplete="name" />
                    </Field>
                  ) : null}
                  {needsPassword ? (
                    <>
                      <Field label="Parolă" hint="Cel puțin 10 caractere.">
                        <Input name="password" type="password" required minLength={10} autoComplete="new-password" />
                      </Field>
                      <Field label="Confirmă parola">
                        <Input name="confirm" type="password" required minLength={10} autoComplete="new-password" />
                      </Field>
                    </>
                  ) : null}
                  <SubmitButton className="w-full">
                    {isReset ? "Salvează parola" : needsPassword ? "Creează contul" : "Acceptă invitația"}
                  </SubmitButton>
                </ActionForm>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
