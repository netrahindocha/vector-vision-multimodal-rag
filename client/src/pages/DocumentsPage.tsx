import { ArrowLeft, ArrowRight, ChevronRight, FileText, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type Document, type Workspace } from "@/lib/api";

export function DocumentsPage({
  documents,
  error,
  isLoading,
  onBack,
  onChat,
  onUpload,
  onWorkspaceChat,
  workspace,
}: {
  documents: Document[];
  error: string | null;
  isLoading: boolean;
  onBack: () => void;
  onChat: (document: Document) => void;
  onUpload: () => void;
  onWorkspaceChat: () => void;
  workspace: Workspace;
}) {
  return (
    <>
      <header className="mb-10 space-y-6">
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

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-5">
            {/* <Badge
              className="border-blue-300/30 bg-blue-400/10 text-blue-100 hover:bg-blue-400/15"
              variant="outline"
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              Workspace documents
            </Badge> */}
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
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button
                className="border border-cyan-200/45 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-300/20 text-cyan-50 shadow-[0_0_34px_rgba(34,211,238,0.36)] transition hover:-translate-y-0.5 hover:border-cyan-100/70 hover:from-cyan-300/30 hover:via-blue-400/30 hover:to-cyan-200/30 hover:shadow-[0_0_52px_rgba(34,211,238,0.5)] disabled:shadow-none"
                disabled={!documents.some((document) => document.status === "completed")}
                onClick={onWorkspaceChat}
                title={documents.some((document) => document.status === "completed") ? "Chat across all completed documents" : "Workspace chat is available after at least one document completes ingestion"}
                variant="outline"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Chat with workspace
              </Button>
              <Button
                className="bg-blue-500 text-white shadow-[0_0_35px_rgba(59,130,246,0.45)] hover:bg-blue-400"
                onClick={onUpload}
              >
                <FileText className="mr-2 h-4 w-4" />
                Upload document(s)
              </Button>
            </div>
            <div className="flex min-w-24 flex-col items-center justify-center rounded-xl border border-blue-300/15 bg-white/[0.04] px-4 py-3 text-center shadow-[0_0_36px_rgba(59,130,246,0.12)] backdrop-blur-xl">
              <p className="text-2xl font-semibold leading-none text-white">
                {documents.length}
              </p>
              <p className="mt-1 text-xs text-slate-400">documents</p>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
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
    <Card className="group relative mx-auto w-full overflow-hidden border-white/10 bg-slate-950/70 pt-0 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-blue-300/40 hover:shadow-blue-500/20 xl:max-w-[24.333rem]">
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
          className="inline-flex items-center gap-2 rounded-full border border-cyan-200/45 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-300/20 px-3.5 py-2 text-sm font-medium text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.32)] transition hover:-translate-y-0.5 hover:border-cyan-100/70 hover:from-cyan-300/30 hover:via-blue-400/30 hover:to-cyan-200/30 hover:shadow-[0_0_38px_rgba(34,211,238,0.48)] disabled:cursor-not-allowed disabled:border-slate-600/30 disabled:bg-slate-800/40 disabled:bg-none disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:shadow-none"
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

export function getDocumentType(document: Document) {
  const filenameExtension = document.original_filename.split(".").pop();
  if (filenameExtension && filenameExtension !== document.original_filename) {
    return filenameExtension.toUpperCase();
  }

  if (document.content_type) {
    return document.content_type.split("/").pop()?.toUpperCase() || "FILE";
  }

  return "FILE";
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
