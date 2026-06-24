import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  CloudUpload,
  FileText,
  MessageCircle,
  Send,
  Sparkles,
  Upload,
  User,
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
  askDocumentQuestion,
  buildDocumentEventsUrl,
  createWorkspace,
  getDocumentChunks,
  getDocumentPartitionItems,
  listDocuments,
  listWorkspaces,
  uploadDocument,
  type Document,
  type DocumentChunk,
  type DocumentPartitionItem,
  type DocumentStatusEvent,
  type ProcessingMetadata,
  type RetrievalSource,
  type Workspace,
} from "@/lib/api";

function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null,
  );
  const [workspaceView, setWorkspaceView] = useState<"documents" | "upload" | "chat">(
    "documents",
  );
  const [selectedChatDocument, setSelectedChatDocument] = useState<Document | null>(null);
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

      <section
        className={
          selectedWorkspace && workspaceView === "chat"
            ? "relative z-10 flex min-h-screen w-full flex-col"
            : "relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-8"
        }
      >
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
          ) : workspaceView === "chat" && selectedChatDocument ? (
            <DocumentChatPage
              document={selectedChatDocument}
              documents={documents}
              onBack={() => setWorkspaceView("documents")}
              onSelectDocument={(document) => setSelectedChatDocument(document)}
              workspace={selectedWorkspace}
            />
          ) : (
            <DocumentsPage
              documents={documents}
              error={documentsError}
              isLoading={isDocumentsLoading}
              onBack={() => setSelectedWorkspace(null)}
              onChat={(document) => {
                setSelectedChatDocument(document);
                setWorkspaceView("chat");
              }}
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
  onChat,
  onUpload,
  workspace,
}: {
  documents: Document[];
  error: string | null;
  isLoading: boolean;
  onBack: () => void;
  onChat: (document: Document) => void;
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
            <DocumentCard document={document} index={index} key={document.id} onChat={onChat} />
          ))}
        </div>
      )}
    </>
  );
}

const INGESTION_STEPS = [
  { stage: "uploaded", label: "Uploaded" },
  { stage: "starting", label: "Starting" },
  { stage: "partitioning", label: "Partitioning" },
  { stage: "chunking", label: "Chunking" },
  { stage: "summarizing", label: "Summarizing" },
  { stage: "embedding", label: "Embedding" },
  { stage: "completed", label: "Completed" },
];

type UploadProgressItem = {
  localId: string;
  fileName: string;
  documentId?: string;
  status: string;
  stage: string;
  errorMessage?: string | null;
  updatedAt?: string | null;
  processingMetadata?: ProcessingMetadata | null;
  events: DocumentStatusEvent[];
};

