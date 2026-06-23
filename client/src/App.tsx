import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  CloudUpload,
  FileText,
  Sparkles,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWorkspace,
  listDocuments,
  listWorkspaces,
  type Document,
  type Workspace,
} from "@/lib/api";

function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );
  const [workspaceView, setWorkspaceView] = useState<"documents" | "upload">(
    "documents",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
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
        if (!ignore) {
          setWorkspaces(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Failed to load workspaces",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspaces();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorkspace) {
      setDocuments([]);
      return;
    }

    let ignore = false;

    async function loadWorkspaceDocuments() {
      try {
        setIsDocumentsLoading(true);
        setDocumentsError(null);
        const data = await listDocuments(selectedWorkspace.id);
        if (!ignore) {
          setDocuments(data);
        }
      } catch (err) {
        if (!ignore) {
          setDocumentsError(
            err instanceof Error ? err.message : "Failed to load documents",
          );
        }
      } finally {
        if (!ignore) {
          setIsDocumentsLoading(false);
        }
      }
    }

    loadWorkspaceDocuments();

    return () => {
      ignore = true;
    };
  }, [selectedWorkspace]);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceName.trim()) {
      setCreateError("Workspace name is required.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const workspace = await createWorkspace(
        workspaceName.trim(),
        workspaceDescription.trim() || undefined,
      );
      setWorkspaces((current) => [workspace, ...current]);
      setWorkspaceName("");
      setWorkspaceDescription("");
      setCreateDialogOpen(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create workspace",
      );
    } finally {
      setIsCreating(false);
    }
  }

  const visibleWorkspaces = useMemo(() => {
    if (workspaces.length > 0) {
      return workspaces;
    }

    if (isLoading || error) {
      return [];
    }

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
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <BackgroundGlow />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-8">
        {selectedWorkspace ? (
          workspaceView === "upload" ? (
            <UploadFilePage
              onBack={() => setWorkspaceView("documents")}
              onBackToWorkspaces={() => {
                setSelectedWorkspace(null);
                setWorkspaceView("documents");
              }}
              workspace={selectedWorkspace}
            />
          ) : (
            <DocumentsPage
              documents={documents}
              error={documentsError}
              isLoading={isDocumentsLoading}
              onBack={() => setSelectedWorkspace(null)}
              onUpload={() => setWorkspaceView("upload")}
              workspace={selectedWorkspace}
            />
          )
        ) : (
          <WorkspacesPage
            createDialogOpen={createDialogOpen}
            createError={createError}
            error={error}
            isCreating={isCreating}
            isLoading={isLoading}
            onCreateDialogOpenChange={setCreateDialogOpen}
            onCreateWorkspace={handleCreateWorkspace}
            onOpenWorkspace={(workspace) => {
              if (workspace.id !== "preview-workspace") {
                setSelectedWorkspace(workspace);
                setWorkspaceView("documents");
              }
            }}
            setWorkspaceDescription={setWorkspaceDescription}
            setWorkspaceName={setWorkspaceName}
            visibleWorkspaces={visibleWorkspaces}
            workspaceDescription={workspaceDescription}
            workspaceName={workspaceName}
          />
        )}
      </section>
    </main>
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

function WorkspacesPage({
  createDialogOpen,
  createError,
  error,
  isCreating,
  isLoading,
  onCreateDialogOpenChange,
  onCreateWorkspace,
  onOpenWorkspace,
  setWorkspaceDescription,
  setWorkspaceName,
  visibleWorkspaces,
  workspaceDescription,
  workspaceName,
}: {
  createDialogOpen: boolean;
  createError: string | null;
  error: string | null;
  isCreating: boolean;
  isLoading: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => void;
  onOpenWorkspace: (workspace: Workspace) => void;
  setWorkspaceDescription: (description: string) => void;
  setWorkspaceName: (name: string) => void;
  visibleWorkspaces: Workspace[];
  workspaceDescription: string;
  workspaceName: string;
}) {
  return (
    <>
      <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-5">
          <Badge
            className="border-blue-300/30 bg-blue-400/10 text-blue-100 hover:bg-blue-400/15"
            variant="outline"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Your knowledge spaces
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Your Workspaces
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Pick a workspace to upload documents, track ingestion, and ask
              questions across your private knowledge base.
            </p>
          </div>
        </div>
        <CreateWorkspaceDialog
          createError={createError}
          isCreating={isCreating}
          onCreateWorkspace={onCreateWorkspace}
          onOpenChange={onCreateDialogOpenChange}
          open={createDialogOpen}
          setWorkspaceDescription={setWorkspaceDescription}
          setWorkspaceName={setWorkspaceName}
          workspaceDescription={workspaceDescription}
          workspaceName={workspaceName}
        />
      </header>

      {error ? (
        <div className="mb-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          Could not load workspaces: {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[25rem] animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleWorkspaces.map((workspace, index) => (
            <WorkspaceCard
              key={workspace.id}
              index={index}
              onOpenWorkspace={onOpenWorkspace}
              workspace={workspace}
            />
          ))}
        </div>
      )}
    </>
  );
}

