const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  workspace_id: string;
  original_filename: string;
  stored_filename: string;
  content_type: string | null;
  size_bytes: number;
  storage_path: string;
  status: string;
  stage: string;
  error_message: string | null;
  processing_metadata: ProcessingMetadata | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessingMetadata = {
  partitioning?: {
    elements_found?: number;
    text?: number;
    images?: number;
    tables?: number;
    categories?: Record<string, number>;
    element_types?: Record<string, number>;
  };
  chunking?: {
    chunks_created?: number;
  };
  [key: string]: unknown;
};

export type DocumentStatusEvent = Pick<
  Document,
  "id" | "status" | "stage" | "error_message" | "updated_at" | "processing_metadata"
>;

export type RetrievalSource = {
  document_id: string | null;
  original_filename: string | null;
  chunk_index: number | null;
  content_types: string[];
  table_count: number;
  image_count: number;
  text_length: number;
  content_preview: string;
  tables_html: string[];
  images_base64: string[];
  metadata: Record<string, unknown>;
};

export type RetrievalAskResponse = {
  query: string;
  answer: string;
  sources: RetrievalSource[];
};

export type RetrievalSearchResponse = {
  query: string;
  sources: RetrievalSource[];
};

export type DocumentChunk = {
  chunk_index: number;
  content_types: string[];
  raw_text: string;
  tables_html: string[];
  images_base64: string[];
  enhanced_content: string;
  metadata: Record<string, unknown>;
};

export type DocumentChunksResponse = {
  workspace_id: string;
  document_id: string;
  chunks: DocumentChunk[];
};

export type DocumentPartitionItem = {
  id: string;
  element_index: number;
  content_type: "text" | "image" | "table";
  element_type: string;
  category: string | null;
  text: string | null;
  table_html: string | null;
  image_base64: string | null;
  metadata: Record<string, unknown>;
};

export type DocumentPartitionItemsResponse = {
  workspace_id: string;
  document_id: string;
  content_type: string;
  items: DocumentPartitionItem[];
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") {
      return data.detail;
    }
    return JSON.stringify(data.detail ?? data);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export function listWorkspaces(): Promise<Workspace[]> {
  return requestJson<Workspace[]>("/workspaces");
}

export function createWorkspace(name: string, description?: string): Promise<Workspace> {
  return requestJson<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, description: description || null }),
  });
}

export function listDocuments(workspaceId: string): Promise<Document[]> {
  return requestJson<Document[]>("/documents", {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });
}

export async function uploadDocument(workspaceId: string, file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers: {
      "X-Workspace-Id": workspaceId,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<Document>;
}

export function askQuestion(
  workspaceId: string,
  query: string,
  topK = 3,
): Promise<RetrievalAskResponse> {
  return requestJson<RetrievalAskResponse>("/retrieval/ask", {
    method: "POST",
    headers: {
      "X-Workspace-Id": workspaceId,
    },
    body: JSON.stringify({ query, top_k: topK }),
  });
}

export function askDocumentQuestion(
  workspaceId: string,
  documentId: string,
  query: string,
  topK = 3,
): Promise<RetrievalAskResponse> {
  return requestJson<RetrievalAskResponse>(`/retrieval/documents/${documentId}/ask`, {
    method: "POST",
    headers: {
      "X-Workspace-Id": workspaceId,
    },
    body: JSON.stringify({ query, top_k: topK }),
  });
}

export function searchDocuments(
  workspaceId: string,
  query: string,
  topK = 3,
): Promise<RetrievalSearchResponse> {
  return requestJson<RetrievalSearchResponse>("/retrieval/search", {
    method: "POST",
    headers: {
      "X-Workspace-Id": workspaceId,
    },
    body: JSON.stringify({ query, top_k: topK }),
  });
}

export function getDocumentPartitionItems(
  workspaceId: string,
  documentId: string,
  contentType: "text" | "image" | "table" | "all" = "all",
): Promise<DocumentPartitionItemsResponse> {
  return requestJson<DocumentPartitionItemsResponse>(
    `/retrieval/documents/${documentId}/partition-items?content_type=${contentType}`,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    },
  );
}

export function getDocumentChunks(
  workspaceId: string,
  documentId: string,
): Promise<DocumentChunksResponse> {
  return requestJson<DocumentChunksResponse>(`/retrieval/documents/${documentId}/chunks`, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });
}

export function buildDocumentEventsUrl(workspaceId: string, documentId: string): string {
  const path = `${API_BASE_URL}/documents/${documentId}/events`;
  const query = `workspace_id=${encodeURIComponent(workspaceId)}`;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    const url = new URL(path);
    url.searchParams.set("workspace_id", workspaceId);
    return url.toString();
  }

  return `${path}?${query}`;
}
