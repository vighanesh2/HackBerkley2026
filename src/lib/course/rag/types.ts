export type RagChunk = {
  id: string;
  index: number;
  text: string;
  heading?: string;
};

export type RagIndex = {
  sessionKey: string;
  sourceHash: string;
  chunks: RagChunk[];
  /** Dense vectors when embedding API is available; otherwise lexical vectors. */
  vectors: number[][] | Map<string, number>[];
  vectorMode: "dense" | "lexical";
  ingestedAt: number;
};

export type RagContext = {
  compressed: string;
  chunkCount: number;
  retrievedCount: number;
  usedRag: boolean;
};