function DocumentsPage({
  documents,
  error,
  isLoading,
  onBack,
  onUpload,
  workspace,
}: {
  documents: Document[];
  error: string | null;
  isLoading: boolean;
  onBack: () => void;
  onUpload: () => void;
  workspace: Workspace;
}) {
  return (
    <>
      <header className="mb-12 space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <button
            className="group inline-flex items-center gap-2 rounded-full border border-blue-300/10 bg-white/[0.03] px-3 py-1.5 text-blue-100 transition hover:border-blue-300/30 hover:bg-blue-400/10 hover:text-white"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
            All Workspaces
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
            {workspace.name}
          </span>
        </nav>

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-5">
            <Badge
              className="border-blue-300/30 bg-blue-400/10 text-blue-100 hover:bg-blue-400/15"
              variant="outline"
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              Workspace documents
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Your Documents
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Viewing documents inside{" "}
                <span className="text-blue-100">{workspace.name}</span>.
                Uploads, ingestion progress, and retrieval will live here.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              className="bg-blue-500 text-white shadow-[0_0_35px_rgba(59,130,246,0.45)] hover:bg-blue-400"
              onClick={onUpload}
            >
              <FileText className="mr-2 h-4 w-4" />
              Upload document(s)
            </Button>
            <div className="flex min-w-32 flex-col items-center justify-center rounded-2xl border border-blue-300/15 bg-white/[0.04] px-5 py-4 text-center shadow-[0_0_36px_rgba(59,130,246,0.12)] backdrop-blur-xl">
              <p className="text-3xl font-semibold leading-none text-white">
                {documents.length}
              </p>
              <p className="mt-1 text-sm text-slate-400">documents</p>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-8 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          Could not load documents: {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[25rem] animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card className="relative overflow-hidden border-white/10 bg-slate-950/70 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl">
          <div className="absolute right-10 top-0 h-28 w-28 rounded-full bg-cyan-300/20 blur-3xl" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl text-white">
              No documents yet
            </CardTitle>
            <CardDescription className="max-w-xl text-slate-300">
              This workspace is ready. The next step will add document upload
              here so files can be ingested and queried.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document, index) => (
            <DocumentCard document={document} index={index} key={document.id} />
          ))}
        </div>
      )}
    </>
  );
}