function UploadFilePage({
  onBack,
  onBackToWorkspaces,
  workspace,
}: {
  onBack: () => void;
  onBackToWorkspaces: () => void;
  workspace: Workspace;
}) {
  const [progressItems, setProgressItems] = useState<UploadProgressItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeProgressView, setActiveProgressView] = useState<"progress" | "details">("progress");
  const [activeDetailSection, setActiveDetailSection] = useState("partitioning");
  const eventSourcesRef = useRef<EventSource[]>([]);

  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach((eventSource) => eventSource.close());
      eventSourcesRef.current = [];
    };
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    await Promise.all(
      selectedFiles.map(async (file) => {
        const localId = `${file.name}-${file.lastModified}-${crypto.randomUUID()}`;
        setProgressItems((current) => [
          ...current,
          { localId, fileName: file.name, status: "uploading", stage: "uploading", events: [] },
        ]);

        try {
          const document = await uploadDocument(workspace.id, file);
          const initialEvent: DocumentStatusEvent = {
            id: document.id,
            status: document.status,
            stage: document.stage,
            error_message: document.error_message,
            updated_at: document.updated_at,
            processing_metadata: document.processing_metadata,
          };

          setProgressItems((current) =>
            current.map((item) =>
              item.localId === localId
                ? {
                    ...item,
                    documentId: document.id,
                    status: document.status,
                    stage: document.stage,
                    errorMessage: document.error_message,
                    updatedAt: document.updated_at,
                    processingMetadata: document.processing_metadata,
                    events: [initialEvent],
                  }
                : item,
            ),
          );

          subscribeToDocumentEvents(localId, document.id);
        } catch (err) {
          setProgressItems((current) =>
            current.map((item) =>
              item.localId === localId
                ? {
                    ...item,
                    status: "failed",
                    stage: "failed",
                    errorMessage: err instanceof Error ? err.message : "Upload failed",
                  }
                : item,
            ),
          );
        }
      }),
    );
  }

  function subscribeToDocumentEvents(localId: string, documentId: string) {
    const eventSource = new EventSource(buildDocumentEventsUrl(workspace.id, documentId));
    eventSourcesRef.current.push(eventSource);

    eventSource.addEventListener("document_status", (event) => {
      const payload = JSON.parse(event.data) as DocumentStatusEvent;

      setProgressItems((current) =>
        current.map((item) => {
          if (item.localId !== localId) return item;

          const lastEvent = item.events[item.events.length - 1];
          const isDuplicate =
            lastEvent?.status === payload.status &&
            lastEvent?.stage === payload.stage &&
            lastEvent?.updated_at === payload.updated_at;

          return {
            ...item,
            status: payload.status,
            stage: payload.stage,
            errorMessage: payload.error_message,
            updatedAt: payload.updated_at,
            processingMetadata: payload.processing_metadata,
            events: isDuplicate ? item.events : [...item.events, payload],
          };
        }),
      );

      if (payload.status === "completed" || payload.status === "failed") {
        eventSource.close();
      }
    });

    eventSource.onerror = () => eventSource.close();
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <>
      <header className="mb-12 space-y-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <button className="group inline-flex items-center gap-2 rounded-full border border-blue-300/10 bg-white/[0.03] px-3 py-1.5 text-blue-100 transition hover:border-blue-300/30 hover:bg-blue-400/10 hover:text-white" onClick={onBackToWorkspaces} type="button">
            <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
            All Workspaces
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <button className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/40 hover:bg-cyan-300/15 hover:text-white" onClick={onBack} type="button">
            {workspace.name}
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.15)]">Upload File</span>
        </nav>

        <div className="max-w-3xl space-y-5">
          <Badge className="border-blue-300/30 bg-blue-400/10 text-blue-100 hover:bg-blue-400/15" variant="outline">
            <CloudUpload className="mr-1 h-3.5 w-3.5" />
            Upload documents
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Upload File</h1>
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
            <CardDescription className="text-slate-300">Drag and drop files here, or browse from your device.</CardDescription>
          </CardHeader>
          <div className="relative z-10 px-6 pb-6">
            <label
              className={`group flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center transition hover:shadow-[0_0_60px_rgba(59,130,246,0.2)] ${isDragActive ? "border-blue-200/70 bg-blue-400/[0.1]" : "border-blue-300/30 bg-blue-400/[0.04] hover:border-blue-200/60 hover:bg-blue-400/[0.08]"}`}
              htmlFor="upload-files"
              onDragEnter={(event) => { event.preventDefault(); setIsDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); setIsDragActive(false); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-blue-200/20 bg-blue-400/10 text-blue-100 shadow-[0_0_55px_rgba(59,130,246,0.35)] transition group-hover:scale-105 group-hover:bg-blue-400/15">
                <CloudUpload className="h-11 w-11" />
              </div>
              <p className="text-2xl font-semibold text-white">Drop your files here</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">PDF and document uploads will appear in the progress panel after upload starts.</p>
              <div className="mt-8 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_35px_rgba(59,130,246,0.45)] transition group-hover:bg-blue-500">
                <Upload className="mr-2 h-4 w-4" />
                Upload file(s)
              </div>
              <input id="upload-files" multiple type="file" className="sr-only" onChange={(event) => { if (event.target.files) { handleFiles(event.target.files); event.target.value = ""; } }} />
            </label>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-blue-300/15 bg-slate-950/70 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-28 rounded-full bg-blue-500/20 blur-3xl" />
          <CardHeader className="relative z-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-2xl text-white">Progress</CardTitle>
                <CardDescription className="mt-1 text-slate-300">Upload and ingestion progress will appear here.</CardDescription>
              </div>
              <div className="grid w-full grid-cols-2 rounded-full border border-blue-300/15 bg-white/[0.04] p-1 sm:w-56">
                <button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeProgressView === "progress"
                      ? "bg-blue-300/15 text-blue-50 shadow-[0_0_20px_rgba(59,130,246,0.18)]"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  }`}
                  onClick={() => setActiveProgressView("progress")}
                  type="button"
                >
                  Progress
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeProgressView === "details"
                      ? "bg-blue-300/15 text-blue-50 shadow-[0_0_20px_rgba(59,130,246,0.18)]"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                  }`}
                  onClick={() => setActiveProgressView("details")}
                  type="button"
                >
                  Details
                </button>
              </div>
            </div>
          </CardHeader>
          <div className="relative z-10 min-h-[22rem] px-6 pb-6">
            {activeProgressView === "progress" ? (
              progressItems.length === 0 ? (
                <div className="flex min-h-[22rem] items-center justify-center">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-100">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <p className="font-medium text-white">Waiting for files</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">This section is intentionally empty until you start uploading documents.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {progressItems.map((item) => <UploadProgressCard item={item} key={item.localId} />)}
                </div>
              )
            ) : (
              <UploadDetailsPanel
                activeSection={activeDetailSection}
                items={progressItems}
                onSectionChange={setActiveDetailSection}
                workspaceId={workspace.id}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

const DETAIL_SECTIONS = [
  { id: "partitioning", label: "Partitions" },
  { id: "chunking", label: "Chunks" },
  { id: "summarizing", label: "Summarization" },
  { id: "embedding", label: "Embeddings" },
];

function UploadDetailsPanel({
  activeSection,
  items,
  onSectionChange,
  workspaceId,
}: {
  activeSection: string;
  items: UploadProgressItem[];
  onSectionChange: (section: string) => void;
  workspaceId: string;
}) {
  const [partitionView, setPartitionView] = useState<"summary" | "text" | "images" | "tables" | "category">("summary");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [partitionItems, setPartitionItems] = useState<DocumentPartitionItem[]>([]);
  const [isLoadingPartitionItems, setIsLoadingPartitionItems] = useState(false);
  const [partitionItemsError, setPartitionItemsError] = useState<string | null>(null);
  const [chunkView, setChunkView] = useState<"summary" | "all">("summary");
  const [summaryView, setSummaryView] = useState<"summary" | "all">("summary");
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [chunksError, setChunksError] = useState<string | null>(null);

  const latestItemWithMetadata = [...items]
    .reverse()
    .find((item) => item.processingMetadata?.partitioning);
  const partitioning = latestItemWithMetadata?.processingMetadata?.partitioning;
  const documentId = latestItemWithMetadata?.documentId;

  useEffect(() => {
    setPartitionView("summary");
    setSelectedCategory(null);
    setChunkView("summary");
    setSummaryView("summary");
  }, [activeSection, documentId]);

  useEffect(() => {
    if (activeSection !== "partitioning" || partitionView === "summary" || !documentId) {
      return;
    }

    let ignore = false;

    async function loadChunks() {
      try {
        setIsLoadingPartitionItems(true);
        setPartitionItemsError(null);
        const contentType =
          partitionView === "images"
            ? "image"
            : partitionView === "tables"
              ? "table"
              : partitionView === "category"
                ? "all"
                : "text";
        const response = await getDocumentPartitionItems(workspaceId, documentId as string, contentType);
        if (!ignore) {
          setPartitionItems(
            partitionView === "category" && selectedCategory
              ? response.items.filter((item) => item.category === selectedCategory)
              : response.items,
          );
        }
      } catch (err) {
        if (!ignore) {
          setPartitionItemsError(err instanceof Error ? err.message : "Failed to load partition content");
        }
      } finally {
        if (!ignore) {
          setIsLoadingPartitionItems(false);
        }
      }
    }

    loadChunks();

    return () => {
      ignore = true;
    };
  }, [activeSection, documentId, partitionView, selectedCategory, workspaceId]);

  useEffect(() => {
    if (!["chunking", "summarizing"].includes(activeSection) || !documentId) {
      return;
    }

    let ignore = false;

    async function loadDocumentChunks() {
      try {
        setIsLoadingChunks(true);
        setChunksError(null);
        const response = await getDocumentChunks(workspaceId, documentId as string);
        if (!ignore) {
          setChunks(response.chunks);
        }
      } catch (err) {
        if (!ignore) {
          setChunksError(err instanceof Error ? err.message : "Failed to load chunks");
        }
      } finally {
        if (!ignore) {
          setIsLoadingChunks(false);
        }
      }
    }

    loadDocumentChunks();

    return () => {
      ignore = true;
    };
  }, [activeSection, documentId, workspaceId]);

  return (
    <div className="grid min-h-[22rem] gap-5 lg:grid-cols-[13rem_1fr]">
      <div className="space-y-3">
        {DETAIL_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                isActive
                  ? "border-blue-300/35 bg-blue-900/35 text-blue-50 shadow-[0_0_24px_rgba(30,64,175,0.22)]"
                  : "border-blue-300/10 bg-blue-950/20 text-slate-300 hover:border-blue-300/25 hover:bg-blue-900/25 hover:text-blue-50"
              }`}
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              type="button"
            >
              {section.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/15 p-5">
        {activeSection === "partitioning" ? (
          partitioning ? (
            partitionView === "summary" ? (
              <>
                <div className="mb-5">
                  <p className="text-lg font-semibold text-white">Partition details</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Real partition statistics from {latestItemWithMetadata?.fileName}.
                  </p>
                </div>
                <div className="mb-3">
                  <DetailMetricCard label="Total Elements Found" value={partitioning.elements_found ?? 0} wide />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <DetailMetricCard clickable label="Text" onClick={() => setPartitionView("text")} value={partitioning.text ?? 0} />
                  <DetailMetricCard clickable label="Images" onClick={() => setPartitionView("images")} value={partitioning.images ?? 0} />
                  <DetailMetricCard clickable label="Tables" onClick={() => setPartitionView("tables")} value={partitioning.tables ?? 0} />
                </div>
                {partitioning.categories ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(partitioning.categories)
                      .filter(([label]) => !["Table", "Image"].includes(label))
                      .map(([label, value]) => (
                        <DetailMetricCard
                        clickable
                        key={label}
                        label={label}
                        onClick={() => {
                          setSelectedCategory(label);
                          setPartitionView("category");
                        }}
                        value={value}
                      />
                      ))}
                  </div>
                ) : null}
              </>
            ) : (
              <PartitionContentView
                error={partitionItemsError}
                isLoading={isLoadingPartitionItems}
                items={partitionItems}
                onBack={() => setPartitionView("summary")}
                selectedCategory={selectedCategory}
                view={partitionView}
              />
            )
          ) : (
            <EmptyDetailsState message="Partition details will appear here after partitioning completes." />
          )
        ) : activeSection === "chunking" ? (
          <ChunksDetailsPanel
            chunks={chunks}
            error={chunksError}
            isLoading={isLoadingChunks}
            onOpenAll={() => setChunkView("all")}
            onBack={() => setChunkView("summary")}
            partitionElementCount={partitioning?.elements_found ?? 0}
            smartChunkCount={latestItemWithMetadata?.processingMetadata?.chunking?.chunks_created ?? chunks.length}
            view={chunkView}
          />
        ) : activeSection === "summarizing" ? (
          <SummarizationDetailsPanel
            chunks={chunks}
            error={chunksError}
            isLoading={isLoadingChunks}
            onOpenAll={() => setSummaryView("all")}
            onBack={() => setSummaryView("summary")}
            smartChunkCount={latestItemWithMetadata?.processingMetadata?.chunking?.chunks_created ?? chunks.length}
            view={summaryView}
          />
        ) : (
          <EmptyDetailsState message="We will design this detail section next." />
        )}
      </div>
    </div>
  );
}

function SummarizationDetailsPanel({
  chunks,
  error,
  isLoading,
  onBack,
  onOpenAll,
  smartChunkCount,
  view,
}: {
  chunks: DocumentChunk[];
  error: string | null;
  isLoading: boolean;
  onBack: () => void;
  onOpenAll: () => void;
  smartChunkCount: number;
  view: "summary" | "all";
}) {
  const multimodalChunks = chunks.filter(isMultimodalSummaryChunk);
  const multimodalCount = multimodalChunks.length;

  if (view === "all") {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <button
            className="rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-blue-100 transition hover:border-blue-200/45 hover:text-white"
            onClick={onBack}
            type="button"
          >
            Summarization
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <span className="rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-purple-100">
            Enhanced summaries
          </span>
        </div>

        {isLoading ? (
          <EmptyDetailsState message="Loading enhanced summaries..." />
        ) : error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : multimodalChunks.length === 0 ? (
          <EmptyDetailsState message="No multimodal summaries found for this document yet." />
        ) : (
          <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-2">
            {multimodalChunks.map((chunk, index) => (
              <SummaryContentCard chunk={chunk} index={index} key={`${chunk.chunk_index}-${index}`} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-lg font-semibold text-white">Summarization details</p>
        <p className="mt-1 text-sm text-slate-400">Review AI-enhanced summaries generated from smart chunks.</p>
      </div>
      {error ? (
        <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}
      <button
        className="group w-full rounded-2xl border border-purple-300/20 bg-gradient-to-r from-blue-500/[0.08] via-purple-500/[0.08] to-blue-950/30 p-5 text-left transition hover:-translate-y-0.5 hover:border-purple-200/35 hover:shadow-[0_0_50px_rgba(168,85,247,0.18)]"
        disabled={isLoading || multimodalCount === 0}
        onClick={onOpenAll}
        type="button"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-lg font-semibold text-purple-50 drop-shadow-[0_0_14px_rgba(168,85,247,0.35)]">
            {smartChunkCount} Chunks Processed
            <span className="mx-3 text-blue-200/70">→</span>
            {multimodalCount} Multimodal Summaries
          </p>
          <Badge className="border-purple-300/30 bg-purple-300/10 text-purple-100" variant="outline">
            Open summaries
          </Badge>
        </div>
        <p className="mt-2 text-sm text-slate-400">Click to view each enhanced summary in clean vertical cards.</p>
      </button>
    </div>
  );
}

function SummaryContentCard({ chunk, index }: { chunk: DocumentChunk; index: number }) {
  const summaryStatus = getChunkSummaryStatus(chunk);
  const isAiGenerated = summaryStatus === "ai_generated";
  const hasFailed = summaryStatus === "fallback";

  if (!isMultimodalSummaryChunk(chunk)) {
    return null;
  }

  return (
    <div className={`rounded-2xl border bg-white/[0.035] p-4 transition hover:shadow-[0_0_45px_rgba(168,85,247,0.18)] ${
      hasFailed
        ? "border-red-300/20 hover:border-red-300/35"
        : "border-purple-300/15 hover:border-purple-300/30"
    }`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-purple-100">
          {index + 1}. Enhanced Summary for Chunk {chunk.chunk_index}
        </p>
        <Badge className={hasFailed ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-purple-300/30 bg-purple-300/10 text-purple-100"} variant="outline">
          {hasFailed ? "Failed" : "AI Generated"}
        </Badge>
      </div>
      {isAiGenerated ? (
        <div className="rounded-xl border border-purple-300/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="mb-3 mt-4 text-xl font-semibold text-white first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-3 mt-4 text-lg font-semibold text-white first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold text-purple-100 first:mt-0">{children}</h3>,
              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
              ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
              li: ({ children }) => <li className="pl-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            }}
          >
            {chunk.enhanced_content || "No generated summary available."}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="rounded-xl border border-red-300/15 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-100">Failed summary</p>
          <p className="mt-1 text-sm leading-6 text-red-100/75">
            The AI summary could not be generated for this multimodal chunk.
          </p>
        </div>
      )}
    </div>
  );
}

function isMultimodalSummaryChunk(chunk: DocumentChunk) {
  return chunk.metadata.is_multimodal === true;
}

function getChunkSummaryStatus(chunk: DocumentChunk) {
  return typeof chunk.metadata.summary_status === "string" ? chunk.metadata.summary_status : "unknown";
}

function ChunksDetailsPanel({
  chunks,
  error,
  isLoading,
  onBack,
  onOpenAll,
  partitionElementCount,
  smartChunkCount,
  view,
}: {
  chunks: DocumentChunk[];
  error: string | null;
  isLoading: boolean;
  onBack: () => void;
  onOpenAll: () => void;
  partitionElementCount: number;
  smartChunkCount: number;
  view: "summary" | "all";
}) {
  if (view === "all") {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <button
            className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-cyan-100 transition hover:border-cyan-200/45 hover:text-white"
            onClick={onBack}
            type="button"
          >
            Chunks
          </button>
          <ChevronRight className="h-4 w-4 text-blue-200/50" />
          <span className="rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-blue-100">
            All chunks
          </span>
        </div>

        {isLoading ? (
          <EmptyDetailsState message="Loading smart chunks..." />
        ) : error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : chunks.length === 0 ? (
          <EmptyDetailsState message="No chunks found for this document yet." />
        ) : (
          <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-2">
            {chunks.map((chunk, index) => (
              <ChunkContentCard chunk={chunk} index={index} key={`${chunk.chunk_index}-${index}`} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-lg font-semibold text-white">Chunk details</p>
        <p className="mt-1 text-sm text-slate-400">Review how partition elements were grouped into smart retrieval chunks.</p>
      </div>
      {error ? (
        <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}
      <button
        className="group w-full rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/[0.08] via-blue-500/[0.07] to-blue-950/30 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:shadow-[0_0_50px_rgba(34,211,238,0.18)]"
        disabled={isLoading || chunks.length === 0}
        onClick={onOpenAll}
        type="button"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-lg font-semibold text-cyan-50 drop-shadow-[0_0_14px_rgba(34,211,238,0.35)]">
            {partitionElementCount} Total Partition Elements
            <span className="mx-3 text-blue-200/70">→</span>
            {smartChunkCount} Smart Chunks
          </p>
          <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100" variant="outline">
            Open all
          </Badge>
        </div>
        <p className="mt-2 text-sm text-slate-400">Click to view every chunk with text, rendered images, rendered tables, and content tags.</p>
      </button>
    </div>
  );
}

function ChunkContentCard({ chunk, index }: { chunk: DocumentChunk; index: number }) {
  const textCount = chunk.raw_text?.trim() ? 1 : 0;
  const imageCount = chunk.images_base64.length;
  const tableCount = chunk.tables_html.length;

  return (
    <div className="rounded-2xl border border-blue-300/15 bg-white/[0.035] p-4 transition hover:border-blue-300/30 hover:shadow-[0_0_45px_rgba(59,130,246,0.2)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-100">
            {index + 1}. Smart Chunk {chunk.chunk_index}
          </p>
          <p className="mt-1 text-xs text-slate-500">Stored retrieval chunk content</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MiniChunkTag className="border-blue-300/30 bg-blue-400/10 text-blue-100" label={`${textCount} text${textCount === 1 ? "" : "s"}`} />
          <MiniChunkTag className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100" label={`${imageCount} image${imageCount === 1 ? "" : "s"}`} />
          <MiniChunkTag className="border-purple-300/30 bg-purple-400/10 text-purple-100" label={`${tableCount} table${tableCount === 1 ? "" : "s"}`} />
        </div>
      </div>

      <div className="space-y-4">
        {chunk.raw_text ? (
          <p className="whitespace-pre-wrap rounded-xl border border-blue-300/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">{chunk.raw_text}</p>
        ) : null}
        {chunk.images_base64.map((image, imageIndex) => (
          <img
            alt={`Chunk ${chunk.chunk_index} extracted visual ${imageIndex + 1}`}
            className="max-h-96 w-full rounded-xl border border-cyan-300/15 bg-black/30 object-contain p-2"
            key={`${chunk.chunk_index}-image-${imageIndex}`}
            src={image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`}
          />
        ))}
        {chunk.tables_html.map((table, tableIndex) => (
          <div
            className="overflow-auto rounded-xl border border-blue-950/40 bg-white p-3 text-slate-950"
            dangerouslySetInnerHTML={{ __html: table }}
            key={`${chunk.chunk_index}-table-${tableIndex}`}
          />
        ))}
      </div>
    </div>
  );
}

