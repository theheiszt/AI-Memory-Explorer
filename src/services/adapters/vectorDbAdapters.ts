/**
 * Remote & Database Adapters (FR-01)
 * Modular connectors for Qdrant, Chroma, SQLite, and Generic REST endpoints.
 * All operations are strictly read-only by default (FR-01, Rule 5).
 */

import type { NormalizedMemoryRecord, SourceCapabilities } from '../../types/memory.ts';
import type { MemoryAdapter } from './types.ts';

export class QdrantAdapter implements MemoryAdapter {
  id: string;
  name: string;
  private endpoint: string;
  private collection: string;
  private apiKey?: string;

  constructor(id: string, name: string, endpoint: string, collection: string, apiKey?: string) {
    this.id = id;
    this.name = name;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.collection = collection;
    this.apiKey = apiKey;
  }

  getCapabilities(): SourceCapabilities {
    return {
      hasEmbeddings: true,
      embeddingDimension: 384,
      embeddingModel: 'text-embedding-3-small (Qdrant payload)',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: false,
      supportsRealtimeSync: true,
      isReadOnly: true,
      recordCount: 0,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string; recordCount?: number }> {
    try {
      const url = `${this.endpoint}/collections/${this.collection}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['api-key'] = this.apiKey;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        return { success: false, message: `Qdrant returned HTTP ${res.status}: ${res.statusText}` };
      }
      const data = await res.json();
      const pointsCount = data.result?.points_count || 0;
      return { success: true, message: `Connected to collection '${this.collection}' (${pointsCount} points)`, recordCount: pointsCount };
    } catch (e) {
      return { success: false, message: `Network error connecting to Qdrant: ${(e as Error).message}` };
    }
  }

  async fetchRecords(options?: { limit?: number; offset?: number }): Promise<NormalizedMemoryRecord[]> {
    const url = `${this.endpoint}/collections/${this.collection}/points/scroll`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['api-key'] = this.apiKey;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        limit: options?.limit || 100,
        with_payload: true,
        with_vector: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Qdrant scroll failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    const points = data.result?.points || [];

    return points.map((p: any) => ({
      id: String(p.id),
      sourceId: this.id,
      content: p.payload?.content || p.payload?.text || p.payload?.document || JSON.stringify(p.payload || {}),
      contentAvailable: !!(p.payload?.content || p.payload?.text),
      embedding: Array.isArray(p.vector) ? p.vector : null,
      embeddingDimension: Array.isArray(p.vector) ? p.vector.length : undefined,
      metadata: p.payload || {},
      createdAt: p.payload?.created_at || new Date().toISOString(),
      memoryType: p.payload?.type || 'semantic',
    }));
  }
}

export class ChromaAdapter implements MemoryAdapter {
  id: string;
  name: string;
  private endpoint: string;
  private collectionId: string;

  constructor(id: string, name: string, endpoint: string, collectionId: string) {
    this.id = id;
    this.name = name;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.collectionId = collectionId;
  }

  getCapabilities(): SourceCapabilities {
    return {
      hasEmbeddings: true,
      embeddingDimension: 1536,
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: false,
      supportsRealtimeSync: true,
      isReadOnly: true,
      recordCount: 0,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string; recordCount?: number }> {
    try {
      const url = `${this.endpoint}/api/v1/collections/${this.collectionId}`;
      const res = await fetch(url);
      if (!res.ok) {
        return { success: false, message: `Chroma HTTP ${res.status}: ${res.statusText}` };
      }
      const data = await res.json();
      return { success: true, message: `Connected to Chroma collection '${data.name || this.collectionId}'` };
    } catch (e) {
      return { success: false, message: `Failed to connect to Chroma: ${(e as Error).message}` };
    }
  }

  async fetchRecords(options?: { limit?: number }): Promise<NormalizedMemoryRecord[]> {
    const url = `${this.endpoint}/api/v1/collections/${this.collectionId}/get`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: options?.limit || 100,
        include: ['embeddings', 'documents', 'metadatas'],
      }),
    });

    if (!res.ok) throw new Error(`Chroma get failed with HTTP ${res.status}`);
    const data = await res.json();

    const ids = data.ids || [];
    const documents = data.documents || [];
    const embeddings = data.embeddings || [];
    const metadatas = data.metadatas || [];

    return ids.map((id: string, idx: number) => ({
      id,
      sourceId: this.id,
      content: documents[idx] || '[Document Unavailable]',
      contentAvailable: !!documents[idx],
      embedding: Array.isArray(embeddings[idx]) ? embeddings[idx] : null,
      embeddingDimension: Array.isArray(embeddings[idx]) ? embeddings[idx].length : undefined,
      metadata: metadatas[idx] || {},
      createdAt: metadatas[idx]?.created_at || new Date().toISOString(),
      memoryType: metadatas[idx]?.memory_type || 'semantic',
    }));
  }
}

export class SQLiteQueryAdapter implements MemoryAdapter {
  id: string;
  name: string;
  private queryJsonRecords: any[];

  constructor(id: string, name: string, records: any[]) {
    this.id = id;
    this.name = name;
    this.queryJsonRecords = records;
  }

  getCapabilities(): SourceCapabilities {
    return {
      hasEmbeddings: this.queryJsonRecords.some(r => r.embedding || r.vector),
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: this.queryJsonRecords.length,
    };
  }

  async testConnection() {
    return {
      success: true,
      message: `Parsed query results with ${this.queryJsonRecords.length} records.`,
      recordCount: this.queryJsonRecords.length,
    };
  }

  async fetchRecords(): Promise<NormalizedMemoryRecord[]> {
    return this.queryJsonRecords.map((r, i) => {
      let emb: number[] | null = null;
      if (typeof r.embedding === 'string') {
        try { emb = JSON.parse(r.embedding); } catch { emb = null; }
      } else if (Array.isArray(r.embedding)) {
        emb = r.embedding;
      }

      return {
        id: String(r.id || r.rowid || `sqlite_${i + 1}`),
        sourceId: this.id,
        content: r.content || r.text || r.body || '[Unavailable]',
        contentAvailable: !!(r.content || r.text),
        embedding: emb,
        embeddingDimension: emb ? emb.length : undefined,
        createdAt: r.created_at || r.timestamp || new Date().toISOString(),
        metadata: r,
        memoryType: (r.memory_type || 'semantic') as any,
      };
    });
  }
}

export class GenericRESTAdapter implements MemoryAdapter {
  id: string;
  name: string;
  private endpoint: string;
  private authToken?: string;

  constructor(id: string, name: string, endpoint: string, authToken?: string) {
    this.id = id;
    this.name = name;
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.authToken = authToken;
  }

  getCapabilities(): SourceCapabilities {
    return {
      hasEmbeddings: true,
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: true,
      isReadOnly: true,
      recordCount: 0,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string; recordCount?: number }> {
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

      const res = await fetch(`${this.endpoint}/health`, { headers });
      if (!res.ok) {
        return { success: false, message: `REST health check returned HTTP ${res.status}` };
      }
      return { success: true, message: 'REST Memory connector online and verified' };
    } catch (e) {
      return { success: false, message: `Connection error: ${(e as Error).message}` };
    }
  }

  async fetchRecords(): Promise<NormalizedMemoryRecord[]> {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    const res = await fetch(`${this.endpoint}/memories`, { headers });
    if (!res.ok) throw new Error(`REST endpoint returned ${res.status}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.records || data.memories || [];
    return list.map((item: any, i: number) => ({
      id: String(item.id || `rest_${i}`),
      sourceId: this.id,
      content: item.content || item.text || '',
      contentAvailable: !!(item.content || item.text),
      embedding: Array.isArray(item.embedding) ? item.embedding : null,
      embeddingDimension: item.embedding ? item.embedding.length : undefined,
      metadata: item.metadata || {},
      createdAt: item.createdAt || new Date().toISOString(),
      memoryType: item.memoryType || 'semantic',
    }));
  }
}
