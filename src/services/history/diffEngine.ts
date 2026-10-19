/**
 * Memory Snapshot and History Diff Engine (FR-08)
 * Compares two snapshots of agent memories and tracks additions, mutations, deletions,
 * cluster membership migrations, and retrieval frequency deltas.
 */

import type { NormalizedMemoryRecord, SnapshotDiff } from '../../types/memory.ts';

export function compareSnapshots(
  snapshotA: { id: string; name: string; timestamp: string; records: NormalizedMemoryRecord[]; clusterMap?: Map<string, number> },
  snapshotB: { id: string; name: string; timestamp: string; records: NormalizedMemoryRecord[]; clusterMap?: Map<string, number> }
): SnapshotDiff {
  const mapA = new Map<string, NormalizedMemoryRecord>();
  for (const r of snapshotA.records) {
    mapA.set(r.id, r);
  }

  const mapB = new Map<string, NormalizedMemoryRecord>();
  for (const r of snapshotB.records) {
    mapB.set(r.id, r);
  }

  const addedRecords: NormalizedMemoryRecord[] = [];
  const modifiedRecords: Array<{
    before: NormalizedMemoryRecord;
    after: NormalizedMemoryRecord;
    changes: string[];
  }> = [];
  const removedRecords: NormalizedMemoryRecord[] = [];
  const clusterMigrations: Array<{
    recordId: string;
    fromCluster: number;
    toCluster: number;
  }> = [];
  const retrievalFrequencyChanges: Array<{
    recordId: string;
    content: string;
    beforeCount: number;
    afterCount: number;
    delta: number;
  }> = [];

  // Check added & modified
  for (const [id, recordB] of mapB.entries()) {
    const recordA = mapA.get(id);
    if (!recordA) {
      addedRecords.push(recordB);
    } else {
      const changes: string[] = [];
      if (recordA.content !== recordB.content) {
        changes.push('content');
      }
      if (JSON.stringify(recordA.metadata) !== JSON.stringify(recordB.metadata)) {
        changes.push('metadata');
      }
      if (recordA.memoryType !== recordB.memoryType) {
        changes.push('memoryType');
      }
      if (
        (recordA.embedding === null) !== (recordB.embedding === null) ||
        (recordA.embedding && recordB.embedding && recordA.embedding.length !== recordB.embedding.length)
      ) {
        changes.push('embedding');
      }

      if (changes.length > 0) {
        modifiedRecords.push({
          before: recordA,
          after: recordB,
          changes,
        });
      }

      // Check cluster migration if cluster maps exist
      if (snapshotA.clusterMap && snapshotB.clusterMap) {
        const cA = snapshotA.clusterMap.get(id);
        const cB = snapshotB.clusterMap.get(id);
        if (cA !== undefined && cB !== undefined && cA !== cB) {
          clusterMigrations.push({
            recordId: id,
            fromCluster: cA,
            toCluster: cB,
          });
        }
      }

      // Check retrieval frequency
      const countA = recordA.retrievalEvents?.length || 0;
      const countB = recordB.retrievalEvents?.length || 0;
      if (countA !== countB) {
        retrievalFrequencyChanges.push({
          recordId: id,
          content: recordB.content,
          beforeCount: countA,
          afterCount: countB,
          delta: countB - countA,
        });
      }
    }
  }

  // Check removed
  for (const [id, recordA] of mapA.entries()) {
    if (!mapB.has(id)) {
      removedRecords.push(recordA);
    }
  }

  return {
    snapshotA: snapshotA.name,
    snapshotB: snapshotB.name,
    timestampA: snapshotA.timestamp,
    timestampB: snapshotB.timestamp,
    addedRecords,
    modifiedRecords,
    removedRecords,
    clusterMigrations,
    retrievalFrequencyChanges,
  };
}
