import { type FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Bot, BriefcaseBusiness, ChevronRight, FileText, Info, Send, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askDocumentQuestion, askQuestion, buildDocumentFileUrl, type Document, type RetrievalSource, type Workspace } from "@/lib/api";
import { formatBytes, formatDate, getDocumentType } from "@/pages/DocumentsPage";
import { UploadDetailsPanel, type UploadProgressItem } from "@/pages/UploadPage";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievalSource[];
};

export type ChatTarget =
  | { type: "workspace" }
  | { type: "document"; document: Document };

function getChatWelcomeMessage(chatTarget: ChatTarget, workspace: Workspace) {
  if (chatTarget.type === "workspace") {
    return `Ask me anything about "${workspace.name}". I’ll search across all completed documents in this workspace.`;
  }

  return `Ask me anything about "${chatTarget.document.original_filename}". I’ll only use this document to answer.`;
}

export function ChatPage({
  chatTarget,
  documents,
  onBack,
  onSelectDocument,
  onSelectWorkspace,
  workspace,
}: {
  chatTarget: ChatTarget;
  documents: Document[];
  onBack: () => void;
  onSelectDocument: (document: Document) => void;
  onSelectWorkspace: () => void;
  workspace: Workspace;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: getChatWelcomeMessage(chatTarget, workspace),
    },
  ]);
  const [query, setQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<RetrievalSource | null>(null);
  const [sourceView, setSourceView] = useState<"chunk" | "pdf">("chunk");
  const [metadataDocument, setMetadataDocument] = useState<Document | null>(null);
  const [activeMetadataSection, setActiveMetadataSection] = useState("partitioning");
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: `welcome-${chatTarget.type}-${chatTarget.type === "document" ? chatTarget.document.id : workspace.id}`,
        role: "assistant",
        content: getChatWelcomeMessage(chatTarget, workspace),
      },
    ]);
    setQuery("");
    setChatError(null);
    setSelectedSource(null);
    setSourceView("chunk");
    setMetadataDocument(null);
    setActiveMetadataSection("partitioning");
  }, [chatTarget, workspace]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isAsking]);

  useEffect(() => {
    if (!isAsking && !metadataDocument) {
      chatInputRef.current?.focus();
    }
  }, [isAsking, metadataDocument]);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (metadataDocument || isAsking || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTypingElement =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingElement || event.key.length !== 1) {
        return;
      }

      event.preventDefault();
      chatInputRef.current?.focus();
      setQuery((current) => `${current}${event.key}`);
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isAsking, metadataDocument]);

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
      const response = chatTarget.type === "workspace"
        ? await askQuestion(workspace.id, question, 3)
        : await askDocumentQuestion(workspace.id, chatTarget.document.id, question, 3);
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

  const chatTitle = chatTarget.type === "workspace" ? workspace.name : chatTarget.document.original_filename;
  const chatSubtitle = chatTarget.type === "workspace"
    ? "Workspace chat · all completed documents"
    : `${getDocumentType(chatTarget.document)} · ${formatBytes(chatTarget.document.size_bytes)} · Uploaded ${formatDate(chatTarget.document.created_at)}`;
  const chatBadge = chatTarget.type === "workspace" ? "Workspace" : getDocumentType(chatTarget.document);
  const inputPlaceholder = chatTarget.type === "workspace"
    ? "Ask anything about this workspace..."
    : "Ask anything about this document...";
  const metadataItems: UploadProgressItem[] = metadataDocument
    ? [
        {
          localId: metadataDocument.id,
          fileName: metadataDocument.original_filename,
          documentId: metadataDocument.id,
          status: metadataDocument.status,
          stage: metadataDocument.stage,
          errorMessage: metadataDocument.error_message,
          updatedAt: metadataDocument.updated_at,
          processingMetadata: metadataDocument.processing_metadata,
          events: [],
        },
      ]
    : [];

  return (
    <div className={`fixed inset-0 z-50 grid bg-black text-white ${selectedSource ? "grid-cols-[360px_minmax(0,1fr)_400px]" : "grid-cols-[360px_minmax(0,1fr)]"}`}>
      <aside className="h-screen min-h-0 overflow-hidden border-r border-blue-300/20 bg-[linear-gradient(180deg,#020617_0%,#000814_42%,#000_100%)]">
        <div className="h-36 border-b border-blue-300/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.28),rgba(2,6,23,0.96)_52%,rgba(56,189,248,0.16))] px-4 py-3">
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
          <div className="border-b border-blue-200/10 p-4">
            <p className="mb-3 px-2 text-xs uppercase tracking-[0.24em] text-blue-200/60">Workspace chat</p>
            <button
              className={`relative flex w-full gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                chatTarget.type === "workspace"
                  ? "border-cyan-200/50 bg-cyan-300/15 text-white shadow-[0_0_34px_rgba(34,211,238,0.18)]"
                  : "border-blue-300/15 bg-blue-950/20 text-slate-300 hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white"
              }`}
              onClick={onSelectWorkspace}
              type="button"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="line-clamp-1 text-sm font-semibold">{workspace.name}</p>
                <p className="mt-1 text-xs text-slate-500">All completed documents</p>
              </div>
            </button>
          </div>
          <p className="px-4 pb-2 pt-5 text-xs uppercase tracking-[0.24em] text-blue-200/60">Documents</p>
          {documents.map((item) => {
            const isActive = chatTarget.type === "document" && item.id === chatTarget.document.id;
            const isCompleted = item.status === "completed";
            return (
              <div
                className={`relative flex w-full border-b border-blue-200/10 transition ${
                  isActive
                    ? "bg-[linear-gradient(90deg,rgba(59,130,246,0.42),rgba(56,189,248,0.16),rgba(0,0,0,0))] text-white shadow-[inset_6px_0_0_#7dd3fc]"
                    : "bg-transparent text-slate-300 hover:bg-blue-400/10 hover:text-white"
                } ${!isCompleted ? "opacity-45" : ""}`}
                key={item.id}
              >
                <button
                  className={`flex min-w-0 flex-1 gap-3 px-4 py-3 text-left ${!isCompleted ? "cursor-not-allowed" : ""}`}
                  disabled={!isCompleted}
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
                <button
                  className="mr-4 self-center rounded-full border border-cyan-200/25 bg-cyan-300/10 p-2 text-cyan-100 transition hover:border-cyan-100/50 hover:bg-cyan-300/20 hover:text-white hover:shadow-[0_0_24px_rgba(34,211,238,0.24)]"
                  onClick={() => {
                    setMetadataDocument(item);
                    setSelectedSource(null);
                    setActiveMetadataSection("partitioning");
                  }}
                  title={`View metadata for ${item.original_filename}`}
                  type="button"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className={`relative grid h-screen min-h-0 overflow-hidden bg-[radial-gradient(circle_at_30%_0%,rgba(56,189,248,0.20),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(37,99,235,0.18),transparent_32%),linear-gradient(135deg,#000_0%,#020617_48%,#000_100%)] ${metadataDocument ? "grid-rows-[72px_minmax(0,1fr)]" : "grid-rows-[72px_minmax(0,1fr)_72px]"}`}>
        <div className="pointer-events-none absolute left-1/4 top-0 h-80 w-[38rem] rounded-full bg-blue-400/14 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-16 h-80 w-[38rem] rounded-full bg-sky-300/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-[34rem] rounded-full bg-blue-900/30 blur-3xl" />

        <header className="relative z-10 border-b border-blue-300/20 bg-black/60 px-4 py-4 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="text-blue-200">All Workspaces</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-blue-100">{workspace.name}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-sky-100">{metadataDocument ? "Metadata" : "Chat"}</span>
              </div>
              <h1 className="line-clamp-1 text-2xl font-semibold tracking-tight text-white">
                {metadataDocument ? metadataDocument.original_filename : chatTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {metadataDocument
                  ? `${getDocumentType(metadataDocument)} metadata · ${formatBytes(metadataDocument.size_bytes)} · Uploaded ${formatDate(metadataDocument.created_at)}`
                  : chatSubtitle}
              </p>
            </div>
            {metadataDocument ? (
              <button
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200/25 bg-cyan-100/10 text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-100/15 hover:shadow-[0_0_26px_rgba(34,211,238,0.24)]"
                onClick={() => setMetadataDocument(null)}
                type="button"
              >
                ×
              </button>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <span className="border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs text-blue-100">{chatBadge}</span>
                <span className="border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">{messages.length} messages</span>
              </div>
            )}
          </div>
        </header>

        {metadataDocument ? (
          <div className="relative z-10 min-h-0 overflow-y-auto p-7 [scrollbar-color:rgba(96,165,250,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/45 [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="mx-auto w-full max-w-6xl rounded-3xl border border-blue-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-blue-950/30 backdrop-blur-xl">
              <UploadDetailsPanel
                activeSection={activeMetadataSection}
                items={metadataItems}
                onSectionChange={setActiveMetadataSection}
                workspaceId={workspace.id}
              />
            </div>
          </div>
        ) : (
          <div
            className="relative z-10 min-h-0 overflow-y-auto [scrollbar-color:rgba(96,165,250,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-blue-400/45 [&::-webkit-scrollbar-track]:bg-transparent"
            ref={messagesContainerRef}
          >
            <div className="mx-auto w-full max-w-none px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <ChatBubble
                    message={message}
                    key={message.id}
                    onSelectSource={(source) => {
                      setSelectedSource(source);
                      setSourceView("chunk");
                    }}
                  />
                ))}
                {isAsking ? (
                  <div className="flex items-center gap-3 border-l-2 border-sky-300 bg-sky-400/5 px-3 py-3 text-sm text-sky-100 shadow-[0_0_35px_rgba(56,189,248,0.12)]">
                    <Bot className="h-4 w-4" />
                    Thinking through {chatTarget.type === "workspace" ? "workspace" : "document"} embeddings...
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}

        {!metadataDocument ? (
          <footer className="relative z-20 border-t border-blue-300/20 bg-black/80 p-4 backdrop-blur-xl">
          {chatError ? (
            <div className="mb-3 border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {chatError}
            </div>
          ) : null}
          <form className="h-full" onSubmit={handleAsk}>
            <div className="flex h-full gap-3 border border-blue-300/25 bg-[linear-gradient(90deg,rgba(37,99,235,0.18),rgba(0,0,0,0.55),rgba(56,189,248,0.10))] p-2 shadow-[0_0_55px_rgba(59,130,246,0.18)] focus-within:border-sky-200/45 focus-within:shadow-[0_0_70px_rgba(56,189,248,0.22)]">
              <Input
                ref={chatInputRef}
                className="h-full border-0 bg-transparent text-base text-white outline-none placeholder:text-slate-500 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isAsking}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={inputPlaceholder}
                value={query}
              />
              <Button
                className="h-full bg-[linear-gradient(90deg,#38bdf8,#2563eb,#0f172a)] px-4 text-white shadow-[0_0_35px_rgba(56,189,248,0.32)] hover:opacity-90"
                disabled={isAsking || !query.trim()}
                type="submit"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
          </footer>
        ) : null}
      </section>

      {selectedSource ? (
        <SourceEvidencePanel
          onClose={() => setSelectedSource(null)}
          onViewChange={setSourceView}
          source={selectedSource}
          view={sourceView}
          workspaceId={workspace.id}
        />
      ) : null}
    </div>
  );
}

function ChatBubble({
  message,
  onSelectSource,
}: {
  message: ChatMessage;
  onSelectSource: (source: RetrievalSource) => void;
}) {
  const isUser = message.role === "user";
  const mediaSources = message.sources?.filter((source) => source.images_base64.length > 0 || source.tables_html.length > 0) ?? [];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`w-full max-w-[95%] ${isUser ? "ml-auto" : "mr-auto"}`}>
        <div className={`mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] ${isUser ? "justify-end text-blue-200/70" : "text-cyan-200/70"}`}>
          {isUser ? "You" : "Assistant"}
        </div>
        <div className={`border-l-2 px-3 py-1 ${
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
                  h1: ({ children }) => <h1 className="mb-3 mt-3 text-2xl font-semibold text-white first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="mb-3 mt-3 text-xl font-semibold text-white first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-2 mt-3 text-lg font-semibold text-cyan-100 first:mt-0">{children}</h3>,
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
            <div className="mt-3 space-y-3 border-t border-blue-300/15 pt-5">
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
            <div className="mt-3 border-t border-blue-300/15 pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Sources:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {message.sources.map((source, index) => (
                  <button
                    className="text-left text-xs text-blue-200/80 underline decoration-blue-300/30 underline-offset-4 transition hover:text-cyan-100"
                    key={`${source.document_id}-${source.chunk_index}-${index}`}
                    onClick={() => onSelectSource(source)}
                    type="button"
                  >
                    {getSourceLabel(source, index)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getSourceLabel(source: RetrievalSource, index: number) {
  const fileName = source.original_filename || "Source";
  if (source.page_number) {
    return `${fileName} · Page ${source.page_number}`;
  }
  return `${fileName} · Chunk ${source.chunk_index ?? index + 1}`;
}

function SourceEvidencePanel({
  onClose,
  onViewChange,
  source,
  view,
  workspaceId,
}: {
  onClose: () => void;
  onViewChange: (view: "chunk" | "pdf") => void;
  source: RetrievalSource;
  view: "chunk" | "pdf";
  workspaceId: string;
}) {
  const pdfUrl = source.document_id
    ? buildDocumentFileUrl(workspaceId, source.document_id, source.page_number)
    : null;

  return (
    <aside className="h-screen min-h-0 overflow-hidden border-l border-cyan-300/20 bg-[linear-gradient(180deg,#020617_0%,#000814_48%,#000_100%)] text-white">
      <div className="flex h-full min-h-0 flex-col">
        <header className="border-b border-cyan-300/20 bg-black/50 p-3 backdrop-blur-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Source evidence</p>
              <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-white">
                {source.original_filename || "Retrieved source"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {source.page_number ? `Page ${source.page_number}` : "Page unavailable"} · Chunk {source.chunk_index ?? "—"}
              </p>
            </div>
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-100/10 text-cyan-50 transition hover:border-cyan-100/40 hover:bg-cyan-100/15"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 rounded-full border border-cyan-300/15 bg-white/[0.04] p-1">
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                view === "chunk"
                  ? "bg-cyan-300/15 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
              onClick={() => onViewChange("chunk")}
              type="button"
            >
              Chunk
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                view === "pdf"
                  ? "bg-cyan-300/15 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
              onClick={() => onViewChange("pdf")}
              type="button"
            >
              PDF Page
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:rgba(34,211,238,0.45)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-cyan-400/45 [&::-webkit-scrollbar-track]:bg-transparent">
          {view === "chunk" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-200/60">Relevant excerpt</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                  {source.content_preview || "No text preview is available for this source."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-blue-300/15 bg-blue-400/[0.04] p-3">
                  <p className="text-slate-500">Content</p>
                  <p className="mt-1 text-blue-100">{source.content_types.join(", ") || "text"}</p>
                </div>
                <div className="rounded-2xl border border-blue-300/15 bg-blue-400/[0.04] p-3">
                  <p className="text-slate-500">Text length</p>
                  <p className="mt-1 text-blue-100">{source.text_length} chars</p>
                </div>
              </div>

            </div>
          ) : pdfUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Viewing the original PDF{source.page_number ? ` at page ${source.page_number}` : ""}.
              </p>
              <iframe
                className="h-[calc(100vh-13rem)] w-full rounded-2xl border border-cyan-300/20 bg-white"
                src={pdfUrl}
                title="PDF source page"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-yellow-300/25 bg-yellow-400/10 p-4 text-sm text-yellow-100">
              The original document is not available for this source.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

