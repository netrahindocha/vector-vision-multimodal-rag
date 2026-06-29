import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <Card className="relative w-full max-w-md overflow-hidden border-blue-300/20 bg-slate-950/75 text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/25 blur-3xl" />
        <CardHeader className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 text-blue-100 shadow-[0_0_35px_rgba(59,130,246,0.35)]">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl text-white">Welcome back</CardTitle>
          <CardDescription className="text-slate-300">Log in to access your private RAG workspaces.</CardDescription>
        </CardHeader>
        <form className="relative z-10 space-y-5 px-6 pb-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-blue-100" htmlFor="login-email">Email</Label>
            <Input id="login-email" autoComplete="email" className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
          </div>
          <div className="space-y-2">
            <Label className="text-blue-100" htmlFor="login-password">Password</Label>
            <Input id="login-password" autoComplete="current-password" className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500" onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type="password" value={password} />
          </div>
          {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
          <Button className="w-full bg-blue-500 text-white shadow-[0_0_35px_rgba(59,130,246,0.4)] hover:bg-blue-400" disabled={isSubmitting || !email.trim() || !password} type="submit">
            {isSubmitting ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-center text-sm text-slate-400">
            New here? <Link className="text-blue-100 underline underline-offset-4 hover:text-white" to="/register">Create an account</Link>
          </p>
        </form>
      </Card>
    </AuthPageShell>
  );
}

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-16rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-blue-900/45 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.4),rgba(0,0,0,0.9))]" />
      <div className="relative z-10 w-full">
        <div className="mb-8 flex items-center justify-center gap-2 text-blue-100">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm uppercase tracking-[0.28em]">Secure RAG Platform</span>
        </div>
        {children}
      </div>
    </main>
  );
}
