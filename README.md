# Platforma Gana

Portalul clienților Gana Finance & Accounting (`platforma.ganaaccounting.ro`): documente, solicitări și raportări pentru contabilitate, HR și salarizare.

## Tehnologii

Next.js 15 (App Router, Server Components, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, RLS) · Vercel.

## Pornire locală

```bash
cp .env.example .env.local   # completează cheia publică din Supabase → Settings → API
npm install
npm run dev
```

## Cum este organizat

| Loc | Conținut |
|---|---|
| `src/app/(app)` | Paginile aplicației; `f/[cid]/…` sunt paginile unei firme |
| `src/app/actions` | Server Actions (autentificare, flux de lucru, administrare) |
| `src/components` | Componente de interfață și blocuri comune (documente, solicitări, discuții) |
| `src/lib/session.ts` | Sesiunea, firmele și drepturile utilizatorului curent |
| `supabase/migrations` | Schema bazei de date, regulile RLS și triggerele |

## Principii de securitate

- Aplicația folosește doar cheia publică Supabase. Tot accesul la date este decis de regulile RLS din baza de date; interfața doar oglindește aceleași reguli.
- Fișierele se încarcă direct din browser în Supabase Storage (bucket privat `documente`) și se descarcă prin linkuri semnate, valabile 60 de secunde.
- Conturile se creează doar prin invitație. Platforma nu trimite emailuri: linkul de invitație sau de resetare se transmite manual.
- Clienții pot doar trimite documente; înlocuirea și ștergerea le face echipa Gana și rămân în jurnalul de audit.
