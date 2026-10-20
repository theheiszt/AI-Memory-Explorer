/**
 * Force-Directed Layout Simulation Engine (Stage 2)
 * High-performance, convergent physics simulation for Stream Graph.
 *
 * Physics Model:
 * 1. Repulsive forces (Coulomb / inverse-square with distance cutoff)
 * 2. Spring attraction along typed edges (Hooke's law with resting length)
 * 3. Cluster cohesion gravity toward cluster centroids
 * 4. Center gravity toward viewport origin to bind disconnected islands
 * 5. Kinetic damping and alpha decay cooling schedule
 * 6. Quiescence threshold (epsilon) to put simulation to sleep and save CPU
 * 7. Position caching to prevent violent jumps on selection or filtering
 */

import type { StreamGraphNode, StreamGraphEdge } from '../../types/streamGraph.ts';

export interface ForceLayoutConfig {
  center: [number, number];
  repulsion: number;
  linkDistance: number;
  linkStrength: number;
  clusterStrength: number;
  gravity: number;
  damping: number;
  alphaDecay: number;
  alphaMin: number;
  collisionPadding: number;
}

export const DEFAULT_LAYOUT_CONFIG: ForceLayoutConfig = {
  center: [0, 0],
  repulsion: 180,
  linkDistance: 80,
  linkStrength: 0.35,
  clusterStrength: 0.12,
  gravity: 0.04,
  damping: 0.65,
  alphaDecay: 0.022,
  alphaMin: 0.005,
  collisionPadding: 4,
};

export class ForceLayoutEngine {
  private config: ForceLayoutConfig;
  private nodes: StreamGraphNode[] = [];
  private edges: StreamGraphEdge[] = [];
  private nodeIndexMap = new Map<string, number>();
  private alpha: number = 0;
  private isSleeping: boolean = true;
  private clusterCentroids = new Map<number, { x: number; y: number; count: number }>();

  constructor(config: Partial<ForceLayoutConfig> = {}) {
    this.config = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  }

  /**
   * Initializes or updates the simulation with nodes and edges.
   * Preserves established positions for existing nodes (position caching).
   */
  public setGraph(
    nodes: StreamGraphNode[],
    edges: StreamGraphEdge[],
    options: {
      initialPositions?: Map<string, [number, number]>;
      warmupTicks?: number;
      preserveExisting?: boolean;
    } = {}
  ): void {
    const { initialPositions, warmupTicks = 40, preserveExisting = true } = options;
    const oldPositions = new Map<string, { x: number; y: number }>();

    if (preserveExisting && this.nodes.length > 0) {
      for (const n of this.nodes) {
        if (n.x !== 0 || n.y !== 0) {
          oldPositions.set(n.id, { x: n.x, y: n.y });
        }
      }
    }

    this.nodes = nodes;
    this.edges = edges;
    this.nodeIndexMap.clear();

    const [cx, cy] = this.config.center;
    const spread = Math.max(120, Math.sqrt(nodes.length) * 45);

    // Seed or preserve positions
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      this.nodeIndexMap.set(node.id, i);

      if (oldPositions.has(node.id)) {
        const pos = oldPositions.get(node.id)!;
        node.x = pos.x;
        node.y = pos.y;
      } else if (initialPositions && initialPositions.has(node.memoryId)) {
        const [px, py] = initialPositions.get(node.memoryId)!;
        node.x = cx + px * spread;
        node.y = cy + py * spread;
      } else if (node.x === 0 && node.y === 0) {
        // Spiral / Golden angle distribution
        const angle = i * 2.39996323; // Golden angle
        const radius = Math.sqrt(i + 1) * 35;
        node.x = cx + Math.cos(angle) * radius;
        node.y = cy + Math.sin(angle) * radius;
      }

      node.vx = 0;
      node.vy = 0;
    }

    this.alpha = 1.0;
    this.isSleeping = false;

