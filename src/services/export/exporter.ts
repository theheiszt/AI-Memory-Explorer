/**
 * Export and Diagnostic Engine (FR-09)
 * Handles structured export of normalized records, projection coordinates, cluster maps,
 * search results, and diagnostic logs with sensitive token/PII redaction.
 */

import {
  NormalizedMemoryRecord,
  ProjectionPoint,
  ClusterInfo,
  SearchMatch,
  DiagnosticLog,
} from '../../types/memory.ts';

export interface ExportOptions {
  includeEmbeddings: boolean;
  redactSensitiveData: boolean;
  prettyPrint: boolean;
}

export function redactSensitiveObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveObject(item)) as unknown as T;
  }

  const redacted: Record<string, unknown> = {};
  const sensitiveKeyPatterns = [/key/i, /token/i, /secret/i, /auth/i, /password/i, /credential/i, /bearer/i];

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeyPatterns.some(pattern => pattern.test(k))) {
      redacted[k] = '[REDACTED_SECRET]';
    } else if (typeof v === 'object' && v !== null) {
      redacted[k] = redactSensitiveObject(v);
    } else {
      redacted[k] = v;
    }
  }

  return redacted as T;
}

export function exportNormalizedRecords(
  records: NormalizedMemoryRecord[],
  options: ExportOptions = { includeEmbeddings: false, redactSensitiveData: true, prettyPrint: true }
): string {
  const prepared = records.map(r => {
    const clone: Partial<NormalizedMemoryRecord> = { ...r };
    if (!options.includeEmbeddings) {
      delete clone.embedding;
    }
    if (options.redactSensitiveData) {
      clone.metadata = redactSensitiveObject(clone.metadata || {});
    }
    return clone;
  });

  return JSON.stringify(prepared, null, options.prettyPrint ? 2 : 0);
}

export function exportProjectionCoordinatesCSV(points: ProjectionPoint[]): string {
  const header = 'id,x,y,z,cluster_id,content_preview,source_id\n';
  const rows = points.map(p => {
    const safeContent = `"${(p.record.content || '').replace(/"/g, '""').slice(0, 100)}"`;
    return `${p.id},${p.x},${p.y},${p.z !== undefined ? p.z : ''},${p.clusterId},${safeContent},${p.record.sourceId}`;
  });
  return header + rows.join('\n');
}

export function exportClustersJSON(clusters: ClusterInfo[]): string {
  return JSON.stringify(clusters, null, 2);
}

export function exportSearchResultsCSV(results: SearchMatch[]): string {
  const header = 'id,score,match_type,explanation,content\n';
  const rows = results.map(r => {
    const safeExplanation = `"${r.explanation.replace(/"/g, '""')}"`;
    const safeContent = `"${(r.record.content || '').replace(/"/g, '""')}"`;
    return `${r.record.id},${r.score.toFixed(4)},${r.matchType},${safeExplanation},${safeContent}`;
  });
  return header + rows.join('\n');
}

export function exportDiagnosticLogs(logs: DiagnosticLog[], redact = true): string {
  const processed = logs.map(l => ({
    ...l,
    context: redact ? redactSensitiveObject(l.redactedContext || {}) : l.redactedContext,
  }));
  return JSON.stringify(processed, null, 2);
}
