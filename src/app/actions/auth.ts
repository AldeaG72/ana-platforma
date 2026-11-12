"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type { ActionState } from "@/lib/types";

const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/");

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Completează emailul și parola." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // deosebim datele greșite de o problemă de conexiune cu serviciul de autentificare
    const wrong = error.status === 400 || error.code === "invalid_credentials";
    if (!wrong) console.error("Autentificare eșuată:", error.message);
    return { error: wrong ? "Email sau parolă incorectă." : "Serviciul de autentificare nu răspunde. Încearcă din nou în câteva momente." };
  }
  redirect(safeNext(fd.get("next")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function acceptInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const needsPassword = fd.get("needs_password") === "1";
  if (!isUuid(token)) return { error: "Link de invitație invalid." };
  if (needsPassword) {
    if (password.length < 10) return { error: "Parola trebuie să aibă cel puțin 10 caractere." };
    if (password !== confirm) return { error: "Parolele nu coincid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_password: needsPassword ? password : null,
    p_full_name: String(fd.get("full_name") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  if (needsPassword) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password });
    if (signInError) redirect("/login");
  }
  revalidatePath("/", "layout");
  redirect(data.company_id ? `/f/${data.company_id}` : "/");
}

export async function updateAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const full_name = String(fd.get("full_name") ?? "").trim();
  if (full_name.length < 3) return { error: "Introdu numele complet." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesiune expirată." };
  const { error } = await supabase
    .from("profiles")
    .update({ full_name, phone: String(fd.get("phone") ?? "").trim() || null })
    .eq("id", auth.user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Datele au fost salvate." };
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 10) return { error: "Parola trebuie să aibă cel puțin 10 caractere." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Parolele nu coincid." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Parola nu a putut fi schimbată. Autentifică-te din nou și reîncearcă." };
  return { ok: true, message: "Parola a fost schimbată." };
}