function UploadFilePage({
  onBack,
  onBackToWorkspaces,
  workspace,
}: {
  onBack: () => void;
  onBackToWorkspaces: () => void;
  workspace: Workspace;
}) {
  return (
    <>
      <header className="mb-12 space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <button
            className="group inline-flex items-center gap-2 rounded-full border border-blue-300/10 bg-white/[0.03] px-3 py-1.5 text-blue-100 transition hover:border-blue-300/30 hover:bg-blue-400/10 hover:text-white"
            onClick={onBackToWorkspaces}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
            All Workspaces
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <button
            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/40 hover:bg-cyan-300/15 hover:text-white"
            onClick={onBack}
            type="button"
          >
            {workspace.name}
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.15)]">
            Upload File
          </span>
        </nav>

        <div className="max-w-3xl space-y-5">
          <Badge className="border-blue-300/30 bg-blue-400/10 text-blue-100 hover:bg-blue-400/15" variant="outline">
            <CloudUpload className="mr-1 h-3.5 w-3.5" />
            Upload documents
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Upload File
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Add files to <span className="text-blue-100">{workspace.name}</span>. They will be queued for ingestion and become searchable once processing completes.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_3fr]">
        <Card className="relative overflow-hidden border-blue-300/15 bg-slate-950/70 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl">
          <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-blue-700/30 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-300/15 blur-3xl" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl text-white">Choose document(s)</CardTitle>
            <CardDescription className="text-slate-300">
              Drag and drop files here, or browse from your device.
            </CardDescription>
          </CardHeader>
          <div className="relative z-10 px-6 pb-6">
            <label
              className="group flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/30 bg-blue-400/[0.04] p-8 text-center transition hover:border-blue-200/60 hover:bg-blue-400/[0.08] hover:shadow-[0_0_60px_rgba(59,130,246,0.2)]"
              htmlFor="upload-files"
            >
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-blue-200/20 bg-blue-400/10 text-blue-100 shadow-[0_0_55px_rgba(59,130,246,0.35)] transition group-hover:scale-105 group-hover:bg-blue-400/15">
                <CloudUpload className="h-11 w-11" />
              </div>
              <p className="text-2xl font-semibold text-white">Drop your files here</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                PDF and document uploads will appear in the progress panel after upload starts.
              </p>
              <div className="mt-8 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_35px_rgba(59,130,246,0.45)] transition group-hover:bg-blue-500">
                <Upload className="mr-2 h-4 w-4" />
                Upload file(s)
              </div>
              <input id="upload-files" multiple type="file" className="sr-only" />
            </label>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-blue-300/15 bg-slate-950/70 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-28 rounded-full bg-blue-500/20 blur-3xl" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-2xl text-white">Progress</CardTitle>
            <CardDescription className="text-slate-300">
              Upload and ingestion progress will appear here.
            </CardDescription>
          </CardHeader>
          <div className="relative z-10 flex min-h-[22rem] items-center justify-center px-6 pb-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-100">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="font-medium text-white">Waiting for files</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
                This section is intentionally empty until you start uploading documents.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function CreateWorkspaceDialog({
  createError,
  isCreating,
  onCreateWorkspace,
  onOpenChange,
  open,
  setWorkspaceDescription,
  setWorkspaceName,
  workspaceDescription,
  workspaceName,
}: {
  createError: string | null;
  isCreating: boolean;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  setWorkspaceDescription: (description: string) => void;
  setWorkspaceName: (name: string) => void;
  workspaceDescription: string;
  workspaceName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-fit bg-blue-500 text-white shadow-[0_0_35px_rgba(59,130,246,0.45)] hover:bg-blue-400">
          Create Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden border-blue-300/20 bg-slate-950 text-white shadow-[0_0_80px_rgba(59,130,246,0.28)] sm:max-w-sm">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/25 blur-3xl" />
        <form className="relative z-10" onSubmit={onCreateWorkspace}>
          <DialogHeader>
            <DialogTitle className="text-white">Create workspace</DialogTitle>
            <DialogDescription className="text-slate-300">
              Create a space for related documents, embeddings, and
              conversations.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-6">
            <Field>
              <Label className="text-blue-100" htmlFor="workspace-name">
                Name
              </Label>
              <Input
                id="workspace-name"
                name="name"
                placeholder="Research papers"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500 focus-visible:ring-blue-300"
              />
            </Field>
            <Field>
              <Label className="text-blue-100" htmlFor="workspace-description">
                Description <span className="text-slate-400">(optional)</span>
              </Label>
              <Input
                id="workspace-description"
                name="description"
                placeholder="PDFs, notes, and technical docs"
                value={workspaceDescription}
                onChange={(event) =>
                  setWorkspaceDescription(event.target.value)
                }
                className="border-blue-200/20 bg-white/10 text-white placeholder:text-slate-500 focus-visible:ring-blue-300"
              />
            </Field>
            {createError ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
                {createError}
              </div>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                disabled={isCreating}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.35)] hover:bg-blue-400"
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceCard({
  index,
  onOpenWorkspace,
  workspace,
}: {
  index: number;
  onOpenWorkspace: (workspace: Workspace) => void;
  workspace: Workspace;
}) {
  const imageUrl = `https://avatar.vercel.sh/${encodeURIComponent(workspace.id)}.svg?text=${encodeURIComponent(
    workspace.name.slice(0, 2).toUpperCase(),
  )}`;

  return (
    <Card className="group relative mx-auto w-full overflow-hidden border-white/10 bg-slate-950/70 pt-0 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-blue-300/40 hover:shadow-blue-500/20">
      <div className="absolute inset-x-8 top-10 z-10 h-24 rounded-full bg-cyan-300/25 blur-3xl transition duration-300 group-hover:bg-blue-300/40" />
      <div className="absolute inset-0 z-30 aspect-video bg-black/35" />
      <div className="relative z-20 aspect-video w-full overflow-hidden bg-gradient-to-br from-blue-950 via-blue-500 to-cyan-300">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_10%,rgba(255,255,255,0.28)_35%,transparent_55%)] opacity-50 transition duration-500 group-hover:translate-x-16" />
        <img
          src={imageUrl}
          alt={`${workspace.name} cover`}
          className="relative z-20 h-full w-full object-cover opacity-65 brightness-75 grayscale mix-blend-overlay"
        />
      </div>
      <CardHeader className="relative z-40 gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-400/10 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.25)]">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <CardAction>
            <Badge
              className="border-blue-200/20 bg-white/10 text-blue-100"
              variant="outline"
            >
              Workspace {index + 1}
            </Badge>
          </CardAction>
        </div>
        <div className="space-y-2">
          <CardTitle className="line-clamp-1 text-2xl text-white">
            {workspace.name}
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-10 text-slate-300">
            {workspace.description ||
              "A dedicated place for documents, embeddings, retrieval, and answers."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardFooter className="relative z-40">
        <Button
          className="w-full bg-white text-slate-950 hover:bg-blue-100"
          onClick={() => onOpenWorkspace(workspace)}
        >
          Open Workspace
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function DocumentCard({
  document,
  index,
}: {
  document: Document;
  index: number;
}) {
  const imageUrl = `https://avatar.vercel.sh/${encodeURIComponent(document.id)}.svg?text=${encodeURIComponent(
    document.original_filename.slice(0, 2).toUpperCase(),
  )}`;

  return (
    <Card className="group relative mx-auto w-full overflow-hidden border-white/10 bg-slate-950/70 pt-0 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-blue-300/40 hover:shadow-blue-500/20">
      <div className="absolute inset-x-8 top-10 z-10 h-24 rounded-full bg-cyan-300/25 blur-3xl transition duration-300 group-hover:bg-blue-300/40" />
      <div className="absolute inset-0 z-30 aspect-video bg-black/35" />
      <div className="relative z-20 aspect-video w-full overflow-hidden bg-gradient-to-br from-slate-950 via-blue-700 to-cyan-300">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_10%,rgba(255,255,255,0.28)_35%,transparent_55%)] opacity-50 transition duration-500 group-hover:translate-x-16" />
        <img
          src={imageUrl}
          alt={`${document.original_filename} cover`}
          className="relative z-20 h-full w-full object-cover opacity-60 brightness-75 grayscale mix-blend-overlay"
        />
      </div>
      <CardHeader className="relative z-40 gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-400/10 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.25)]">
            <FileText className="h-5 w-5" />
          </div>
          <CardAction className="flex flex-col items-end gap-2">
            <Badge
              className={
                document.status === "completed"
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                  : "border-blue-200/20 bg-white/10 text-blue-100"
              }
              variant="outline"
            >
              {document.status}
            </Badge>
            <Badge
              className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
              variant="outline"
            >
              {getDocumentType(document)}
            </Badge>
          </CardAction>
        </div>
        <div className="space-y-2">
          <CardTitle className="line-clamp-1 text-2xl text-white">
            {document.original_filename}
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-10 text-slate-300">
            Stage: <span className="text-blue-100">{document.stage}</span> ·{" "}
            {formatBytes(document.size_bytes)} · Document {index + 1}
          </CardDescription>
        </div>
      </CardHeader>
      <CardFooter className="relative z-40 text-sm text-slate-400">
        Uploaded {formatDate(document.created_at)}
      </CardFooter>
    </Card>
  );
}

function getDocumentType(document: Document) {
  const filenameExtension = document.original_filename.split(".").pop();
  if (filenameExtension && filenameExtension !== document.original_filename) {
    return filenameExtension.toUpperCase();
  }

  if (document.content_type) {
    return document.content_type.split("/").pop()?.toUpperCase() || "FILE";
  }

  return "FILE";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default App;
