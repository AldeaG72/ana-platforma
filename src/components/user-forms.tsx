"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { inviteClientUser, inviteStaff, createResetLink, updateMember } from "@/app/actions/manage";
import { Dialog } from "@/components/dialog";
import { CopyLink } from "@/components/doc-actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Button, Field, Input, Select } from "@/components/ui";
import { CLIENT_ROLE_LABEL, INTERNAL_ROLE_LABEL, PERMISSIONS, ROLE_PRESETS, type ActionState, type ClientRole, type Perms } from "@/lib/types";

/** Rolul alege o presetare; fiecare permisiune poate fi apoi bifată sau debifată individual. */
function PermissionFields({ initialRole, initial }: { initialRole: ClientRole; initial?: Perms }) {
  const [role, setRole] = React.useState<ClientRole>(initialRole);
  const [perms, setPerms] = React.useState<Perms>(initial ?? ROLE_PRESETS[initialRole]);
  return (
    <>
      <Field label="Rol" hint="Rolul completează permisiunile de mai jos; le poți ajusta individual.">
        <Select name="role" value={role} onChange={(e) => { const r = e.target.value as ClientRole; setRole(r); setPerms(ROLE_PRESETS[r]); }}>
          {Object.entries(CLIENT_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <fieldset className="flex flex-col gap-2.5 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium text-navy-900">Permisiuni</legend>
        {PERMISSIONS.map((p) => (
          <label key={p.key} className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" name={p.key} className="mt-0.5 size-4 accent-navy-900" checked={perms[p.key]}
              onChange={(e) => setPerms({ ...perms, [p.key]: e.target.checked })} />
            <span><span className="block text-sm font-medium text-navy-900">{p.label}</span><span className="block text-xs text-muted">{p.hint}</span></span>
          </label>
        ))}
      </fieldset>
    </>
  );
}

function LinkResult({ state, what }: { state: NonNullable<ActionState>; what: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-navy-900">
        {what} pentru <strong>{state.data?.email}</strong> a fost creat. Platforma nu trimite emailuri: copiază linkul și trimite-l persoanei pe un canal sigur.
      </p>
      <CopyLink path={state.data?.link ?? ""} />
    </div>
  );
}

export function InviteClientDialog({ companyId }: { companyId: string }) {
  const [result, setResult] = React.useState<NonNullable<ActionState> | null>(null);
  return (
    <Dialog title="Invită un utilizator" description="Persoana își creează singură parola din linkul de invitație (valabil 14 zile)."
      trigger={<Button onClick={() => setResult(null)}><UserPlus /> Invită utilizator</Button>}>
      {result ? <LinkResult state={result} what="Linkul de invitație" /> : (
        <ActionForm action={inviteClientUser} onDone={setResult} className="flex flex-col gap-4">
          <input type="hidden" name="company_id" value={companyId} />
          <Field label="Nume și prenume"><Input name="full_name" /></Field>
          <Field label="Email *"><Input name="email" type="email" required /></Field>
          <PermissionFields initialRole="client_operational" />
          <div className="flex justify-end"><SubmitButton>Creează invitația</SubmitButton></div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function EditMemberDialog({ companyId, userId, name, role, perms }: { companyId: string; userId: string; name: string; role: ClientRole; perms: Perms }) {
  return (
    <Dialog title={`Permisiuni — ${name}`} trigger={<Button variant="outline" size="sm">Permisiuni</Button>}>
      <ActionForm action={updateMember} resetOnDone={false} className="flex flex-col gap-4">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="user_id" value={userId} />
        <PermissionFields initialRole={role} initial={perms} />
        <div className="flex justify-end"><SubmitButton>Salvează</SubmitButton></div>
      </ActionForm>
    </Dialog>
  );
}

export function InviteStaffDialog() {
  const [result, setResult] = React.useState<NonNullable<ActionState> | null>(null);
  return (
    <Dialog title="Invită un coleg" trigger={<Button onClick={() => setResult(null)}><UserPlus /> Invită coleg</Button>}>
      {result ? <LinkResult state={result} what="Linkul de invitație" /> : (
        <ActionForm action={inviteStaff} onDone={setResult} className="flex flex-col gap-4">
          <Field label="Nume și prenume"><Input name="full_name" /></Field>
          <Field label="Email *"><Input name="email" type="email" required /></Field>
          <Field label="Rol">
            <Select name="internal_role" defaultValue="contabil">
              {Object.entries(INTERNAL_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end"><SubmitButton>Creează invitația</SubmitButton></div>
        </ActionForm>
      )}
    </Dialog>
  );
}

export function ResetPasswordDialog({ email }: { email: string }) {
  const [result, setResult] = React.useState<NonNullable<ActionState> | null>(null);
  return (
    <Dialog title="Resetare parolă" description="Generează un link de unică folosință, valabil 48 de ore."
      trigger={<Button variant="ghost" size="sm" onClick={() => setResult(null)}>Resetează parola</Button>}>
      {result ? <LinkResult state={result} what="Linkul de resetare" /> : (
        <ActionForm action={createResetLink} onDone={setResult} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={email} />
          <p className="text-sm">Creezi un link de resetare pentru <strong>{email}</strong>?</p>
          <div className="flex justify-end"><SubmitButton>Generează linkul</SubmitButton></div>
        </ActionForm>
      )}
    </Dialog>
  );
}
