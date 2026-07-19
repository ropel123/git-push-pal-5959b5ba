// _shared/subscription.ts — garde d'abonnement "soft" (S5).
//
// DÉSACTIVÉE PAR DÉFAUT : tant que le secret ENFORCE_SUBSCRIPTION n'est pas
// exactement "true", cette fonction retourne toujours true et le comportement
// de l'application est inchangé.
//
// POUR ACTIVER : définir ENFORCE_SUBSCRIPTION=true dans les secrets du projet
// Supabase puis redéployer les fonctions. Les endpoints IA (analyze-tender,
// generate-tender-document, generate-pricing-strategy) et fetch-dce-agent
// renverront alors 402 aux utilisateurs sans abonnement actif — c'est-à-dire
// sans ligne `subscriptions` avec status in ('active','trialing') et
// current_period_end > now(). Les admins (user_roles.role = 'admin') sont
// toujours autorisés.

// deno-lint-ignore no-explicit-any
type SupabaseLike = { from: (table: string) => any };

export async function requireActiveSubscription(
  supabaseAdmin: SupabaseLike,
  userId: string,
): Promise<boolean> {
  if (Deno.env.get("ENFORCE_SUBSCRIPTION") !== "true") return true;

  try {
    // Les admins sont toujours autorisés.
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminRole) return true;

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    return Boolean(sub);
  } catch (e) {
    // Fail-open : une erreur DB ne doit pas bloquer un utilisateur légitime.
    console.warn("[subscription] check failed:", e instanceof Error ? e.message : String(e));
    return true;
  }
}