    if (warmupTicks > 0) {
      this.warmup(warmupTicks);
    }
  }

  /**
   * Run a fixed number of relaxation iterations synchronously.
   */
  public warmup(ticks: number): void {
    for (let t = 0; t < ticks; t++) {
      if (this.isSleeping) break;
      this.tick();
    }
  }

  /**
   * Executes a single physics iteration.
   * Returns true if simulation is active, false if quiescent (sleeping).
   */
  public tick(): boolean {
    if (this.isSleeping || this.alpha < this.config.alphaMin) {
      this.alpha = 0;
      this.isSleeping = true;
      return false;
    }

    const visibleNodes = this.nodes.filter(n => n.isVisible);
    const n = visibleNodes.length;
    if (n === 0) {
      this.isSleeping = true;
      return false;
    }

    const [cx, cy] = this.config.center;
    const alpha = this.alpha;

    // 1. Compute cluster centroids
    this.clusterCentroids.clear();
    for (const node of visibleNodes) {
      if (node.clusterId !== undefined) {
        const c = this.clusterCentroids.get(node.clusterId) || { x: 0, y: 0, count: 0 };
        c.x += node.x;
        c.y += node.y;
        c.count += 1;
        this.clusterCentroids.set(node.clusterId, c);
      }
    }
    this.clusterCentroids.forEach(c => {
      if (c.count > 0) {
        c.x /= c.count;
        c.y /= c.count;
      }
    });

    // 2. Central gravity & cluster cohesion forces
    for (let i = 0; i < n; i++) {
      const node = visibleNodes[i];
      if (node.fx !== null && node.fx !== undefined) continue;

      // Central gravity
      const dxCenter = cx - node.x;
      const dyCenter = cy - node.y;
      node.vx += dxCenter * this.config.gravity * alpha;
      node.vy += dyCenter * this.config.gravity * alpha;

      // Cluster cohesion
      if (node.clusterId !== undefined) {
        const centroid = this.clusterCentroids.get(node.clusterId);
        if (centroid && centroid.count > 1) {
          const dxCluster = centroid.x - node.x;
          const dyCluster = centroid.y - node.y;
          node.vx += dxCluster * this.config.clusterStrength * alpha;
          node.vy += dyCluster * this.config.clusterStrength * alpha;
        }
      }
    }

    // 3. Repulsive forces (Coulomb) & collision avoidance
    // For large graphs (> 800 visible nodes), use windowed step to maintain 60 FPS
    const repStep = n > 800 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const nodeA = visibleNodes[i];

      for (let j = i + 1; j < n; j += repStep) {
        const nodeB = visibleNodes[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        let distSq = dx * dx + dy * dy;
        const minDist = nodeA.radius + nodeB.radius + this.config.collisionPadding;
        const minDistSq = minDist * minDist;

        // Collision push
        if (distSq < minDistSq) {
          const dist = Math.sqrt(distSq) || 0.1;
          const overlap = (minDist - dist) / dist * 0.5 * alpha;
          const pushX = dx * overlap;
          const pushY = dy * overlap;

          if (nodeA.fx === null || nodeA.fx === undefined) {
            nodeA.vx -= pushX;
            nodeA.vy -= pushY;
          }
          if (nodeB.fx === null || nodeB.fx === undefined) {
            nodeB.vx += pushX;
            nodeB.vy += pushY;
          }
        } else if (distSq < 90000) { // Limit repulsion range (~300px)
          const dist = Math.sqrt(distSq);
          const force = (this.config.repulsion * alpha) / (distSq + 25);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (nodeA.fx === null || nodeA.fx === undefined) {
            nodeA.vx -= fx;
            nodeA.vy -= fy;
          }
          if (nodeB.fx === null || nodeB.fx === undefined) {
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }
    }

    // 4. Spring attraction along edges
    for (const edge of this.edges) {
      const idxA = this.nodeIndexMap.get(edge.source);
      const idxB = this.nodeIndexMap.get(edge.target);
      if (idxA === undefined || idxB === undefined) continue;

      const nodeA = this.nodes[idxA];
      const nodeB = this.nodes[idxB];
      if (!nodeA.isVisible || !nodeB.isVisible) continue;

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

      // Desired distance adjusted by edge type and weight
      let targetDist = this.config.linkDistance;
      if (edge.type === 'explicit') targetDist *= 0.85; // Tighter explicit relations
      if (edge.type === 'cluster') targetDist *= 1.25;

      const delta = dist - targetDist;
      const strength = this.config.linkStrength * (edge.weight || 0.5) * alpha;
      const springX = (dx / dist) * delta * strength;
      const springY = (dy / dist) * delta * strength;

      if (nodeA.fx === null || nodeA.fx === undefined) {
        nodeA.vx += springX;
        nodeA.vy += springY;
      }
      if (nodeB.fx === null || nodeB.fx === undefined) {
        nodeB.vx -= springX;
        nodeB.vy -= springY;
      }
    }

    // 5. Integrate positions and apply velocity damping
    let maxVelocitySq = 0;
    const damping = this.config.damping;

    for (let i = 0; i < n; i++) {
      const node = visibleNodes[i];

      if (node.fx !== null && node.fx !== undefined) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.vx *= damping;
        node.x += node.vx;
      }

      if (node.fy !== null && node.fy !== undefined) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.vy *= damping;
        node.y += node.vy;
      }

      const velSq = node.vx * node.vx + node.vy * node.vy;
      if (velSq > maxVelocitySq) {
        maxVelocitySq = velSq;
      }
    }

    // 6. Cooling schedule decay
    this.alpha += (0 - this.alpha) * this.config.alphaDecay;

    // Check quiescence threshold (epsilon = 0.02 px/tick)
    if (this.alpha < this.config.alphaMin || maxVelocitySq < 0.0004) {
      this.alpha = 0;
      this.isSleeping = true;
      return false;
    }

    return true;
  }

  /**
   * Gently reheat simulation without clearing positions (e.g. after filter change or drag).
   */
  public reheat(alpha: number = 0.3): void {
    this.alpha = Math.max(this.alpha, alpha);
    this.isSleeping = false;
  }

  /**
   * Pin a node at specific coordinates (during drag).
   */
  public pinNode(nodeId: string, x: number, y: number): void {
    const idx = this.nodeIndexMap.get(nodeId);
    if (idx !== undefined) {
      const node = this.nodes[idx];
      node.fx = x;
      node.fy = y;
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
      this.reheat(0.15);
    }
  }

  /**
   * Release a pinned node after drag ends.
   */
  public unpinNode(nodeId: string): void {
    const idx = this.nodeIndexMap.get(nodeId);
    if (idx !== undefined) {
      const node = this.nodes[idx];
      node.fx = null;
      node.fy = null;
    }
  }

  public getAlpha(): number {
    return this.alpha;
  }

  public getIsSleeping(): boolean {
    return this.isSleeping;
  }

  public getNodes(): StreamGraphNode[] {
    return this.nodes;
  }
}
