import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/chat/Avatar";
import { ArrowLeft, Send } from "lucide-react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import type { Message, Profile } from "@/lib/types";

export const Route = createFileRoute("/chat/$conversationId")({
  component: ChatRoom,
});

function ChatRoom() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [peer, setPeer] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation peer
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
      if (!conv || cancelled) return;
      const peerId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", peerId).maybeSingle();
      if (!cancelled) setPeer(p as Profile | null);
    })();
    return () => { cancelled = true; };
  }, [conversationId, user]);

  // Load messages + realtime
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data || []) as Message[]);
    })();
    const ch = supabase.channel(`msg-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => {
          const m = payload.new as Message;
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [conversationId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const value = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: value,
    });
    if (error) setText(value);
    setSending(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group messages by date
  const groups: { date: Date; items: Message[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.created_at);
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, d)) last.items.push(m);
    else groups.push({ date: d, items: [m] });
  }

  const dateLabel = (d: Date) => {
    if (isToday(d)) return "Bugun";
    if (isYesterday(d)) return "Kecha";
    return format(d, "d MMMM yyyy");
  };

  return (
    <div className="flex-1 flex flex-col chat-bg-pattern">
      {/* Header */}
      <div className="bg-card border-b px-4 py-2.5 flex items-center gap-3 shrink-0">
        <button onClick={() => nav({ to: "/chat" })} className="md:hidden p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar name={peer?.display_name || "?"} src={peer?.avatar_url} size={40} />
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{peer?.display_name || "…"}</div>
          <div className="text-xs text-muted-foreground truncate">@{peer?.username}</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="bg-card/80 backdrop-blur px-4 py-3 rounded-xl text-sm text-muted-foreground border">
              Hali xabarlar yo'q. Birinchi xabarni yozing 👋
            </div>
          </div>
        ) : (
          <div className="space-y-1 max-w-3xl mx-auto">
            {groups.map((g, gi) => (
              <div key={gi}>
                <div className="flex justify-center my-3">
                  <span className="bg-black/15 text-white text-[11px] px-2.5 py-0.5 rounded-full backdrop-blur">{dateLabel(g.date)}</span>
                </div>
                {g.items.map((m, i) => {
                  const mine = m.sender_id === user?.id;
                  const prev = g.items[i - 1];
                  const grouped = prev && prev.sender_id === m.sender_id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                      <div className={`msg-in max-w-[75%] md:max-w-[65%] px-3 py-1.5 ${mine ? "bubble-out" : "bubble-in"}`}>
                        <div className="text-[14.5px] leading-snug whitespace-pre-wrap break-words">{m.text}</div>
                        <div className={`text-[10.5px] mt-0.5 text-right opacity-60`}>{format(new Date(m.created_at), "HH:mm")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-card border-t px-3 md:px-6 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder="Xabar yozing…"
            rows={1}
            className="flex-1 resize-none bg-muted rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
            style={{ minHeight: 42 }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
