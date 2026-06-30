const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

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
  page_number: number | null;
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
  page_number?: number | null;
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

  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
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

export function registerUser(email: string, password: string, name?: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name: name || null }),
  });
}

export function loginUser(email: string, password: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function refreshSession(): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/refresh", {
    method: "POST",
  });
}

export function getCurrentUser(): Promise<User> {
  return requestJson<User>("/auth/me");
}

export function logoutUser(): Promise<{ status: string }> {
  return requestJson<{ status: string }>("/auth/logout", {
    method: "POST",
  });
}

export function buildGoogleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google/login`;
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

  const headers: Record<string, string> = {
    "X-Workspace-Id": workspaceId,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
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

export function buildDocumentFileUrl(workspaceId: string, documentId: string, pageNumber?: number | null): string {
  const path = `${API_BASE_URL}/documents/${documentId}/file`;
  const query = `workspace_id=${encodeURIComponent(workspaceId)}`;
  const pageFragment = pageNumber ? `#page=${pageNumber}` : "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    const url = new URL(path);
    url.searchParams.set("workspace_id", workspaceId);
    return `${url.toString()}${pageFragment}`;
  }

  return `${path}?${query}${pageFragment}`;
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

export async function streamDocumentEvents(
  workspaceId: string,
  documentId: string,
  onDocumentStatus: (event: DocumentStatusEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers = new Headers();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(buildDocumentEventsUrl(workspaceId, documentId), {
    headers,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("Document event stream is not available");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const eventText of events) {
        const parsed = parseSseEvent(eventText);
        if (parsed.event === "document_status" && parsed.data) {
          onDocumentStatus(JSON.parse(parsed.data) as DocumentStatusEvent);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseEvent(eventText: string): { event: string | null; data: string | null } {
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of eventText.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice("event: ".length).trim();
    } else if (line.startsWith("data: ")) {
      dataLines.push(line.slice("data: ".length));
    }
  }

  return { event, data: dataLines.length ? dataLines.join("\n") : null };
}
