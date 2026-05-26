// fetch-dce-mpi — Deno-native MPI DCE retriever
// Auth flow: reuse cookie session (12h) → fallback to login+captcha if expired.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  CookieJar,
  downloadDce,
  isLoginRequired,
  loginMpi,
  resolveDceUrl,
} from "../_shared/mpiClient.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  tender_id: string;
  dce_url: string;
  triggered_by?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();
  const trace: Array<{ ts: string; step: string; status: string; detail?: string }> = [];
  const log = (step: string, status: "ok" | "skipped" | "failed", detail?: string) => {
    trace.push({ ts: new Date().toISOString(), step, status, detail });
    console.log(`[mpi] ${status.toUpperCase()} ${step}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
  };

  let runId: string | null = null;
  let captchasSolved = 0;

  try {
    const body = (await req.json()) as ReqBody;
    const { tender_id, dce_url, triggered_by } = body;
    if (!tender_id || !dce_url) throw new Error("tender_id and dce_url required");

    const { data: runRow, error: runErr } = await supabase
      .from("agent_runs")
      .insert({
        tender_id,
        platform: "mpi",
        dce_url,
        status: "running",
        triggered_by: triggered_by ?? null,
      })
      .select("id")
      .single();
    if (runErr) throw new Error(`agent_runs insert: ${runErr.message}`);
    runId = runRow.id;

    let jar: CookieJar = {};

    // 0. Resolve real DCE retrieval URL (publication page → dematEnt.login&type=DCE&IDM=...)
    const resolved = await resolveDceUrl(jar, dce_url);
    const dceUrl = resolved.url;
    log("dce.resolve_url", "ok", `via=${resolved.via} url=${dceUrl}`);

    // 1. Load existing session
    const { data: session } = await supabase
      .from("platform_sessions")
      .select("cookies, expires_at")
      .eq("platform", "mpi")
      .maybeSingle();

    let needsLogin = true;
    let landingHtml = "";

    if (session?.cookies && session?.expires_at && new Date(session.expires_at) > new Date()) {
      jar = session.cookies as CookieJar;
      log("session.reuse", "ok", `cookies=${Object.keys(jar).length} expires=${session.expires_at}`);
      // Quick probe — fetch DCE page and check if login required
      const probeRes = await fetch(dceUrl, {
        headers: {
          Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; "),
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
        redirect: "follow",
      });
      landingHtml = await probeRes.text();
      needsLogin = isLoginRequired(landingHtml);
      log("session.probe", needsLogin ? "skipped" : "ok", `login_required=${needsLogin}`);
    }

    // 2. Login if needed
    if (needsLogin) {
      jar = {};
      const loginRes = await loginMpi(jar, dce_url);
      if (loginRes.captchaSolved) captchasSolved = 1;
      landingHtml = loginRes.finalHtml;
      log("session.login", "ok", `captcha=${loginRes.captchaSolved} cookies=${Object.keys(jar).length}`);

      if (isLoginRequired(landingHtml)) {
        throw new Error("Login failed — still on login page after POST");
      }

      // Persist session (12h)
      const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      const { error: upErr } = await supabase
        .from("platform_sessions")
        .upsert({
          platform: "mpi",
          cookies: jar,
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
          login_count: (session as any)?.login_count
            ? ((session as any).login_count + 1)
            : 1,
        }, { onConflict: "platform" });
      if (upErr) log("session.persist", "failed", upErr.message);
      else log("session.persist", "ok", `expires=${expiresAt}`);
    } else {
      await supabase
        .from("platform_sessions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("platform", "mpi");
    }

    // 3. Download DCE
    const dl = await downloadDce(jar, dce_url, landingHtml);
    log("dce.download", "ok", `lots=${dl.lotCount} bytes=${dl.bytes.byteLength} ct=${dl.contentType}`);

    // 4. Upload to bucket
    const ext = dl.contentType.includes("pdf") ? "pdf" : "zip";
    const mime = ext === "pdf" ? "application/pdf" : "application/zip";
    const filename = `${tender_id}/mpi_${Date.now()}.${ext}`;
    const { error: stErr } = await supabase.storage
      .from("dce-documents")
      .upload(filename, dl.bytes, { contentType: mime, upsert: true });
    if (stErr) throw new Error(`storage upload: ${stErr.message}`);
    log("storage.upload", "ok", filename);

    if (triggered_by) {
      await supabase.from("dce_uploads").insert({
        tender_id,
        user_id: triggered_by,
        file_name: `DCE_mpi.${ext}`,
        file_path: filename,
        file_size: dl.bytes.byteLength,
        agent_run_id: runId,
      });
    }

    const durationMs = Date.now() - startedAt;
    const costUsd = captchasSolved * 0.003;
    await supabase.from("agent_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      cost_usd: Number(costUsd.toFixed(4)),
      captchas_solved: captchasSolved,
      files_downloaded: 1,
      trace: trace as any,
    }).eq("id", runId!);

    return json({
      success: true,
      run_id: runId,
      files_uploaded: 1,
      captchas_solved: captchasSolved,
      duration_ms: durationMs,
      cost_usd: Number(costUsd.toFixed(4)),
      file_path: filename,
    });
  } catch (err: any) {
    console.error("[mpi] FATAL", err);
    if (runId) {
      await supabase.from("agent_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        error_message: err.message ?? String(err),
        captchas_solved: captchasSolved,
        trace: trace as any,
      }).eq("id", runId);
    }
    return json({ success: false, error: err.message ?? String(err), run_id: runId, trace }, 500);
  }
});
