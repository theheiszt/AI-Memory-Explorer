/**
 * JSON and JSONL Memory Adapter (FR-01, FR-02)
 * Ingests JSON files, arrays, and JSONL streams, normalizing them into the standard memory format.
 */

import type { NormalizedMemoryRecord, SourceCapabilities } from '../../types/memory.ts';
import type { MemoryAdapter } from './types.ts';

export class JSONMemoryAdapter implements MemoryAdapter {
  id: string;
  name: string;
  private rawContent: string;
  private parsedRecords: NormalizedMemoryRecord[] = [];
  private capabilities: SourceCapabilities;

  constructor(id: string, name: string, rawContent: string) {
    this.id = id;
    this.name = name;
    this.rawContent = rawContent;
    this.parseContent();
    this.capabilities = {
      hasEmbeddings: this.parsedRecords.some(r => r.embedding !== null && r.embedding.length > 0),
      embeddingDimension: this.parsedRecords.find(r => r.embedding)?.embedding?.length,
      embeddingModel: this.parsedRecords.find(r => r.embeddingModel)?.embeddingModel,
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: this.parsedRecords.some(r => r.retrievalEvents && r.retrievalEvents.length > 0),
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: this.parsedRecords.length,
    };
  }

  private parseContent() {
    if (!this.rawContent || !this.rawContent.trim()) {
      this.parsedRecords = [];
      return;
    }

    const trimmed = this.rawContent.trim();
    let rawItems: any[] = [];

    // Check if JSON Lines format
    if (trimmed.includes('\n') && !trimmed.startsWith('[')) {
      const lines = trimmed.split('\n').filter(line => line.trim().length > 0);
      rawItems = lines.map((l, i) => {
        try {
          return JSON.parse(l);
        } catch (e) {
          throw new Error(`Invalid JSONL at line ${i + 1}: ${(e as Error).message}`);
        }
      });
    } else {
      // Standard JSON
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rawItems = parsed;
        } else if (parsed.records && Array.isArray(parsed.records)) {
          rawItems = parsed.records;
        } else if (parsed.memories && Array.isArray(parsed.memories)) {
          rawItems = parsed.memories;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          rawItems = parsed.data;
        } else {
          rawItems = [parsed];
        }
      } catch (e) {
        throw new Error(`Invalid JSON syntax: ${(e as Error).message}`);
      }
    }

    this.parsedRecords = rawItems.map((item, idx) => this.normalizeItem(item, idx));
  }

  private normalizeItem(item: any, fallbackIndex: number): NormalizedMemoryRecord {
    const id = String(item.id || item._id || item.memory_id || item.key || `mem_${fallbackIndex + 1}`);
    const content = item.content || item.text || item.document || item.message || item.body || item.payload?.text || '';
    const contentAvailable = content.trim().length > 0;

    let embedding: number[] | null = null;
    if (Array.isArray(item.embedding)) {
      embedding = item.embedding.map(Number);
    } else if (Array.isArray(item.vector)) {
      embedding = item.vector.map(Number);
    } else if (Array.isArray(item.embeddings)) {
      embedding = item.embeddings.map(Number);
    }

    const metadata: Record<string, unknown> = {
      ...(item.metadata || item.payload || {}),
    };

    // Keep leftover top-level fields
    const knownKeys = new Set(['id', '_id', 'memory_id', 'key', 'content', 'text', 'document', 'message', 'body', 'embedding', 'vector', 'embeddings', 'metadata', 'payload', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'timestamp', 'source', 'type', 'provenance', 'retrieval_events', 'retrievals']);
    for (const [k, v] of Object.entries(item)) {
      if (!knownKeys.has(k) && metadata[k] === undefined) {
        metadata[k] = v;
      }
    }

    const createdAt = item.createdAt || item.created_at || item.timestamp || item.created || new Date().toISOString();
    const updatedAt = item.updatedAt || item.updated_at || undefined;
    const memoryType = item.memoryType || item.type || metadata.type || 'semantic';

    return {
      id,
      sourceId: this.id,
      content: contentAvailable ? content : '[Content Unavailable in Source Record]',
      contentAvailable,
      embedding,
      embeddingModel: item.embeddingModel || item.model || metadata.model as string,
      embeddingDimension: embedding ? embedding.length : undefined,
      createdAt,
      updatedAt,
      memoryType: memoryType as any,
      metadata,
      provenance: item.provenance || {
        sourceFile: this.name,
        agentRole: metadata.agentRole as string || metadata.role as string,
      },
      explicitRelations: item.explicitRelations || item.relations,
      retrievalEvents: item.retrievalEvents || item.retrievals,
    };
  }

  getCapabilities(): SourceCapabilities {
    return this.capabilities;
  }

  async fetchRecords(): Promise<NormalizedMemoryRecord[]> {
    return this.parsedRecords;
  }

  async testConnection(): Promise<{ success: boolean; message: string; recordCount?: number }> {
    return {
      success: true,
      message: `Parsed ${this.parsedRecords.length} memory records. Embeddings: ${this.capabilities.hasEmbeddings ? 'Detected' : 'None'}`,
      recordCount: this.parsedRecords.length,
    };
  }
}
