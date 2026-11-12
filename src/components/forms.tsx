"use client";

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui";
import type { ActionState } from "@/lib/types";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Formular legat de un Server Action: afișează erorile și confirmările ca notificări scurte. */
export function ActionForm({
  action, children, onDone, resetOnDone = true, successMessage, ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: Action; onDone?: (state: NonNullable<ActionState>) => void; resetOnDone?: boolean; successMessage?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    if (state.ok) {
      const msg = state.message ?? successMessage;
      if (msg) toast.success(msg);
      if (resetOnDone) ref.current?.reset();
      done.current?.(state);
    }
  }, [state, successMessage, resetOnDone]);

  return (
    <form ref={ref} action={formAction} {...props}>
      {children}
    </form>
  );
}

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Buton care cere confirmare înainte de a trimite formularul din care face parte. */
export function ConfirmSubmit({ confirm, children, ...props }: ButtonProps & { confirm: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      {...props}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
