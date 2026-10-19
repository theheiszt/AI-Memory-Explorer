/**
 * AI Server Adapter for Local & Remote Autonomous AI Agent Runtimes:
 * - Ollama (http://localhost:11434)
 * - LM Studio / LocalAI / vLLM OpenAI-Compatible (http://localhost:1234/v1)
 * - LangGraph / LangChain Server (http://localhost:8000)
 * - Mem0 Local & Cloud Server (http://localhost:8080)
 * - Custom Agent REST / SSE Memory Endpoints
 */

import type { NormalizedMemoryRecord, SourceCapabilities, AIServerConfig } from '../../types/memory.ts';
import type { MemoryAdapter } from './types.ts';

// Deterministic fallback vector generator for memories that arrive without embeddings
function generateLocalEmbedding(text: string, dim = 64): number[] {
  const vec = new Array(dim).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
    const bucket = Math.abs(hash) % dim;
    vec[bucket] += (text.charCodeAt(i) % 10) / 10;
  }
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    const s = Math.sin((i + 1) * 37.1 + hash);
    vec[i] = vec[i] * 0.7 + s * 0.3;
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  return vec.map(v => Math.round((v / norm) * 10000) / 10000);
}

export class AIServerAdapter implements MemoryAdapter {
  id: string;
  name: string;
  config: AIServerConfig;
  private cachedRecords: NormalizedMemoryRecord[] = [];

  constructor(config: AIServerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  getCapabilities(): SourceCapabilities {
    return {
      hasEmbeddings: true,
      embeddingDimension: 64,
      embeddingModel: this.config.activeModel || 'local-ai-embedding',
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: true,
      supportsRealtimeSync: true,
      isReadOnly: true,
      recordCount: this.cachedRecords.length,
    };
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    recordCount?: number;
    latencyMs?: number;
    models?: string[];
  }> {
    const startTime = performance.now();
    try {
      const isSSH = this.config.serverType === 'ssh_agent';
      const endpoint = isSSH ? '/api/ai-server/ssh/probe' : '/api/ai-server/probe';
      const payload = isSSH
        ? {
            host: this.config.sshConfig?.host,
            port: this.config.sshConfig?.port,
            username: this.config.sshConfig?.username,
            authType: this.config.sshConfig?.authType,
            password: this.config.sshConfig?.password,
            privateKey: this.config.sshConfig?.privateKey,
            passphrase: this.config.sshConfig?.passphrase,
            remoteAgentType: this.config.sshConfig?.remoteAgentType,
            remotePort: this.config.sshConfig?.remotePort,
          }
        : {
            serverType: this.config.serverType,
            endpointUrl: this.config.endpointUrl,
            apiKey: this.config.apiKey,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const latency = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          success: false,
          message: err.error || `Server returned HTTP ${res.status}`,
          latencyMs: latency,
        };
      }

      const data = await res.json();
      return {
        success: true,
        message: data.message || `Connected to ${this.config.serverType} (${latency}ms latency)`,
        latencyMs: latency,
        models: data.models || [],
        recordCount: data.recordCount || 0,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Network probe failure: ${e.message}`,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }

  async fetchRecords(): Promise<NormalizedMemoryRecord[]> {
    try {
      const isSSH = this.config.serverType === 'ssh_agent';
      const endpoint = isSSH ? '/api/ai-server/ssh/fetch' : '/api/ai-server/fetch';
      const payload = isSSH
        ? {
            host: this.config.sshConfig?.host,
            port: this.config.sshConfig?.port,
            username: this.config.sshConfig?.username,
            authType: this.config.sshConfig?.authType,
            password: this.config.sshConfig?.password,
            privateKey: this.config.sshConfig?.privateKey,
            passphrase: this.config.sshConfig?.passphrase,
            remoteAgentType: this.config.sshConfig?.remoteAgentType,
            remotePort: this.config.sshConfig?.remotePort,
            activeModel: this.config.activeModel,
            activeSessionId: this.config.activeSessionId,
          }
        : {
            serverType: this.config.serverType,
            endpointUrl: this.config.endpointUrl,
            apiKey: this.config.apiKey,
            activeModel: this.config.activeModel,
            activeSessionId: this.config.activeSessionId,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch AI agent memories: HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawList = data.memories || data.records || [];

      this.cachedRecords = rawList.map((item: any, idx: number) => {
        const content = item.content || item.text || item.message || JSON.stringify(item);
        const emb = Array.isArray(item.embedding) && item.embedding.length > 0
          ? item.embedding
          : generateLocalEmbedding(content, 64);

        return {
          id: String(item.id || `${this.config.serverType}_mem_${idx + 1}`),
          sourceId: this.id,
          content,
          contentAvailable: true,
          embedding: emb,
          embeddingDimension: emb.length,
          embeddingModel: item.model || this.config.activeModel || 'local-embeddings',
          createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
          memoryType: item.memoryType || item.role || 'semantic',
          metadata: {
            serverType: this.config.serverType,
            endpoint: this.config.endpointUrl,
            sessionId: this.config.activeSessionId || item.sessionId,
            ...(item.metadata || {}),
          },
          provenance: {
            agentName: this.config.name,
            agentRole: item.role || 'Agent',
            sessionId: this.config.activeSessionId || item.sessionId,
          },
          explicitRelations: item.explicitRelations || [],
          retrievalEvents: item.retrievalEvents || [],
        };
      });

      return this.cachedRecords;
    } catch (err: any) {
      console.warn('Falling back to local cached or demo AI server state:', err.message);
      return this.cachedRecords;
    }
  }
}
