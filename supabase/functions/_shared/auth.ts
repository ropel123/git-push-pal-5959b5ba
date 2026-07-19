// _shared/auth.ts — gardes d'authentification partagées pour les edge functions.
//
// SOFT-ENABLE : sharedSecretOk est désactivée tant que le secret INGEST_SECRET
// n'est pas défini sur le projet (warning + requête autorisée), afin de ne pas
// casser les crons / pipelines d'ingestion déjà en production. Pour activer la
// garde : définir INGEST_SECRET dans les secrets Supabase, redéployer, puis
// ajouter le header `x-ingest-secret: <valeur>` aux appelants internes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Garde par secret partagé (header `x-ingest-secret`).
 * Si INGEST_SECRET n'est pas défini/vide → soft-enable : warning + `true`.
 */
export function sharedSecretOk(req: Request): boolean {
  const secret = Deno.env.get("INGEST_SECRET");
  if (!secret) {
    console.warn("[auth] INGEST_SECRET not set — shared-secret guard disabled");
    return true;
  }
  return req.headers.get("x-ingest-secret") === secret;
}

/** Vrai si le Bearer token est la clé service_role du projet (appels internes). */
export function isServiceRole(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return false;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === serviceKey;
}

export type AuthedUser = { id: string; email?: string | null };

/**
 * Retourne l'utilisateur authentifié à partir du Bearer token, ou null.
 * Ne lance jamais : toute erreur (token invalide, réseau) → null.
 */
export async function getAuthedUser(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !supabaseUrl || !anonKey) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error } = await anonClient.auth.getUser(token);
    if (error || !user) return null;
    return user as AuthedUser;
  } catch {
    return null;
  }
}