function MiniChunkTag({ className, label }: { className: string; label: string }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${className}`}>
      {label}
    </span>
  );
}

function PartitionContentView({
  error,
  isLoading,
  items,
  onBack,
  selectedCategory,
  view,
}: {
  error: string | null;
  isLoading: boolean;
  items: DocumentPartitionItem[];
  onBack: () => void;
  selectedCategory: string | null;
  view: "text" | "images" | "tables" | "category";
}) {
  const title =
    view === "text"
      ? "Texts"
      : view === "images"
        ? "Images"
        : view === "tables"
          ? "Tables"
          : selectedCategory || "Category";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <button className="text-blue-100 transition hover:text-white" onClick={onBack} type="button">
          Partitions
        </button>
        <ChevronRight className="h-4 w-4 text-blue-200/50" />
        <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-blue-100">
          {title}
        </span>
      </div>

      {isLoading ? (
        <EmptyDetailsState message={`Loading ${title.toLowerCase()}...`} />
      ) : error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : items.length === 0 ? (
        <EmptyDetailsState message={`No ${title.toLowerCase()} found in the stored partition content.`} />
      ) : (
        <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2">
          {items.map((item, index) => (
            <PartitionContentCard item={item} index={index} key={item.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartitionContentCard({ item, index }: { item: DocumentPartitionItem; index: number }) {
  return (
    <div className="rounded-2xl border border-blue-300/15 bg-white/[0.035] p-4 transition hover:border-blue-300/30 hover:shadow-[0_0_45px_rgba(59,130,246,0.2)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-blue-100">
          {index + 1}. Element {item.element_index}
        </p>
        <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100" variant="outline">
          {item.content_type === "text" ? "Text" : item.content_type === "image" ? "Image" : "Table"}
        </Badge>
      </div>
      {item.content_type === "text" ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.text}</p>
      ) : item.content_type === "image" ? (
        <img alt={`Extracted visual ${index + 1}`} className="max-h-96 w-full rounded-xl object-contain" src={`data:image/jpeg;base64,${item.image_base64}`} />
      ) : (
        <div className="overflow-auto rounded-xl bg-white p-3 text-slate-950" dangerouslySetInnerHTML={{ __html: item.table_html || item.text || "" }} />
      )}
    </div>
  );
}

function DetailMetricCard({
  clickable = false,
  label,
  onClick,
  subtle = false,
  value,
  wide = false,
}: {
  clickable?: boolean;
  label: string;
  onClick?: () => void;
  subtle?: boolean;
  value: number;
  wide?: boolean;
}) {
  const Component = clickable ? "button" : "div";
  return (
    <Component
      className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_0_45px_rgba(59,130,246,0.22)] ${
        subtle
          ? "border-blue-300/10 bg-white/[0.03]"
          : "border-blue-300/20 bg-blue-400/[0.06]"
      } ${wide ? "flex items-center justify-between gap-4" : ""} ${clickable ? "cursor-pointer hover:border-blue-300/35 hover:bg-blue-400/[0.09]" : ""}`}
      onClick={onClick}
      type={clickable ? "button" : undefined}
    >
      <p className={wide ? "text-base font-medium text-slate-300" : "text-sm text-slate-400"}>{label}</p>
      <p className={wide ? "text-3xl font-semibold text-white" : "mt-2 text-2xl font-semibold text-white"}>{value}</p>
    </Component>
  );
}

