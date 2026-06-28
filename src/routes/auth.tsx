import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Kirish — Suhbat" }] }),
  component: AuthPage,
});

type Step = "email" | "login" | "register";

function AuthPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");

  useEffect(() => { if (user) nav({ to: "/chat", replace: true }); }, [user, nav]);

  useEffect(() => {
    if (step !== "register") return;
    if (!username) { setUsernameStatus("idle"); return; }
    if (!/^[a-z0-9_]{5,32}$/.test(username)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
      setUsernameStatus(data ? "taken" : "ok");
    }, 350);
    return () => clearTimeout(t);
  }, [username, step]);

  const continueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error("To'g'ri email kiriting"); return; }
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc("email_exists", { _email: email });
      if (error) throw error;
      setStep(data ? "login" : "register");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setChecking(false);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error("Parol noto'g'ri");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus !== "ok") { toast.error("Foydalanuvchi nomini tekshiring"); return; }
    if (password.length < 6) { toast.error("Parol kamida 6 ta belgi bo'lsin"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/chat`,
        data: { username: username.toLowerCase(), display_name: displayName || username },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Ro'yxatdan o'tdingiz!");
  };

  const back = () => {
    setStep("email"); setPassword(""); setUsername(""); setDisplayName(""); setUsernameStatus("idle");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground mb-4 shadow-lg shadow-primary/30">
            <Send className="w-9 h-9" style={{ transform: "translateX(-2px) rotate(-20deg)" }} />
          </div>
          <h1 className="text-2xl font-semibold">Suhbat</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "email" && "Davom etish uchun email kiriting"}
            {step === "login" && "Xush kelibsiz! Parolni kiriting"}
            {step === "register" && "Yangi hisob yarating"}
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-xl">
          {step !== "email" && (
            <button onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4" /> {email}
            </button>
          )}

          {step === "email" && (
            <form onSubmit={continueWithEmail} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@example.com" required autoFocus />
              </div>
              <Button type="submit" disabled={checking} className="w-full">
                {checking ? "Tekshirilmoqda…" : "Davom etish"}
              </Button>
            </form>
          )}

          {step === "login" && (
            <form onSubmit={signIn} className="space-y-4">
              <div>
                <Label htmlFor="password">Parol</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Iltimos kuting…" : "Kirish"}
              </Button>
            </form>
          )}

          {step === "register" && (
            <form onSubmit={signUp} className="space-y-4">
              <div>
                <Label htmlFor="displayName">Ismingiz</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Amirbek" required autoFocus />
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
                <Label htmlFor="password">Parol</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Iltimos kuting…" : "Ro'yxatdan o'tish"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
