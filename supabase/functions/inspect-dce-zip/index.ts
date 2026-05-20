import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function findEOCD(bytes: Uint8Array): number {
  const tailStart = Math.max(0, bytes.byteLength - 65557);
  for (let i = bytes.byteLength - 22; i >= tailStart; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { file_path } = await req.json();
    if (!file_path || typeof file_path !== "string") {
      return new Response(JSON.stringify({ error: "file_path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: blob, error } = await admin.storage.from("dce-documents").download(file_path);
    if (error || !blob) {
      return new Response(JSON.stringify({ error: error?.message ?? "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const size = bytes.byteLength;
    const head = toHex(bytes.slice(0, 32));
    const tail = toHex(bytes.slice(Math.max(0, size - 32)));
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const eocdAt = findEOCD(bytes);

    let unzipResult: { ok: boolean; files?: { name: string; size: number }[]; error?: string } = { ok: false };
    try {
      const entries = unzipSync(bytes);
      unzipResult = {
        ok: true,
        files: Object.entries(entries).map(([name, data]) => ({ name, size: (data as Uint8Array).byteLength })),
      };
    } catch (e: any) {
      unzipResult = { ok: false, error: e?.message ?? String(e) };
    }

    return new Response(
      JSON.stringify({
        file_path,
        size,
        magic_ascii: magic,
        head_hex: head,
        tail_hex: tail,
        eocd_offset: eocdAt,
        eocd_from_end: eocdAt >= 0 ? size - eocdAt : null,
        unzip: unzipResult,
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