function EmptyDetailsState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[18rem] items-center justify-center">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-100">
          <FileText className="h-6 w-6" />
        </div>
        <p className="font-medium text-white">Details waiting</p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function UploadProgressCard({ item }: { item: UploadProgressItem }) {
  const activeIndex = getActiveStepIndex(item.stage, item.status);

  return (
    <div className="rounded-3xl border border-blue-300/15 bg-white/[0.035] p-5 shadow-[0_0_45px_rgba(59,130,246,0.12)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="line-clamp-1 text-lg font-semibold text-white">{item.fileName}</p>
          <p className="mt-1 text-sm text-slate-400">{item.documentId ? `Document ${item.documentId}` : "Uploading file to workspace"}</p>
        </div>
        <Badge className={item.status === "failed" ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-blue-300/30 bg-blue-400/10 text-blue-100"} variant="outline">{item.status}</Badge>
      </div>

      <div className="mb-7 flex items-center">
        {INGESTION_STEPS.map((step, index) => {
          const isActive = index <= activeIndex;
          return (
            <div className="flex flex-1 items-center last:flex-none" key={step.stage}>
              <div className="flex flex-col items-center gap-2">
                <div className={`h-4 w-4 rounded-full border transition ${isActive ? "border-blue-200 bg-blue-400 shadow-[0_0_22px_rgba(96,165,250,0.9)]" : "border-slate-600 bg-slate-900"}`} />
                <span className={`whitespace-nowrap text-[11px] ${isActive ? "text-blue-100" : "text-slate-500"}`}>{step.label}</span>
              </div>
              {index < INGESTION_STEPS.length - 1 ? <div className={`mx-2 mb-6 h-[2px] flex-1 transition ${index < activeIndex ? "bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.85)]" : "bg-slate-700/80"}`} /> : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {item.events.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">1. Uploading file...</div>
        ) : (
          item.events.map((event, index) => (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3" key={`${event.stage}-${event.updated_at}-${index}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{index + 1}. {formatStageLabel(event.stage)}</p>
                <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100" variant="outline">{event.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-400">Stage changed to <span className="text-blue-100">{event.stage}</span></p>
              {event.error_message ? <p className="mt-2 text-sm text-red-200">{event.error_message}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getActiveStepIndex(stage: string, status: string) {
  if (status === "failed") return Math.max(0, INGESTION_STEPS.findIndex((step) => step.stage === stage));
  if (stage === "uploading") return -1;
  const index = INGESTION_STEPS.findIndex((step) => step.stage === stage);
  return index === -1 ? 0 : index;
}

function formatStageLabel(stage: string) {
  return INGESTION_STEPS.find((step) => step.stage === stage)?.label ?? stage;
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievalSource[];
};

function DocumentChatPage({
  document,
  documents,
  onBack,
  onSelectDocument,
  workspace,
}: {
  document: Document;
  documents: Document[];
  onBack: () => void;
  onSelectDocument: (document: Document) => void;
  workspace: Workspace;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi, I can answer questions using only ${document.original_filename}.`,
    },
  ]);
  const [query, setQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: `welcome-${document.id}`,
        role: "assistant",
        content: `Hi, I can answer questions using only ${document.original_filename}.`,
      },
    ]);
    setQuery("");
    setChatError(null);
  }, [document.id, document.original_filename]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isAsking]);

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = query.trim();
    if (!question || isAsking) {
      return;
    }

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: question },
    ]);
    setQuery("");
    setChatError(null);
    setIsAsking(true);

    try {
      const response = await askDocumentQuestion(workspace.id, document.id, question, 4);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to ask document");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid grid-cols-[420px_minmax(0,1fr)] bg-black text-white">
      <aside className="h-screen min-h-0 overflow-hidden border-r border-blue-300/20 bg-[linear-gradient(180deg,#020617_0%,#000814_42%,#000_100%)]">
        <div className="h-36 border-b border-blue-300/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.28),rgba(2,6,23,0.96)_52%,rgba(56,189,248,0.16))] px-6 py-5">
          <button
            className="mb-4 inline-flex items-center gap-2 text-sm text-blue-100 transition hover:text-white"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to documents
          </button>
          <p className="text-xs uppercase tracking-[0.28em] text-blue-200/70">Workspace</p>
          <h2 className="mt-2 line-clamp-1 text-xl font-semibold text-white">{workspace.name}</h2>
        </div>

        <div className="h-[calc(100vh-9rem)] overflow-y-auto [scrollbar-color:rgba(96,165,250,0.5)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/50 [&::-webkit-scrollbar-track]:bg-transparent">
          {documents.map((item) => {
            const isActive = item.id === document.id;
            const isCompleted = item.status === "completed";
            return (
              <button
                className={`relative flex w-full gap-4 border-b border-blue-200/10 px-6 py-5 text-left transition ${
                  isActive
                    ? "bg-[linear-gradient(90deg,rgba(59,130,246,0.42),rgba(56,189,248,0.16),rgba(0,0,0,0))] text-white shadow-[inset_6px_0_0_#7dd3fc]"
                    : "bg-transparent text-slate-300 hover:bg-blue-400/10 hover:text-white"
                } ${!isCompleted ? "cursor-not-allowed opacity-45" : ""}`}
                disabled={!isCompleted}
                key={item.id}
                onClick={() => onSelectDocument(item)}
                type="button"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
                  isActive
                    ? "border-blue-200/60 bg-blue-300/15 text-blue-100 shadow-[0_0_32px_rgba(125,211,252,0.28)]"
                    : "border-blue-300/20 bg-blue-950/30 text-blue-200"
                }`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="line-clamp-2 text-sm font-semibold">{item.original_filename}</p>
                  <p className="mt-1 text-xs text-slate-500">{getDocumentType(item)} · {item.status}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="relative grid h-screen min-h-0 grid-rows-[96px_minmax(0,1fr)_96px] overflow-hidden bg-[radial-gradient(circle_at_30%_0%,rgba(56,189,248,0.20),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(37,99,235,0.18),transparent_32%),linear-gradient(135deg,#000_0%,#020617_48%,#000_100%)]">
        <div className="pointer-events-none absolute left-1/4 top-0 h-80 w-[38rem] rounded-full bg-blue-400/14 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-16 h-80 w-[38rem] rounded-full bg-sky-300/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-[34rem] rounded-full bg-blue-900/30 blur-3xl" />

        <header className="relative z-10 border-b border-blue-300/20 bg-black/60 px-7 py-4 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="text-blue-200">All Workspaces</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-blue-100">{workspace.name}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-sky-100">Chat</span>
              </div>
              <h1 className="line-clamp-1 text-2xl font-semibold tracking-tight text-white">
                {document.original_filename}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {getDocumentType(document)} · {formatBytes(document.size_bytes)} · Uploaded {formatDate(document.created_at)}
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs text-blue-100">{getDocumentType(document)}</span>
              <span className="border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">{messages.length} messages</span>
            </div>
          </div>
        </header>

        <div
          className="relative z-10 min-h-0 overflow-y-auto [scrollbar-color:rgba(96,165,250,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/45 [&::-webkit-scrollbar-track]:bg-transparent"
          ref={messagesContainerRef}
        >
          <div className="mx-auto w-full max-w-6xl px-10 py-10">
            <div className="space-y-10">
              {messages.map((message) => (
                <ChatBubble message={message} key={message.id} />
              ))}
              {isAsking ? (
                <div className="flex items-center gap-3 border-l-2 border-sky-300 bg-sky-400/5 px-5 py-3 text-sm text-sky-100 shadow-[0_0_35px_rgba(56,189,248,0.12)]">
                  <Bot className="h-4 w-4" />
                  Thinking through document embeddings...
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <footer className="relative z-20 border-t border-blue-300/20 bg-black/80 p-4 backdrop-blur-xl">
          {chatError ? (
            <div className="mb-3 border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {chatError}
            </div>
          ) : null}
          <form className="h-full" onSubmit={handleAsk}>
            <div className="flex h-full gap-3 border border-blue-300/25 bg-[linear-gradient(90deg,rgba(37,99,235,0.18),rgba(0,0,0,0.55),rgba(56,189,248,0.10))] p-2 shadow-[0_0_55px_rgba(59,130,246,0.18)] focus-within:border-sky-200/45 focus-within:shadow-[0_0_70px_rgba(56,189,248,0.22)]">
              <Input
                className="h-full border-0 bg-transparent text-base text-white placeholder:text-slate-500 focus-visible:ring-0"
                disabled={isAsking}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask anything about this document..."
                value={query}
              />
              <Button
                className="h-full bg-[linear-gradient(90deg,#38bdf8,#2563eb,#0f172a)] px-6 text-white shadow-[0_0_35px_rgba(56,189,248,0.32)] hover:opacity-90"
                disabled={isAsking || !query.trim()}
                type="submit"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </footer>
      </section>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const mediaSources = message.sources?.filter((source) => source.images_base64.length > 0 || source.tables_html.length > 0) ?? [];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`w-full max-w-4xl ${isUser ? "ml-auto" : "mr-auto"}`}>
        <div className={`mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] ${isUser ? "justify-end text-blue-200/70" : "text-cyan-200/70"}`}>
          {isUser ? "You" : "Assistant"}
        </div>
        <div className={`border-l-2 px-5 py-1 ${
          isUser
            ? "border-blue-300 bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.08))] text-blue-50"
            : "border-cyan-300 bg-[linear-gradient(90deg,rgba(14,165,233,0.08),transparent)] text-slate-300"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-base leading-8">{message.content}</p>
          ) : (
            <div className="text-base leading-8 text-slate-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="mb-3 mt-5 text-2xl font-semibold text-white first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-3 mt-5 text-xl font-semibold text-white first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-cyan-100 first:mt-0">{children}</h3>,
                  p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                  li: ({ children }) => <li className="pl-1">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {!isUser && mediaSources.length ? (
            <div className="mt-5 space-y-4 border-t border-blue-300/15 pt-5">
              {mediaSources.flatMap((source, sourceIndex) =>
                source.images_base64.map((image, imageIndex) => (
                  <img
                    alt={`Source chunk ${source.chunk_index} visual ${imageIndex + 1}`}
                    className="max-h-96 w-full border border-blue-300/20 bg-black/40 object-contain p-2 shadow-[0_0_40px_rgba(59,130,246,0.12)]"
                    key={`image-${sourceIndex}-${imageIndex}`}
                    src={image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`}
                  />
                )),
              )}
              {mediaSources.flatMap((source, sourceIndex) =>
                source.tables_html.map((table, tableIndex) => (
                  <div
                    className="overflow-auto border border-blue-300/20 bg-white p-3 text-slate-950 shadow-[0_0_40px_rgba(59,130,246,0.12)]"
                    dangerouslySetInnerHTML={{ __html: table }}
                    key={`table-${sourceIndex}-${tableIndex}`}
                  />
                )),
              )}
            </div>
          ) : null}

          {!isUser && message.sources?.length ? (
            <div className="mt-5 border-t border-blue-300/15 pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Sources:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {message.sources.map((source, index) => (
                  <span className="text-xs text-blue-200/80 underline decoration-blue-300/30 underline-offset-4" key={`${source.chunk_index}-${index}`}>
                    Chunk {source.chunk_index ?? index + 1}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DocumentCard({
  document,
  index,
  onChat,
}: {
  document: Document;
  index: number;
  onChat: (document: Document) => void;
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
      <CardFooter className="relative z-40 flex items-center justify-between gap-3 text-sm text-slate-400">
        <span>Uploaded {formatDate(document.created_at)}</span>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/10 px-3.5 py-2 text-sm font-medium text-cyan-50 transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-100/15 hover:shadow-[0_0_26px_rgba(34,211,238,0.18)] disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-800/40 disabled:text-slate-500 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          disabled={document.status !== "completed"}
          onClick={() => onChat(document)}
          title={document.status === "completed" ? "Chat with this document" : "Chat is available after ingestion completes"}
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
          Chat
        </button>
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
