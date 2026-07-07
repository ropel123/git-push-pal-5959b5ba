import { describe, it, expect } from "vitest";
import { createStreamAccumulator } from "./aiStream";

/** Découpe une chaîne SSE en chunks arbitraires pour simuler le réseau. */
function feed(acc: ReturnType<typeof createStreamAccumulator>, sse: string, chunkSize = 7) {
  for (let i = 0; i < sse.length; i += chunkSize) {
    acc.push(sse.slice(i, i + chunkSize));
  }
  acc.flush();
}

const dataLine = (obj: unknown) => `data: ${JSON.stringify(obj)}\n`;

describe("createStreamAccumulator", () => {
  it("assemble le contenu texte streamé morceau par morceau", () => {
    const acc = createStreamAccumulator();
    const sse =
      dataLine({ choices: [{ delta: { content: "Bonjour" } }] }) +
      dataLine({ choices: [{ delta: { content: " le monde" } }] }) +
      "data: [DONE]\n";
    feed(acc, sse);
    expect(acc.content).toBe("Bonjour le monde");
    expect(acc.isDone).toBe(true);
  });

  it("agrège les arguments d'un tool call fragmenté", () => {
    const acc = createStreamAccumulator();
    const sse =
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "save_memoir" } }] } }] }) +
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"company_' } }] } }] }) +
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'name":"ACME"}' } }] } }] });
    feed(acc, sse);
    const calls = acc.getToolCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("save_memoir");
    expect(JSON.parse(calls[0].arguments)).toEqual({ company_name: "ACME" });
  });

  it("garde distincts deux tool calls parallèles avec des index différents", () => {
    const acc = createStreamAccumulator();
    const sse =
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "analyze_website", arguments: '{"url":' } }] } }] }) +
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 1, function: { name: "save_memoir", arguments: '{"company_name":' } }] } }] }) +
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a.fr"}' } }] } }] }) +
      dataLine({ choices: [{ delta: { tool_calls: [{ index: 1, function: { arguments: '"X"}' } }] } }] });
    feed(acc, sse);
    const calls = acc.getToolCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe("analyze_website");
    expect(JSON.parse(calls[0].arguments)).toEqual({ url: "a.fr" });
    expect(calls[1].name).toBe("save_memoir");
    expect(JSON.parse(calls[1].arguments)).toEqual({ company_name: "X" });
  });

  it("ignore les lignes de commentaire et les lignes vides", () => {
    const acc = createStreamAccumulator();
    const sse =
      ": ceci est un keepalive\n\n" +
      dataLine({ choices: [{ delta: { content: "ok" } }] });
    feed(acc, sse);
    expect(acc.content).toBe("ok");
  });

  it("tolère les retours chariot \\r\\n", () => {
    const acc = createStreamAccumulator();
    const sse =
      `data: ${JSON.stringify({ choices: [{ delta: { content: "a" } }] })}\r\n` +
      `data: ${JSON.stringify({ choices: [{ delta: { content: "b" } }] })}\r\n`;
    feed(acc, sse, 3);
    expect(acc.content).toBe("ab");
  });

  it("n'échoue pas sur un JSON malformé", () => {
    const acc = createStreamAccumulator();
    const sse =
      "data: {ceci n'est pas du json}\n" +
      dataLine({ choices: [{ delta: { content: "resilient" } }] });
    feed(acc, sse);
    expect(acc.content).toBe("resilient");
  });
});
