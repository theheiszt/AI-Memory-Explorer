/**
 * Stream Graph Edge Styling & Taxonomy Engine (Stage 4)
 * Provides visual encoding, styling rules, and canvas rasterization for typed relationships.
 */

import type { StreamGraphEdge } from '../../types/streamGraph.ts';

export interface EdgeStyle {
  strokeColor: string;
  lineWidth: number;
  dashPattern: number[];
  directed: boolean;
  opacity: number;
  badgeLabel?: string;
}

export const EXPLICIT_RELATION_COLORS: Record<string, string> = {
  causes: '#10b981',       // Emerald
  contradicts: '#ef4444',  // Rose / Red
  supersedes: '#f59e0b',   // Amber
  references: '#0ea5e9',   // Sky blue
  associated: '#8b5cf6',   // Violet
  default: '#3b82f6',      // Blue
};

/**
 * Returns rendering style attributes for an edge based on its type, relation, and weight.
 */
export function getEdgeStyle(edge: StreamGraphEdge): EdgeStyle {
  switch (edge.type) {
    case 'explicit': {
      const relKey = (edge.relation || 'default').toLowerCase();
      const color = EXPLICIT_RELATION_COLORS[relKey] || EXPLICIT_RELATION_COLORS.default;
      return {
        strokeColor: color,
        lineWidth: Math.max(1.5, Math.min(3.5, 1.5 + (edge.weight || 0.8) * 1.5)),
        dashPattern: [], // Solid
        directed: edge.directed !== false,
        opacity: 0.85,
        badgeLabel: edge.relation,
      };
    }

    case 'similarity': {
      // Stroke width proportional to cosine similarity score
      const sim = edge.weight || 0.7;
      const width = Math.max(1.0, Math.min(3.0, (sim - 0.5) * 4.0));
      return {
        strokeColor: '#6366f1', // Indigo
        lineWidth: width,
        dashPattern: [5, 4],    // Dashed
        directed: false,
        opacity: Math.max(0.3, Math.min(0.75, sim * 0.8)),
      };
    }

    case 'temporal': {
      return {
        strokeColor: '#06b6d4', // Cyan
        lineWidth: 1.5,
        dashPattern: [2, 3],    // Dotted
        directed: true,
        opacity: 0.75,
        badgeLabel: 'then',
      };
    }

    case 'retrieval': {
      return {
        strokeColor: '#a855f7', // Purple
        lineWidth: 1.75,
        dashPattern: [6, 3, 2, 3], // Dash-dot
        directed: false,
        opacity: 0.7,
        badgeLabel: 'co-retrieved',
      };
    }

    case 'cluster': {
      return {
        strokeColor: '#94a3b8', // Slate
        lineWidth: 1.0,
        dashPattern: [3, 3],
        directed: false,
        opacity: 0.35,
      };
    }

    default:
      return {
        strokeColor: '#64748b',
        lineWidth: 1.0,
        dashPattern: [],
        directed: false,
        opacity: 0.5,
      };
  }
}

/**
 * Draws a directed arrowhead on a 2D canvas context.
 */
export function renderArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  targetRadius: number,
  color: string,
  arrowSize: number = 8
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < targetRadius + arrowSize) return;

  // Endpoint at target node's outer edge
  const endX = toX - (dx / dist) * (targetRadius + 1);
  const endY = toY - (dy / dist) * (targetRadius + 1);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle - Math.PI / 6),
    endY - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    endX - (arrowSize * 0.6) * Math.cos(angle),
    endY - (arrowSize * 0.6) * Math.sin(angle)
  );
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle + Math.PI / 6),
    endY - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
