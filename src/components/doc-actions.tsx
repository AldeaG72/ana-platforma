"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDownloadUrl } from "@/app/actions/work";
import { Button } from "@/components/ui";

export function DownloadButton({ id, label }: { id: string; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={label ? "outline" : "ghost"}
      size={label ? "md" : "icon"}
      disabled={pending}
      aria-label="Descarcă"
      title="Descarcă"
      onClick={() =>
        start(async () => {
          const res = await getDownloadUrl(id);
          if (res.url) window.location.assign(res.url);
          else toast.error(res.error ?? "Descărcarea a eșuat.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  );
}

/** Afișează un link de invitație / resetare, cu buton de copiere. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className="h-9 min-w-0 flex-1 rounded-md border border-line bg-navy-50 px-2 text-xs text-navy-900" onFocus={(e) => e.target.select()} />
      <Button
        type="button" variant="outline" size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copiat" : "Copiază"}
      </Button>
    </div>
  );
}
