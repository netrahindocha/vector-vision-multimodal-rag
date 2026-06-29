import { type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { type User, type Workspace } from "@/lib/api";

export function WorkspacesPage({
  createDialogOpen,
  createError,
  currentUser,
  error,
  isCreating,
  isLoading,
  onCreateDialogOpenChange,
  onCreateWorkspace,
  onLogout,
  onOpenWorkspace,
  setWorkspaceDescription,
  setWorkspaceName,
  visibleWorkspaces,
  workspaceDescription,
  workspaceName,
}: {
  createDialogOpen: boolean;
  createError: string | null;
  currentUser: User | null;
  error: string | null;
  isCreating: boolean;
  isLoading: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
  onOpenWorkspace: (workspace: Workspace) => void;
  setWorkspaceDescription: (description: string) => void;
  setWorkspaceName: (name: string) => void;
  visibleWorkspaces: Workspace[];
  workspaceDescription: string;
  workspaceName: string;
}) {
  return (
    <>
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
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
        <div className="flex flex-col items-start gap-3 md:items-end">
          {currentUser ? (
            <div className="text-sm text-slate-300">
              Signed in as <span className="text-blue-100">{currentUser.email}</span>
            </div>
          ) : null}
          <div className="flex gap-3">
            <Button
              className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={onLogout}
              type="button"
              variant="outline"
            >
              Logout
            </Button>
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
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
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
    <Card
      className="group relative mx-auto w-full cursor-pointer overflow-hidden border-white/10 bg-slate-950/70 pt-0 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-blue-300/40 hover:shadow-blue-500/20 xl:max-w-[24.333rem]"
      onClick={() => onOpenWorkspace(workspace)}
    >
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

