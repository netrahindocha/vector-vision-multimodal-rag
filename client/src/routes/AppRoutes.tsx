import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";

import { useAuth } from "@/auth/AuthContext";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { ChatPage, type ChatTarget } from "@/pages/ChatPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { UploadFilePage } from "@/pages/UploadPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import {
  createWorkspace,
  listDocuments,
  listWorkspaces,
  type Document,
  type Workspace,
} from "@/lib/api";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackRoute />} />
        <Route path="/login" element={<PublicAuthRoute mode="login" />} />
        <Route path="/register" element={<PublicAuthRoute mode="register" />} />
        <Route path="/" element={<Navigate to="/workspaces" replace />} />
        <Route path="/workspaces" element={<ProtectedRoute><WorkspacesRoute /></ProtectedRoute>} />
        <Route path="/workspaces/:workspaceId" element={<ProtectedRoute><WorkspaceRedirectRoute /></ProtectedRoute>} />
        <Route path="/workspaces/:workspaceId/documents" element={<ProtectedRoute><DocumentsRoute /></ProtectedRoute>} />
        <Route path="/workspaces/:workspaceId/upload" element={<ProtectedRoute><UploadRoute /></ProtectedRoute>} />
        <Route path="/workspaces/:workspaceId/chat" element={<ProtectedRoute><ChatRoute /></ProtectedRoute>} />
        <Route path="/workspaces/:workspaceId/documents/:documentId/chat" element={<ProtectedRoute><ChatRoute /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/workspaces" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <FullScreenLoading label="Restoring secure session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthCallbackRoute() {
  const { restoreSession } = useAuth();
  return <AuthCallbackPage onRestoreSession={restoreSession} />;
}

function PublicAuthRoute({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { isLoading, login, register, user } = useAuth();

  if (isLoading) {
    return <FullScreenLoading label="Checking secure session..." />;
  }

  if (user) {
    return <Navigate to="/workspaces" replace />;
  }

  if (mode === "login") {
    return <LoginPage onLogin={async (email, password) => { await login(email, password); navigate("/workspaces", { replace: true }); }} />;
  }

  return <RegisterPage onRegister={async (email, password, name) => { await register(email, password, name); navigate("/workspaces", { replace: true }); }} />;
}

function FullScreenLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-slate-300 shadow-2xl shadow-blue-950/20 backdrop-blur-xl">
        <p className="text-lg font-semibold text-white">{label}</p>
      </div>
    </main>
  );
}

function AppShell({ children, isChat = false }: { children: ReactNode; isChat?: boolean }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <BackgroundGlow />
      <section
        className={
          isChat
            ? "relative z-10 flex min-h-screen w-full flex-col"
            : "relative z-10 mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-6 py-10 lg:px-8"
        }
      >
        {children}
      </section>
    </main>
  );
}

function WorkspaceRedirectRoute() {
  const { workspaceId } = useParams();
  return <Navigate to={`/workspaces/${workspaceId}/documents`} replace />;
}

