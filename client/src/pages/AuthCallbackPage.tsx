import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthPageShell } from "@/pages/LoginPage";

export function AuthCallbackPage({ onRestoreSession }: { onRestoreSession: () => Promise<void> }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing secure sign in...");

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");

    async function completeSignIn() {
      if (oauthError) {
        setStatus("error");
        setMessage(getOAuthErrorMessage(oauthError));
        return;
      }

      try {
        await onRestoreSession();
        if (!ignore) {
          setStatus("success");
          setMessage("Sign in successful. Redirecting to your workspaces...");
          window.setTimeout(() => navigate("/workspaces", { replace: true }), 600);
        }
      } catch (err) {
        if (!ignore) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Could not restore your sign in session.");
        }
      }
    }

    completeSignIn();
    return () => {
      ignore = true;
    };
  }, [navigate, onRestoreSession]);

  return (
    <AuthPageShell>
      <Card className="relative mx-auto w-full max-w-md overflow-hidden border-blue-300/20 bg-slate-950/75 text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/25 blur-3xl" />
        <CardHeader className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/25 bg-blue-400/10 text-blue-100 shadow-[0_0_35px_rgba(59,130,246,0.35)]">
            {status === "loading" ? <Loader2 className="h-6 w-6 animate-spin" /> : status === "success" ? <CheckCircle2 className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
          </div>
          <CardTitle className="text-3xl text-white">Google sign in</CardTitle>
          <CardDescription className="text-slate-300">{message}</CardDescription>
        </CardHeader>
        {status === "error" ? (
          <div className="relative z-10 px-6 pb-6">
            <Button asChild className="w-full bg-blue-500 text-white shadow-[0_0_35px_rgba(59,130,246,0.4)] hover:bg-blue-400">
              <Link to="/login">Return to login</Link>
            </Button>
          </div>
        ) : null}
      </Card>
    </AuthPageShell>
  );
}

function getOAuthErrorMessage(error: string) {
  if (error === "oauth_state") {
    return "Google sign in could not be verified. Please try again.";
  }
  if (error === "oauth_failed") {
    return "Google sign in failed. Please try again.";
  }
  return "Google sign in was cancelled or failed.";
}
