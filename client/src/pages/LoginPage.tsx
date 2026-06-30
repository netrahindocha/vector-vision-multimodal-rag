import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildGoogleLoginUrl, buildMicrosoftLoginUrl } from "@/lib/api";

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
      <Card className="relative mx-auto w-full max-w-md overflow-hidden border-blue-300/20 bg-slate-950/75 text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl">
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
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="space-y-3">
            <Button
              className="w-full border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => window.location.assign(buildGoogleLoginUrl())}
              type="button"
              variant="outline"
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
            <Button
              className="w-full border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => window.location.assign(buildMicrosoftLoginUrl())}
              type="button"
              variant="outline"
            >
              <MicrosoftIcon className="mr-2 h-4 w-4" />
              Sign in with Microsoft
            </Button>
          </div>
          <p className="text-center text-sm text-slate-400">
            New here? <Link className="text-blue-100 underline underline-offset-4 hover:text-white" to="/register">Create an account</Link>
          </p>
        </form>
      </Card>
    </AuthPageShell>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
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
