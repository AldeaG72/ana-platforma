import Image from "next/image";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";

export const metadata = { title: "Autentificare" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; eroare?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
        <Image src="/brand/gana-horizontal-inverse.svg" alt="Gana Finance & Accounting" width={220} height={37} priority />
        <div>
          <p className="font-display text-4xl leading-tight font-semibold">
            Documentele, solicitările și raportările firmei tale, <span className="text-gold-400">într-un singur loc.</span>
          </p>
          <p className="mt-5 max-w-md text-navy-100/80">
            Contabilitate, HR și salarizare — fără emailuri pierdute și fără mesaje rătăcite.
          </p>
        </div>
        <p className="text-sm text-navy-100/60">© Gana Finance & Accounting</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Image src="/brand/gana-stacked-color.svg" alt="Gana Finance & Accounting" width={150} height={90} className="mb-8 lg:hidden" priority />
          <h1 className="text-3xl font-semibold text-navy-900">Autentificare</h1>
          <p className="mt-2 text-sm text-muted">Intră în contul tău de pe platforma Gana.</p>

          {sp.eroare === "cont" ? (
            <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
              Contul tău nu este activ. Contactează echipa Gana.
            </p>
          ) : null}

          <ActionForm action={login} resetOnDone={false} className="mt-8 flex flex-col gap-4">
            <input type="hidden" name="next" value={sp.next ?? "/"} />
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" required autoFocus />
            </Field>
            <Field label="Parolă">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton className="mt-2 w-full">Intră în cont</SubmitButton>
          </ActionForm>

          <p className="mt-6 text-sm text-muted">
            Conturile se creează doar pe bază de invitație. Dacă ai uitat parola, cere echipei Gana un link de resetare.
          </p>
        </div>
      </section>
    </main>
  );
}
