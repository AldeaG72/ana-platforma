"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Bell, Building2, CalendarCheck, ClipboardList, FileText, FolderOpen, LayoutDashboard, LineChart,
  LogOut, Menu, Settings, UserCog, Users, UsersRound, Clock, X, SlidersHorizontal,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export type ShellCompany = {
  id: string; name: string; accounting: boolean; hr: boolean; financials: boolean; users: boolean; settings: boolean;
};
type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

export function AppShell({
  companies, user, unread, children,
}: {
  companies: ShellCompany[];
  user: { name: string; role: string; isStaff: boolean; isSuperAdmin: boolean };
  unread: number;
  children: React.ReactNode;
}) {
  const params = useParams<{ cid?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const company = companies.find((c) => c.id === params.cid);
  const base = company ? `/f/${company.id}` : "";

  React.useEffect(() => setOpen(false), [pathname]);

  const groups: { title?: string; items: NavItem[] }[] = [];
  if (company) {
    groups.push({
      items: [
        { href: base, label: "Panou", icon: LayoutDashboard, exact: true },
        { href: `${base}/checklist`, label: "Checklist lunar", icon: CalendarCheck },
      ],
    });
    if (company.accounting) {
      groups.push({
        title: "Contabilitate",
        items: [
          { href: `${base}/contabilitate/documente`, label: "Documente", icon: FolderOpen },
          { href: `${base}/contabilitate/solicitari`, label: "Solicitări", icon: ClipboardList },
          ...(company.financials ? [{ href: `${base}/contabilitate/situatie`, label: "Situație financiară", icon: LineChart }] : []),
        ],
      });
    }
    if (company.hr) {
      groups.push({
        title: "HR & Payroll",
        items: [
          { href: `${base}/hr/pontaj`, label: "Pontaj", icon: Clock },
          { href: `${base}/hr/documente`, label: "Documente", icon: FileText },
          { href: `${base}/hr/solicitari`, label: "Solicitări", icon: ClipboardList },
          { href: `${base}/hr/angajati`, label: "Angajați", icon: UsersRound },
        ],
      });
    }
    const admin: NavItem[] = [];
    if (company.users) admin.push({ href: `${base}/utilizatori`, label: "Utilizatori", icon: Users });
    if (company.settings) admin.push({ href: `${base}/setari`, label: "Setări firmă", icon: Settings });
    if (admin.length) groups.push({ title: "Administrare", items: admin });
  }
  const global: NavItem[] = [];
  if (companies.length > 1 || user.isStaff) global.push({ href: "/", label: user.isStaff ? "Toate firmele" : "Firmele mele", icon: Building2, exact: true });
  if (user.isSuperAdmin) {
    global.push({ href: "/admin/echipa", label: "Echipa Gana", icon: UserCog });
    global.push({ href: "/admin/solicitari", label: "Tipuri de solicitări", icon: SlidersHorizontal });
  }
  if (global.length) groups.push({ title: company ? "Gana" : undefined, items: global });

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/" aria-label="Platforma Gana">
          <Image src="/brand/gana-horizontal-inverse.svg" alt="Gana Finance & Accounting" width={168} height={28} priority />
        </Link>
        <button className="rounded-md p-1 text-navy-100 lg:hidden" onClick={() => setOpen(false)} aria-label="Închide meniul">
          <X className="size-5" />
        </button>
      </div>

      {companies.length > 0 ? (
        <div className="px-4 pb-3">
          <label className="mb-1 block text-[11px] font-medium tracking-wider text-navy-100/60 uppercase" htmlFor="firma">Firma</label>
          {companies.length === 1 && company ? (
            <p className="truncate rounded-md bg-navy-800 px-3 py-2 text-sm font-medium">{company.name}</p>
          ) : (
            <select
              id="firma"
              className="w-full rounded-md border border-navy-700 bg-navy-800 px-3 py-2 text-sm font-medium text-white"
              value={company?.id ?? ""}
              onChange={(e) => router.push(e.target.value ? `/f/${e.target.value}` : "/")}
            >
              <option value="">Alege firma…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g, i) => (
          <div key={i} className="mt-4 first:mt-1">
            {g.title ? <p className="px-2 pb-1 text-[11px] font-medium tracking-wider text-gold-400 uppercase">{g.title}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-navy-100 transition-colors hover:bg-navy-800 hover:text-white",
                      isActive(item) && "bg-navy-800 font-medium text-white shadow-[inset_3px_0_0_var(--color-gold-500)]",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-navy-800 p-3">
        <Link href="/cont" className="block rounded-md px-2.5 py-2 hover:bg-navy-800">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-navy-100/70">{user.role}</p>
        </Link>
        <form action={logout}>
          <button className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm text-navy-100 hover:bg-navy-800 hover:text-white">
            <LogOut className="size-4" /> Ieșire din cont
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">{sidebar}</aside>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button className="rounded-md p-1.5 text-navy-900 hover:bg-navy-50 lg:hidden" onClick={() => setOpen(true)} aria-label="Deschide meniul">
            <Menu className="size-5" />
          </button>
          <p className="truncate text-sm font-medium text-navy-900">{company?.name ?? "Platforma Gana"}</p>
        </div>
        <Link href="/notificari" className="relative rounded-md p-2 text-navy-900 hover:bg-navy-50" aria-label={`Notificări (${unread} necitite)`}>
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute top-0.5 right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] leading-4.5 font-bold text-navy-950">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
