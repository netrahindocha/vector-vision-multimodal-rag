import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildGoogleLoginUrl, buildMicrosoftLoginUrl } from "@/lib/api";
import { AuthPageShell, GoogleIcon, MicrosoftIcon } from "@/pages/LoginPage";

export function RegisterPage({ onRegister }: { onRegister: (email: string, password: string, name?: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      await onRegister(email.trim(), password, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
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
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl text-white">Create account</CardTitle>
          <CardDescription className="text-slate-300">Start building your private knowledge workspaces.</CardDescription>
        </CardHeader>
        <form className="relative z-10 space-y-5 px-6 pb-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label className="text-blue-100" htmlFor="register-name">Name</Label>
            <Input id="register-name" autoComplete="name" className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500" onChange={(event) => setName(event.target.value)} placeholder="Your name" value={name} />
          </div>
          <div className="space-y-2">
            <Label className="text-blue-100" htmlFor="register-email">Email</Label>
            <Input id="register-email" autoComplete="email" className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
          </div>
          <div className="space-y-2">
            <Label className="text-blue-100" htmlFor="register-password">Password</Label>
            <Input id="register-password" autoComplete="new-password" className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500" onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" type="password" value={password} />
          </div>
          {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
          <Button className="w-full bg-blue-500 text-white shadow-[0_0_35px_rgba(59,130,246,0.4)] hover:bg-blue-400" disabled={isSubmitting || !email.trim() || password.length < 8} type="submit">
            {isSubmitting ? "Creating account..." : "Create account"}
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
              Sign up with Google
            </Button>
            <Button
              className="w-full border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => window.location.assign(buildMicrosoftLoginUrl())}
              type="button"
              variant="outline"
            >
              <MicrosoftIcon className="mr-2 h-4 w-4" />
              Sign up with Microsoft
            </Button>
          </div>
          <p className="text-center text-sm text-slate-400">
            Already have an account? <Link className="text-blue-100 underline underline-offset-4 hover:text-white" to="/login">Log in</Link>
          </p>
        </form>
      </Card>
    </AuthPageShell>
  );
}
