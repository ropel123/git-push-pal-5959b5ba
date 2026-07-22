// Moteur d'alertes email : matche les alertes actives (mots-clés) contre les
// nouveaux AO et envoie un récapitulatif via Resend. Invoqué par cron horaire —
// idempotent : last_sent_at + intervalle minimal par fréquence empêchent tout
// doublon si le cron re-tourne ou si la fonction est appelée à la main.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API = "https://api.resend.com/emails";
const FROM = "HackAO <alertes@hackao.com>";
const APP_URL = (Deno.env.get("APP_BASE_URL") ?? "https://hackao.com").replace(/\/$/, "");

// Intervalle minimal entre deux envois d'une même alerte, en heures.
const MIN_INTERVAL_H: Record<string, number> = { daily: 20, weekly: 6.5 * 24 };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "non précisée";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "non précisée";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY manquant — à créer dans Supabase > Edge Functions > Secrets" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: alerts, error: aErr } = await supabase.from("alerts").select("*").eq("enabled", true);
  if (aErr) {
    return new Response(JSON.stringify({ error: aErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, errors = 0;

  for (const alert of alerts ?? []) {
    try {
      const freq = alert.frequency === "weekly" ? "weekly" : "daily";
      const lastMs = alert.last_sent_at ? new Date(alert.last_sent_at).getTime() : 0;
      if (Date.now() - lastMs < MIN_INTERVAL_H[freq] * 3_600_000) { skipped++; continue; }

      const kws: string[] = Array.isArray((alert.filters as { keywords?: unknown })?.keywords)
        ? ((alert.filters as { keywords: unknown[] }).keywords)
            .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        : [];
      if (kws.length === 0) { skipped++; continue; }

      // Fenêtre de recherche : depuis le dernier envoi, bornée à 7 jours.
      const since = new Date(Math.max(lastMs, Date.now() - 7 * 86_400_000)).toISOString();
      // Les virgules/parenthèses casseraient la syntaxe .or() de PostgREST.
      const orExpr = kws
        .map((k) => k.replace(/[%_,()]/g, " ").trim())
        .filter(Boolean)
        .map((s) => `title.ilike.%${s}%,description.ilike.%${s}%`)
        .join(",");

      const { data: matches, error: mErr } = await supabase.from("tenders")
        .select("id,title,buyer_name,deadline,publication_date")
        .eq("status", "open")
        .gte("created_at", since)
        .or(orExpr)
        .order("created_at", { ascending: false })
        .limit(20);
      if (mErr) { errors++; console.error("match error", alert.id, mErr); continue; }
      if (!matches || matches.length === 0) { skipped++; continue; }

      const { data: u, error: uErr } = await supabase.auth.admin.getUserById(alert.user_id);
      const email = u?.user?.email;
      if (uErr || !email) { errors++; console.error("user lookup", alert.id, uErr); continue; }

      const items = matches.map((t) => `
        <li style="margin-bottom:12px">
          <a href="${APP_URL}/tenders/${t.id}" style="color:#F97316;font-weight:600;text-decoration:none">${esc(t.title ?? "Sans titre")}</a><br>
          <span style="color:#64748b;font-size:13px">${esc(t.buyer_name ?? "Acheteur non précisé")} — date limite : ${fmtDate(t.deadline)}</span>
        </li>`).join("");

      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#1E293B">🔔 ${matches.length} nouvel${matches.length > 1 ? "s" : ""} appel${matches.length > 1 ? "s" : ""} d'offres — ${esc(alert.name)}</h2>
          <p style="color:#334155">Mots-clés : ${esc(kws.join(", "))}</p>
          <ul style="list-style:none;padding:0">${items}</ul>
          <p style="margin-top:24px"><a href="${APP_URL}/tenders" style="color:#F97316">Voir tous les appels d'offres →</a></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:32px">Vous recevez cet email car vous avez créé l'alerte « ${esc(alert.name)} » sur HackAO. Gérez vos alertes dans <a href="${APP_URL}/alerts" style="color:#94a3b8">votre espace</a>.</p>
        </div>`;

      const resp = await fetch(RESEND_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: `${matches.length} nouveau${matches.length > 1 ? "x" : ""} AO pour « ${alert.name} »`,
          html,
        }),
      });
      if (!resp.ok) { errors++; console.error("resend", resp.status, await resp.text()); continue; }

      await supabase.from("alerts").update({ last_sent_at: new Date().toISOString() }).eq("id", alert.id);
      sent++;
    } catch (e) {
      errors++;
      console.error("alert loop", alert?.id, e);
    }
  }

  return new Response(JSON.stringify({ sent, skipped, errors, alerts: (alerts ?? []).length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