function WorkspacesRoute() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadWorkspaces() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await listWorkspaces();
        if (!ignore) setWorkspaces(data);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to load workspaces");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadWorkspaces();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceName.trim()) {
      setCreateError("Workspace name is required.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const workspace = await createWorkspace(workspaceName.trim(), workspaceDescription.trim() || undefined);
      setWorkspaces((current) => [workspace, ...current]);
      setWorkspaceName("");
      setWorkspaceDescription("");
      setCreateDialogOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  }

  const visibleWorkspaces = useMemo(() => {
    if (workspaces.length > 0) return workspaces;
    if (isLoading || error) return [];
    return [
      {
        id: "preview-workspace",
        name: "No workspaces yet",
        description: "Your workspaces will appear here once you create them.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }, [error, isLoading, workspaces]);

  return (
    <AppShell>
      <WorkspacesPage
        createDialogOpen={createDialogOpen}
        createError={createError}
        error={error}
        isCreating={isCreating}
        isLoading={isLoading}
        onCreateDialogOpenChange={setCreateDialogOpen}
        currentUser={user}
        onCreateWorkspace={handleCreateWorkspace}
        onLogout={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
        onOpenWorkspace={(workspace) => {
          if (workspace.id !== "preview-workspace") {
            navigate(`/workspaces/${workspace.id}/documents`);
          }
        }}
        setWorkspaceDescription={setWorkspaceDescription}
        setWorkspaceName={setWorkspaceName}
        visibleWorkspaces={visibleWorkspaces}
        workspaceDescription={workspaceDescription}
        workspaceName={workspaceName}
      />
    </AppShell>
  );
}

function DocumentsRoute() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { workspace, isLoading: isWorkspaceLoading, error: workspaceError } = useWorkspace(workspaceId);
  const { documents, isLoading: isDocumentsLoading, error: documentsError } = useWorkspaceDocuments(workspaceId);

  if (!workspaceId) return <Navigate to="/workspaces" replace />;

  return (
    <AppShell>
      {workspace ? (
        <DocumentsPage
          documents={documents}
          error={documentsError || workspaceError}
          isLoading={isWorkspaceLoading || isDocumentsLoading}
          onBack={() => navigate("/workspaces")}
          onChat={(document) => navigate(`/workspaces/${workspace.id}/documents/${document.id}/chat`)}
          onUpload={() => navigate(`/workspaces/${workspace.id}/upload`)}
          onWorkspaceChat={() => navigate(`/workspaces/${workspace.id}/chat`)}
          workspace={workspace}
        />
      ) : (
        <PageLoadingState error={workspaceError} isLoading={isWorkspaceLoading} label="workspace" />
      )}
    </AppShell>
  );
}

function UploadRoute() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { workspace, isLoading, error } = useWorkspace(workspaceId);

  if (!workspaceId) return <Navigate to="/workspaces" replace />;

  return (
    <AppShell>
      {workspace ? (
        <UploadFilePage
          onBack={() => navigate(`/workspaces/${workspace.id}/documents`)}
          onBackToWorkspaces={() => navigate("/workspaces")}
          workspace={workspace}
        />
      ) : (
        <PageLoadingState error={error} isLoading={isLoading} label="workspace" />
      )}
    </AppShell>
  );
}

function ChatRoute() {
  const navigate = useNavigate();
  const { workspaceId, documentId } = useParams();
  const { workspace, isLoading: isWorkspaceLoading, error: workspaceError } = useWorkspace(workspaceId);
  const { documents, isLoading: isDocumentsLoading, error: documentsError } = useWorkspaceDocuments(workspaceId);

  if (!workspaceId) return <Navigate to="/workspaces" replace />;

  const selectedDocument = documentId ? documents.find((document) => document.id === documentId) : null;
  const chatTarget: ChatTarget | null = documentId
    ? selectedDocument
      ? { type: "document", document: selectedDocument }
      : null
    : { type: "workspace" };

  return (
    <AppShell isChat>
      {workspace && chatTarget ? (
        <ChatPage
          chatTarget={chatTarget}
          documents={documents}
          onBack={() => navigate(`/workspaces/${workspace.id}/documents`)}
          onSelectDocument={(document) => navigate(`/workspaces/${workspace.id}/documents/${document.id}/chat`)}
          onSelectWorkspace={() => navigate(`/workspaces/${workspace.id}/chat`)}
          workspace={workspace}
        />
      ) : (
        <PageLoadingState
          error={workspaceError || documentsError || (!isWorkspaceLoading && !isDocumentsLoading && documentId ? "Document not found" : null)}
          isLoading={isWorkspaceLoading || isDocumentsLoading}
          label="chat"
        />
      )}
    </AppShell>
  );
}

function useWorkspace(workspaceId?: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    let ignore = false;

    async function loadWorkspace() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await listWorkspaces();
        const found = data.find((item) => item.id === workspaceId) ?? null;
        if (!ignore) {
          setWorkspace(found);
          setError(found ? null : "Workspace not found");
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to load workspace");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadWorkspace();
    return () => {
      ignore = true;
    };
  }, [workspaceId]);

  return { workspace, isLoading, error };
}

function useWorkspaceDocuments(workspaceId?: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setDocuments([]);
      return;
    }

    let ignore = false;

    async function loadDocuments() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await listDocuments(workspaceId);
        if (!ignore) setDocuments(data);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadDocuments();
    return () => {
      ignore = true;
    };
  }, [workspaceId]);

  return { documents, isLoading, error };
}

function PageLoadingState({ error, isLoading, label }: { error: string | null; isLoading: boolean; label: string }) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-slate-300 shadow-2xl shadow-blue-950/20 backdrop-blur-xl">
        <p className="text-lg font-semibold text-white">{isLoading ? `Loading ${label}...` : error || `Unable to load ${label}.`}</p>
        {error && !isLoading ? <p className="mt-2 text-sm text-slate-400">Return to workspaces and try again.</p> : null}
      </div>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[-12rem] top-20 h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-16rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-blue-900/45 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.4),rgba(0,0,0,0.9))]" />
    </>
  );
}


export default AppRoutes;
