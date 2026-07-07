import { describe, it, expect } from "vitest";
// On teste la logique de validation SSRF partagée avec les edge functions.
// Le fichier ne référence `Deno` qu'à l'intérieur des fonctions (résolution
// DNS), jamais au chargement — l'import fonctionne donc sous vitest.
import { assertPublicUrl } from "../../supabase/functions/_shared/urlGuard";

describe("assertPublicUrl", () => {
  it("rejette les protocoles non http(s)", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow();
  });

  it("rejette localhost et les hôtes internes", async () => {
    await expect(assertPublicUrl("http://localhost/")).rejects.toThrow();
    await expect(assertPublicUrl("http://foo.internal/")).rejects.toThrow();
    await expect(assertPublicUrl("http://metadata.google.internal/")).rejects.toThrow();
  });

  it("rejette les IP privées et de bouclage littérales", async () => {
    await expect(assertPublicUrl("http://127.0.0.1/")).rejects.toThrow();
    await expect(assertPublicUrl("http://10.0.0.5/")).rejects.toThrow();
    await expect(assertPublicUrl("http://192.168.1.1/")).rejects.toThrow();
    await expect(assertPublicUrl("http://172.16.0.1/")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
  });

  it("rejette les identifiants dans l'URL", async () => {
    await expect(assertPublicUrl("http://user:pass@1.2.3.4/")).rejects.toThrow();
  });

  it("accepte une IP publique littérale et normalise le protocole", async () => {
    const url = await assertPublicUrl("8.8.8.8");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("8.8.8.8");
  });
});
