// _shared/rateLimit.ts — rate limiting par utilisateur via la table
// ai_request_log (colonnes : id, user_id uuid, fn text, created_at).
//
// Fenêtre glissante d'une heure : on compte les requêtes récentes de
// l'utilisateur pour la fonction donnée ; si la limite n'est pas atteinte,
// la requête courante est journalisée puis autorisée.
// (Pattern extrait de generate-memoir — comportement identique.)

// Client Supabase typé structurellement pour rester compatible avec les
// différentes versions de supabase-js utilisées par les fonctions.
// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export async function checkRateLimit(
  supabaseAdmin: SupabaseLike,
  userId: string,
  fn: string,
  maxPerHour = 60,
): Promise<{ ok: boolean; count: number }> {
  try {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("ai_request_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("fn", fn)
      .gte("created_at", oneHourAgo);
    const recent = count ?? 0;
    if (recent >= maxPerHour) {
      return { ok: false, count: recent };
    }
    await supabaseAdmin.from("ai_request_log").insert({ user_id: userId, fn });
    return { ok: true, count: recent + 1 };
  } catch (e) {
    // Fail-open : une erreur de journalisation ne doit pas bloquer l'utilisateur.
    console.warn(`[rateLimit] check failed fn=${fn}:`, e instanceof Error ? e.message : String(e));
    return { ok: true, count: 0 };
  }
}
