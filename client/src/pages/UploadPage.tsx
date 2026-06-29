import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ChevronRight, CloudUpload, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDocumentChunks,
  getDocumentPartitionItems,
  streamDocumentEvents,
  uploadDocument,
  type DocumentChunk,
  type DocumentPartitionItem,
  type DocumentStatusEvent,
  type ProcessingMetadata,
  type Workspace,
} from "@/lib/api";

const INGESTION_STEPS = [
  { stage: "uploaded", label: "Uploaded" },
  { stage: "extracting", label: "Extracting" },
  { stage: "partitioning", label: "Partitioning" },
  { stage: "chunking", label: "Chunking" },
  { stage: "summarizing", label: "Summarizing" },
  { stage: "embedding", label: "Embedding" },
  { stage: "completed", label: "Completed" },
];

export type UploadProgressItem = {
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

export function UploadFilePage({
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
  const eventControllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    return () => {
      eventControllersRef.current.forEach((controller) => controller.abort());
      eventControllersRef.current = [];
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
    const controller = new AbortController();
    eventControllersRef.current.push(controller);

    streamDocumentEvents(
      workspace.id,
      documentId,
      (payload) => {
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
          controller.abort();
        }
      },
      controller.signal,
    ).catch((err) => {
      if (!controller.signal.aborted) {
        setProgressItems((current) =>
          current.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  status: "failed",
                  stage: "failed",
                  errorMessage: err instanceof Error ? err.message : "Document event stream failed",
                }
              : item,
          ),
        );
      }
    });
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <>
      <header className="mb-10 space-y-6">
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
//   { id: "embedding", label: "Embeddings" },
];

export function UploadDetailsPanel({
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
    <div className="grid min-h-[14rem] gap-3 lg:grid-cols-[13rem_1fr]">
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

      <div className="rounded-3xl border border-white/10 bg-black/15 p-3">
        {activeSection === "partitioning" ? (
          partitioning ? (
            partitionView === "summary" ? (
              <>
                <div className="mb-3">
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
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
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
          <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-2 [scrollbar-color:rgba(96,165,250,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/45 [&::-webkit-scrollbar-track]:bg-transparent">
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
      <div className="mb-3">
        <p className="text-lg font-semibold text-white">Summarization details</p>
        <p className="mt-1 text-sm text-slate-400">Review AI-enhanced summaries generated from smart chunks.</p>
      </div>
      {error ? (
        <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}
      <button
        className="group w-full rounded-2xl border border-purple-300/20 bg-gradient-to-r from-blue-500/[0.08] via-purple-500/[0.08] to-blue-950/30 p-3 text-left transition hover:-translate-y-0.5 hover:border-purple-200/35 hover:shadow-[0_0_50px_rgba(168,85,247,0.18)]"
        disabled={isLoading || multimodalCount === 0}
        onClick={onOpenAll}
        type="button"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
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
          <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-2 [scrollbar-color:rgba(96,165,250,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/45 [&::-webkit-scrollbar-track]:bg-transparent">
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
      <div className="mb-3">
        <p className="text-lg font-semibold text-white">Chunk details</p>
        <p className="mt-1 text-sm text-slate-400">Review how partition elements were grouped into smart retrieval chunks.</p>
      </div>
      {error ? (
        <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : null}
      <button
        className="group w-full rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/[0.08] via-blue-500/[0.07] to-blue-950/30 p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:shadow-[0_0_50px_rgba(34,211,238,0.18)]"
        disabled={isLoading || chunks.length === 0}
        onClick={onOpenAll}
        type="button"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="space-y-3">
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
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
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
        <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2 [scrollbar-color:rgba(96,165,250,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/45 [&::-webkit-scrollbar-track]:bg-transparent">
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
      } ${wide ? "flex items-center justify-between gap-3" : ""} ${clickable ? "cursor-pointer hover:border-blue-300/35 hover:bg-blue-400/[0.09]" : ""}`}
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
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-center">
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
    <div className="rounded-3xl border border-blue-300/15 bg-white/[0.035] p-3 shadow-[0_0_45px_rgba(59,130,246,0.12)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="line-clamp-1 text-lg font-semibold text-white">{item.fileName}</p>
          <p className="mt-1 text-sm text-slate-400">{item.documentId ? `Document ${item.documentId}` : "Uploading file to workspace"}</p>
        </div>
        <Badge className={item.status === "failed" ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-blue-300/30 bg-blue-400/10 text-blue-100"} variant="outline">{item.status}</Badge>
      </div>

      <div className="mb-4 flex items-center">
        {INGESTION_STEPS.map((step, index) => {
          const isActive = index <= activeIndex;
          return (
            <div className="flex flex-1 items-center last:flex-none" key={step.stage}>
              <div className="flex flex-col items-center gap-2">
                <div className={`h-4 w-4 rounded-full border transition ${isActive ? "border-blue-200 bg-blue-400 shadow-[0_0_22px_rgba(96,165,250,0.9)]" : "border-slate-600 bg-slate-900"}`} />
                <span className={`whitespace-nowrap text-[11px] ${isActive ? "text-blue-100" : "text-slate-500"}`}>{step.label}</span>
              </div>
              {index < INGESTION_STEPS.length - 1 ? <div className={`mx-2 mb-3 h-[2px] flex-1 transition ${index < activeIndex ? "bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.85)]" : "bg-slate-700/80"}`} /> : null}
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

