import { changePassword, updateAccount } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/session";

export const metadata = { title: "Contul meu" };

export default async function AccountPage() {
  const { profile } = await getSession();
  return (
    <>
      <PageHeader title="Contul meu" description={profile.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="self-start">
          <CardHeader title="Date personale" />
          <ActionForm action={updateAccount} resetOnDone={false} className="flex flex-col gap-4 p-5">
            <Field label="Nume și prenume"><Input name="full_name" defaultValue={profile.full_name} required /></Field>
            <Field label="Telefon"><Input name="phone" defaultValue={profile.phone ?? ""} /></Field>
            <div className="flex justify-end"><SubmitButton>Salvează</SubmitButton></div>
          </ActionForm>
        </Card>
        <Card className="self-start">
          <CardHeader title="Schimbă parola" />
          <ActionForm action={changePassword} className="flex flex-col gap-4 p-5">
            <Field label="Parolă nouă" hint="Cel puțin 10 caractere."><Input name="password" type="password" minLength={10} required autoComplete="new-password" /></Field>
            <Field label="Confirmă parola"><Input name="confirm" type="password" minLength={10} required autoComplete="new-password" /></Field>
            <div className="flex justify-end"><SubmitButton>Schimbă parola</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
