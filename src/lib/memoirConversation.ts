import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type Attachment = { name: string; url: string; path?: string };

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  /** Message de contexte (site web analysé, pièce jointe extraite) : envoyé à l'IA mais masqué dans l'UI. */
  hidden?: boolean;
};

export type MemoirConversation = {
  id: string;
  messages: ChatMessage[];
  memoir_draft: Record<string, unknown> | null;
};

export type ConversationMode = "onboarding" | "dialog";

/** Récupère la conversation active de l'utilisateur pour ce mode, ou en crée une. */
export async function loadOrCreateConversation(
  userId: string,
  mode: ConversationMode
): Promise<MemoirConversation | null> {
  const { data: existing, error } = await supabase
    .from("memoir_conversations")
    .select("id, messages, memoir_draft")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    console.error("[memoir] load conversation failed:", error);
    return null;
  }
  if (existing) {
    return {
      id: existing.id,
      messages: (existing.messages as ChatMessage[] | null) ?? [],
      memoir_draft: (existing.memoir_draft as Record<string, unknown> | null) ?? null,
    };
  }

  const { data: created, error: insertError } = await supabase
    .from("memoir_conversations")
    .insert({ user_id: userId, mode })
    .select("id, messages, memoir_draft")
    .single();
  if (insertError) {
    // Conflit possible si deux onglets créent en même temps : on relit l'active.
    const { data: retry } = await supabase
      .from("memoir_conversations")
      .select("id, messages, memoir_draft")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("status", "active")
      .maybeSingle();
    if (retry) {
      return {
        id: retry.id,
        messages: (retry.messages as ChatMessage[] | null) ?? [],
        memoir_draft: (retry.memoir_draft as Record<string, unknown> | null) ?? null,
      };
    }
    console.error("[memoir] create conversation failed:", insertError);
    return null;
  }
  return { id: created.id, messages: [], memoir_draft: null };
}

export async function persistConversation(
  conversationId: string,
  patch: {
    messages?: ChatMessage[];
    memoir_draft?: Record<string, unknown> | null;
    status?: "active" | "completed" | "abandoned";
  }
): Promise<void> {
  const update: { messages?: Json; memoir_draft?: Json; status?: string } = {};
  if (patch.messages) update.messages = patch.messages as unknown as Json;
  if (patch.memoir_draft !== undefined) update.memoir_draft = patch.memoir_draft as unknown as Json;
  if (patch.status) update.status = patch.status;
  const { error } = await supabase
    .from("memoir_conversations")
    .update(update)
    .eq("id", conversationId);
  if (error) console.error("[memoir] persist conversation failed:", error);
}
