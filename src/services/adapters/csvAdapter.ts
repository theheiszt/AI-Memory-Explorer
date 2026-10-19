/**
 * CSV Memory Adapter with configurable field mapping (FR-01)
 */

import type { NormalizedMemoryRecord, SourceCapabilities } from '../../types/memory.ts';
import type { MemoryAdapter } from './types.ts';

export interface CSVFieldMapping {
  idColumn: string;
  contentColumn: string;
  embeddingColumn?: string;
  timestampColumn?: string;
  typeColumn?: string;
}

export class CSVMemoryAdapter implements MemoryAdapter {
  id: string;
  name: string;
  private rawCSV: string;
  private mapping: CSVFieldMapping;
  private parsedRecords: NormalizedMemoryRecord[] = [];
  private capabilities: SourceCapabilities;

  constructor(id: string, name: string, rawCSV: string, mapping: CSVFieldMapping) {
    this.id = id;
    this.name = name;
    this.rawCSV = rawCSV;
    this.mapping = mapping;
    this.parseCSV();
    this.capabilities = {
      hasEmbeddings: this.parsedRecords.some(r => r.embedding !== null && r.embedding.length > 0),
      embeddingDimension: this.parsedRecords.find(r => r.embedding)?.embedding?.length,
      supportsPagination: true,
      supportsFiltering: true,
      supportsRetrievalHistory: false,
      supportsRealtimeSync: false,
      isReadOnly: true,
      recordCount: this.parsedRecords.length,
    };
  }

  private parseCSV() {
    if (!this.rawCSV.trim()) return;

    // Standard CSV line parsing respecting quoted commas
    const lines = this.splitCSVLines(this.rawCSV);
    if (lines.length < 2) return;

    const headers = this.parseCSVRow(lines[0]).map(h => h.trim());
    const idIdx = headers.indexOf(this.mapping.idColumn);
    const contentIdx = headers.indexOf(this.mapping.contentColumn);
    const embIdx = this.mapping.embeddingColumn ? headers.indexOf(this.mapping.embeddingColumn) : -1;
    const timeIdx = this.mapping.timestampColumn ? headers.indexOf(this.mapping.timestampColumn) : -1;
    const typeIdx = this.mapping.typeColumn ? headers.indexOf(this.mapping.typeColumn) : -1;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const row = this.parseCSVRow(lines[i]);
      if (row.length === 0) continue;

      const id = idIdx >= 0 && row[idIdx] ? row[idIdx].trim() : `row_${i}`;
      const content = contentIdx >= 0 && row[contentIdx] ? row[contentIdx].trim() : '';

      let embedding: number[] | null = null;
      if (embIdx >= 0 && row[embIdx]) {
        try {
          const raw = row[embIdx].trim();
          if (raw.startsWith('[') && raw.endsWith(']')) {
            embedding = JSON.parse(raw);
          } else if (raw.includes(',')) {
            embedding = raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
          }
        } catch {
          embedding = null;
        }
      }

      const metadata: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        if (![idIdx, contentIdx, embIdx, timeIdx, typeIdx].includes(idx)) {
          metadata[h] = row[idx];
        }
      });

      this.parsedRecords.push({
        id,
        sourceId: this.id,
        content: content || '[Content Unavailable]',
        contentAvailable: content.length > 0,
        embedding,
        embeddingDimension: embedding ? embedding.length : undefined,
        createdAt: timeIdx >= 0 && row[timeIdx] ? row[timeIdx] : new Date().toISOString(),
        memoryType: (typeIdx >= 0 && row[typeIdx] ? row[typeIdx] : 'semantic') as any,
        metadata,
      });
    }
  }

  private splitCSVLines(text: string): string[] {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') {
          i++;
        }
        lines.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines;
  }

  private parseCSVRow(rowStr: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') {
        if (inQuotes && rowStr[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);
    return fields;
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
      message: `Parsed ${this.parsedRecords.length} records with column mapping.`,
      recordCount: this.parsedRecords.length,
    };
  }
}
