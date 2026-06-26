import { createFileRoute, Outlet, useNavigate, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/chat/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LogOut, MessageCircle, Settings, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation, Profile } from "@/lib/types";
import { makeConversationId } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Suhbatlar" }] }),
  component: ChatLayout,
});

interface ConvWithPeer extends Conversation { peer: Profile | null }

function ChatLayout() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const activeId = params.conversationId;

  const [conversations, setConversations] = useState<ConvWithPeer[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [user, loading, nav]);

  // Load conversations + realtime
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (!convs || cancelled) return;
      const peerIds = convs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
      const { data: peers } = peerIds.length
        ? await supabase.from("profiles").select("*").in("id", peerIds)
        : { data: [] as Profile[] };
      const peerMap = new Map((peers || []).map((p) => [p.id, p as Profile]));
      setConversations(convs.map((c) => ({ ...c, peer: peerMap.get(c.user_a === user.id ? c.user_b : c.user_a) || null })));
    };
    load();
    const ch = supabase.channel(`conv-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // Username search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const q = search.trim().replace(/^@/, "").toLowerCase();
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${q}%`)
        .neq("id", user?.id || "")
        .limit(10);
      setSearchResults((data || []) as Profile[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, user]);

  const openChat = async (peer: Profile) => {
    if (!user) return;
    const { id, user_a, user_b } = makeConversationId(user.id, peer.id);
    // ensure conversation exists
    const { data: existing } = await supabase.from("conversations").select("id").eq("id", id).maybeSingle();
    if (!existing) {
      await supabase.from("conversations").insert({ id, user_a, user_b });
    }
    setSearch("");
    setSearchResults([]);
    nav({ to: "/chat/$conversationId", params: { conversationId: id } });
  };

  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/auth", replace: true }); };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-muted-foreground">Yuklanmoqda…</div></div>;
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-[340px] border-r flex-col bg-[color:var(--sidebar-bg)]`}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-3 hover:bg-accent rounded-lg p-1 -m-1 transition flex-1 min-w-0">
            <Avatar name={profile?.display_name || "?"} src={profile?.avatar_url} size={40} />
            <div className="min-w-0 text-left">
              <div className="font-semibold text-sm truncate">{profile?.display_name}</div>
              <div className="text-xs text-muted-foreground truncate">@{profile?.username}</div>
            </div>
          </button>
          <button onClick={signOut} title="Chiqish" className="p-2 hover:bg-accent rounded-lg text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Foydalanuvchi nomini qidirish…"
              className="pl-9 rounded-full bg-muted border-0"
            />
          </div>
        </div>

        {/* Search results or conversations */}
        <div className="flex-1 overflow-y-auto">
          {search.trim() ? (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Foydalanuvchilar</div>
              {searching && <div className="px-4 py-3 text-sm text-muted-foreground">Qidirilmoqda…</div>}
              {!searching && searchResults.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">Hech kim topilmadi</div>}
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => openChat(p)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition text-left">
                  <Avatar name={p.display_name} src={p.avatar_url} size={44} />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.display_name}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Hali suhbatlar yo'q</p>
              <p className="text-xs mt-1">Yuqoridagi qidiruvdan kimnidir toping</p>
            </div>
          ) : (
            conversations.map((c) => (
              <Link key={c.id} to="/chat/$conversationId" params={{ conversationId: c.id }} className={`flex items-center gap-3 px-3 py-3 hover:bg-accent transition ${activeId === c.id ? "bg-accent" : ""}`}>
                <Avatar name={c.peer?.display_name || "?"} src={c.peer?.avatar_url} size={50} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{c.peer?.display_name || "Foydalanuvchi"}</div>
                    {c.last_message_at && (
                      <div className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.last_sender_id === user.id && "Siz: "}
                    {c.last_message || "Suhbat boshlangan"}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>

      {/* Right pane */}
      <main className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        <Outlet />
      </main>

      {settingsOpen && profile && (
        <SettingsModal profile={profile} onClose={() => setSettingsOpen(false)} onSaved={refreshProfile} />
      )}
    </div>
  );
}

function SettingsModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, bio, avatar_url: avatarUrl || null }).eq("id", profile.id);
    setSaving(false);
    if (error) { toast.error("Saqlashda xatolik"); return; }
    toast.success("Saqlandi");
    await onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Settings className="w-5 h-5" /> Sozlamalar</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex justify-center mb-4">
          <Avatar name={displayName} src={avatarUrl} size={80} />
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Foydalanuvchi nomi</label>
            <div className="text-sm font-mono mt-1">@{profile.username}</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ko'rinadigan ism</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Avatar URL</label>
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bio</label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={70} placeholder="O'zingiz haqingizda…" />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full mt-5">
          {saving ? "Saqlanmoqda…" : <><Check className="w-4 h-4 mr-1" /> Saqlash</>}
        </Button>
      </div>
    </div>
  );
}
