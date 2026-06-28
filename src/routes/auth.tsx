import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Ro'yxatdan o'tish — Suhbat" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");

  useEffect(() => { if (user) nav({ to: "/chat", replace: true }); }, [user, nav]);

  useEffect(() => {
    if (!username) { setUsernameStatus("idle"); return; }
    if (!/^[a-z0-9_]{5,32}$/.test(username)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
      setUsernameStatus(data ? "taken" : "ok");
    }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus !== "ok") { toast.error("Foydalanuvchi nomini tekshiring"); return; }
    if (password.length < 6) { toast.error("Parol kamida 6 ta belgi"); return; }
    setLoading(true);
    try {
      // Try sign up first
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
          data: { username: username.toLowerCase(), display_name: displayName || username },
        },
      });
      if (error) {
        // If email already registered, try logging in instead
        const msg = error.message.toLowerCase();
        if (msg.includes("registered") || msg.includes("exists") || msg.includes("already")) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            toast.error("Bu email ro'yxatdan o'tgan, parol noto'g'ri");
            return;
          }
          toast.success("Xush kelibsiz!");
          return;
        }
        throw error;
      }
      if (data.user) toast.success("Ro'yxatdan o'tdingiz!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold">Suhbat</h1>
          <p className="text-muted-foreground mt-1">Ro'yxatdan o'tib do'stlaringiz bilan yozing</p>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="displayName">Ismingiz</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Amirbek" required />
            </div>
            <div>
              <Label htmlFor="username">Foydalanuvchi nomi</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="amirbek_dev" className="pl-7" required />
              </div>
              <p className={`text-xs mt-1 ${usernameStatus === "ok" ? "text-[color:var(--online)]" : usernameStatus === "taken" || usernameStatus === "invalid" ? "text-destructive" : "text-muted-foreground"}`}>
                {usernameStatus === "checking" && "Tekshirilmoqda…"}
                {usernameStatus === "ok" && "✓ Bo'sh"}
                {usernameStatus === "taken" && "✗ Band"}
                {usernameStatus === "invalid" && "5-32 ta belgi: a-z, 0-9, _"}
                {usernameStatus === "idle" && "5-32 ta belgi: a-z, 0-9, _"}
              </p>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Parol</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Iltimos kuting…" : "Ro'yxatdan o'tish"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
