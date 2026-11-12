"use client";

import * as React from "react";
import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Ctx = { close: () => void };
const DialogCtx = React.createContext<Ctx>({ close: () => {} });
export const useDialog = () => React.useContext(DialogCtx);

export function Dialog({
  trigger, title, description, children, wide,
}: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <RD.Root open={open} onOpenChange={setOpen}>
      <RD.Trigger asChild>{trigger}</RD.Trigger>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-navy-950/50" />
        <RD.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-white p-6 shadow-xl",
            wide ? "max-w-2xl" : "max-w-lg",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RD.Title className="font-display text-xl font-semibold text-navy-900">{title}</RD.Title>
              {description ? <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description> : null}
            </div>
            <RD.Close className="rounded-md p-1 text-muted hover:bg-navy-50" aria-label="Închide">
              <X className="size-5" />
            </RD.Close>
          </div>
          <DialogCtx.Provider value={{ close: () => setOpen(false) }}>{children}</DialogCtx.Provider>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
