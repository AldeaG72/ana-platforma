import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase pentru Server Components și Server Actions. Rulează cu sesiunea utilizatorului, deci sub RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // apelat dintr-un Server Component: middleware-ul reîmprospătează sesiunea
          }
        },
      },
    },
  );
}
