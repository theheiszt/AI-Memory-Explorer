/**
 * Adapter Contract (FR-01, Rule 2: "Every adapter must implement the same interface")
 */

import type {
  NormalizedMemoryRecord,
  SourceCapabilities,
  SourceConfig,
} from '../../types/memory.ts';

export interface MemoryAdapter {
  id: string;
  name: string;
  getCapabilities(): SourceCapabilities;
  fetchRecords(options?: { limit?: number; offset?: number; filterQuery?: string }): Promise<NormalizedMemoryRecord[]>;
  testConnection(): Promise<{ success: boolean; message: string; recordCount?: number }>;
}
