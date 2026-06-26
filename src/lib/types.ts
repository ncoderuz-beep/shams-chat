export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  last_seen: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export function makeConversationId(uidA: string, uidB: string): { id: string; user_a: string; user_b: string } {
  const [a, b] = [uidA, uidB].sort();
  return { id: `${a}_${b}`, user_a: a, user_b: b };
}
