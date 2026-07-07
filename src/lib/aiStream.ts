/**
 * Accumulateur pour les flux SSE de chat completions (format OpenAI).
 * Gère le texte streamé et les tool calls parallèles (agrégés par index).
 */

export type StreamedToolCall = { name: string; arguments: string };

export function createStreamAccumulator() {
  let buffer = "";
  let content = "";
  let done = false;
  const toolCalls = new Map<number, StreamedToolCall>();

  const processLine = (rawLine: string): string => {
    let line = rawLine;
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line.startsWith(":") || line.trim() === "") return "";
    if (!line.startsWith("data: ")) return "";

    const jsonStr = line.slice(6).trim();
    if (jsonStr === "[DONE]") {
      done = true;
      return "";
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) return "";

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = typeof tc.index === "number" ? tc.index : 0;
          const acc = toolCalls.get(index) ?? { name: "", arguments: "" };
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          toolCalls.set(index, acc);
        }
      }

      return typeof delta.content === "string" ? delta.content : "";
    } catch {
      // Ligne malformée : on l'ignore plutôt que de corrompre le reste du flux.
      return "";
    }
  };

  return {
    /** Ingère un chunk de texte et renvoie le delta de contenu affichable. */
    push(chunk: string): string {
      buffer += chunk;
      let delta = "";
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const d = processLine(line);
        if (d) {
          delta += d;
          content += d;
        }
      }
      return delta;
    },

    /** Traite ce qui reste dans le buffer à la fin du flux. */
    flush(): string {
      let delta = "";
      for (const line of buffer.split("\n")) {
        const d = processLine(line);
        if (d) {
          delta += d;
          content += d;
        }
      }
      buffer = "";
      return delta;
    },

    get content(): string {
      return content;
    },

    get isDone(): boolean {
      return done;
    },

    /** Tool calls complets, ordonnés par index. */
    getToolCalls(): StreamedToolCall[] {
      return [...toolCalls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, tc]) => tc);
    },
  };
}
