import { FileText, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-blue-50">
      <div className="container py-10">
        <div className="mb-8 flex flex-col gap-3">
          <Badge className="w-fit" variant="secondary">
            Vite + Tailwind + shadcn ready
          </Badge>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-3 text-primary-foreground shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">RAG Dashboard</h1>
              <p className="text-muted-foreground">
                Frontend foundation is ready for workspace, upload, progress, and retrieval UI.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Document workflow</CardTitle>
              <CardDescription>
                This card will become the workspace selector, upload panel, and document list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Workspace name" />
              <Input type="file" />
              <Button className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Upload document
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ask your documents</CardTitle>
              <CardDescription>
                This panel will call the backend retrieval endpoint and display answer sources.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Ask a question about your uploaded documents..." />
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">top_k: 3</Badge>
                <Button>Ask question</Button>
              </div>
              <Separator />
              <Alert>
                <AlertTitle>Foundation complete</AlertTitle>
                <AlertDescription>
                  Next step: add the API client and connect these shadcn components to your FastAPI backend.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default App;
