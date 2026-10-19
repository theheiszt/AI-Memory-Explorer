import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  RotateCcw,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Share2,
  GitBranch,
  Minimize2,
  Info,
} from 'lucide-react';
import type {
  ProjectionPoint,
  ClusterInfo,
  NormalizedMemoryRecord,
  ConnectionMode,
  SubMemoryNode,
  MemoryConnection,
} from '../types/memory.ts';
import {
  calculateGlobalConnections,
  expandMemoryRecord,
  computeVirtualReach,
} from '../services/adapters/memoryExpansionEngine.ts';

interface SemanticMap3DProps {
  points: ProjectionPoint[];
  clusters: ClusterInfo[];
  selectedRecordId: string | null;
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
  colorBy: 'cluster' | 'type' | 'source';
  densityScale?: number;
  onDensityScaleChange?: (scale: number) => void;
  connectionMode?: ConnectionMode;
  onChangeConnectionMode?: (mode: ConnectionMode) => void;
  expandedRecordIds?: Set<string>;
  expandedSubMemories?: Map<string, SubMemoryNode[]>;
  onToggleExpandRecord?: (recordId: string) => void;
  onExpandCluster?: (clusterId: number) => void;
  onCollapseAll?: () => void;
}

const TYPE_COLORS: Record<string, number> = {
  episodic: 0x3b82f6,
  semantic: 0x10b981,
  procedural: 0xf59e0b,
  working: 0xec4899,
  profile: 0x8b5cf6,
  system: 0x64748b,
  custom: 0x06b6d4,
};

// Pre-allocated math objects for zero garbage collection
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _quaternion = new THREE.Quaternion();
const _color = new THREE.Color();
const _subColor = new THREE.Color();

export const SemanticMap3D: React.FC<SemanticMap3DProps> = ({
  points,
  clusters,
  selectedRecordId,
  onSelectRecord,
  colorBy,
  densityScale = 1.0,
  onDensityScaleChange,
  connectionMode = 'all',
  onChangeConnectionMode,
  expandedRecordIds = new Set<string>(),
  expandedSubMemories = new Map<string, SubMemoryNode[]>(),
  onToggleExpandRecord,
  onExpandCluster,
  onCollapseAll,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pointScale, setPointScale] = useState(1);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<ProjectionPoint | null>(null);
  const [hoveredSubNode, setHoveredSubNode] = useState<SubMemoryNode | null>(null);
  const [activeConnMode, setActiveConnMode] = useState<ConnectionMode>(connectionMode);
  const [connMaxNeighbors, setConnMaxNeighbors] = useState<number>(3);

  // Sync connectionMode prop
  useEffect(() => {
    setActiveConnMode(connectionMode);
  }, [connectionMode]);

  const handleConnModeChange = (mode: ConnectionMode) => {
    setActiveConnMode(mode);
    onChangeConnectionMode?.(mode);
  };

  // Precompute connections via expansion engine
  const connections = useMemo(() => {
    return calculateGlobalConnections(points, activeConnMode, {
      maxNeighbors: connMaxNeighbors,
      spatialThreshold: 75 * densityScale,
      expandedRecordIds,
      expandedMap: expandedSubMemories,
    });
  }, [points, activeConnMode, connMaxNeighbors, densityScale, expandedRecordIds, expandedSubMemories]);

  // Virtual reach metric
  const reachMetrics = useMemo(() => {
    return computeVirtualReach(points.length, expandedRecordIds.size, 100);
  }, [points.length, expandedRecordIds.size]);

  // State refs for animation loop
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const clustersRef = useRef(clusters);
  clustersRef.current = clusters;
  const selectedIdRef = useRef(selectedRecordId);
  selectedIdRef.current = selectedRecordId;
  const onSelectRef = useRef(onSelectRecord);
  onSelectRef.current = onSelectRecord;
  const colorByRef = useRef(colorBy);
  colorByRef.current = colorBy;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const pointScaleRef = useRef(pointScale);
  pointScaleRef.current = pointScale;
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  const expandedIdsRef = useRef(expandedRecordIds);
  expandedIdsRef.current = expandedRecordIds;
  const expandedSubsRef = useRef(expandedSubMemories);
  expandedSubsRef.current = expandedSubMemories;

  // External camera triggers
  const resetCameraRef = useRef<(() => void) | null>(null);
  const zoomInRef = useRef<(() => void) | null>(null);
  const zoomOutRef = useRef<(() => void) | null>(null);

  // Selection state
  const selectedPoint = useMemo(() => {
    return points.find(p => p.id === selectedRecordId) || null;
  }, [points, selectedRecordId]);

  const isSelectedExpanded = selectedRecordId ? expandedRecordIds.has(selectedRecordId) : false;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let animationFrameId: number;

    try {
      const isHeadless =
        typeof navigator !== 'undefined' &&
        (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

      renderer = new THREE.WebGLRenderer({
        antialias: !isHeadless,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x030712, 0.0022);

      // Studio Environment map
      try {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        pmremGenerator.dispose();
      } catch {
        // Fallback gracefully
      }

      camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        3000
      );
      camera.position.set(0, 95, 270);
      camera.lookAt(0, 0, 0);

      // Lighting Rig
      const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0x818cf8, 1.4);
      dirLight.position.set(120, 180, 100);
      scene.add(dirLight);

      // Orientation ground grid
      const gridHelper = new THREE.GridHelper(500, 24, 0x1e293b, 0x0f172a);
      gridHelper.position.y = -95;
      scene.add(gridHelper);

      // Primary Base Mesh (InstancedMesh: 1 Draw Call for 1k - 10k vectors)
      const baseRadius = pointsRef.current.length > 5000 ? 1.6 : pointsRef.current.length > 1500 ? 2.2 : 3.0;
      const sphereGeo = new THREE.SphereGeometry(baseRadius, 12, 12);
      const sphereMat = new THREE.MeshStandardMaterial({
        roughness: 0.25,
        metalness: 0.35,
      });

      let instancedMesh: THREE.InstancedMesh | null = null;

      // Sub-Memory Satellite Mesh (InstancedMesh for expanded micro-memories)
      const subRadius = Math.max(0.9, baseRadius * 0.45);
      const subGeo = new THREE.IcosahedronGeometry(subRadius, 1);
      const subMat = new THREE.MeshStandardMaterial({
        roughness: 0.2,
        metalness: 0.5,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.35,
      });
      let subInstancedMesh: THREE.InstancedMesh | null = null;
      let subMemoryLookup: SubMemoryNode[] = [];

      // Global Synaptic LineSegments (Single draw call for all connections)
      let lineSegmentsMesh: THREE.LineSegments | null = null;

      // Selection Halo Ring
      const ringGeo = new THREE.RingGeometry(baseRadius * 1.6, baseRadius * 2.3, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const selectionRing = new THREE.Mesh(ringGeo, ringMat);
      selectionRing.visible = false;
      scene.add(selectionRing);

      // Spherical camera controller
      const spherical = new THREE.Spherical(270, Math.PI / 2.8, 0);
      let isMouseDown = false;
      let prevMousePos = { x: 0, y: 0 };

      // Helper to build instanced mesh for base memory vectors
      function updateInstancedMesh() {
        if (instancedMesh) {
          scene?.remove(instancedMesh);
          instancedMesh.geometry.dispose();
          instancedMesh = null;
        }

        const currentPoints = pointsRef.current;
        const count = currentPoints.length;
        if (count === 0) return;

        instancedMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, count);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const currentClusters = clustersRef.current;
        const currentColorBy = colorByRef.current;
        const currentScale = pointScaleRef.current;

        for (let i = 0; i < count; i++) {
          const p = currentPoints[i];
          _position.set(p.x, p.y, p.z ?? ((i % 7) - 3) * 15);
          _scale.set(currentScale, currentScale, currentScale);
          _matrix.compose(_position, _quaternion, _scale);
          instancedMesh.setMatrixAt(i, _matrix);

          let hex = 0x6366f1;
          if (currentColorBy === 'cluster') {
            const cl = currentClusters.find(c => c.id === p.clusterId);
            if (cl?.color) hex = parseInt(cl.color.replace('#', '0x'), 16);
          } else if (currentColorBy === 'type') {
            const t = p.record.memoryType || 'semantic';
            hex = TYPE_COLORS[t] || 0x6366f1;
          }
          _color.setHex(hex);
          instancedMesh.setColorAt(i, _color);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) {
          instancedMesh.instanceColor.needsUpdate = true;
        }
        instancedMesh.computeBoundingSphere();
        scene?.add(instancedMesh);
      }

      // Helper to build sub-memory satellites for expanded records
      function updateExpandedSubMesh() {
        if (subInstancedMesh) {
          scene?.remove(subInstancedMesh);
          subInstancedMesh.geometry.dispose();
          subInstancedMesh = null;
          subMemoryLookup = [];
        }

        const expandedIds = expandedIdsRef.current;
        const expandedMap = expandedSubsRef.current;
        const currentPoints = pointsRef.current;
        if (expandedIds.size === 0) return;

        // Collect all sub-memories to render
        const allSubs: Array<{ sub: SubMemoryNode; worldPos: THREE.Vector3 }> = [];
        const pointMap = new Map<string, ProjectionPoint>();
        currentPoints.forEach(p => pointMap.set(p.id, p));

        expandedIds.forEach(parentId => {
          const parentPoint = pointMap.get(parentId);
          const subs = expandedMap.get(parentId);
          if (parentPoint && subs) {
            subs.forEach(s => {
              allSubs.push({
                sub: s,
                worldPos: new THREE.Vector3(
                  parentPoint.x + s.relativeOffset[0],
                  parentPoint.y + s.relativeOffset[1],
                  (parentPoint.z ?? 0) + s.relativeOffset[2]
                ),
              });
            });
          }
        });

        if (allSubs.length === 0) return;

        subInstancedMesh = new THREE.InstancedMesh(subGeo, subMat, allSubs.length);
        subInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        subMemoryLookup = allSubs.map(item => item.sub);

        for (let i = 0; i < allSubs.length; i++) {
          const { sub, worldPos } = allSubs[i];
          _matrix.compose(worldPos, _quaternion, _scale);
          subInstancedMesh.setMatrixAt(i, _matrix);

          // Sub-nodes have bright cyan/amber coloring based on subType
          if (sub.subType === 'causal_step') {
            _subColor.setHex(0xf59e0b);
          } else if (sub.subType === 'proposition') {
            _subColor.setHex(0x38bdf8);
          } else if (sub.subType === 'sub_token') {
            _subColor.setHex(0xa855f7);
          } else {
            _subColor.setHex(0x34d399);
          }
          subInstancedMesh.setColorAt(i, _subColor);
        }

        subInstancedMesh.instanceMatrix.needsUpdate = true;
        if (subInstancedMesh.instanceColor) {
          subInstancedMesh.instanceColor.needsUpdate = true;
        }
        subInstancedMesh.computeBoundingSphere();
        scene?.add(subInstancedMesh);
      }

      // Helper to build line segments for ALL connections in a single draw call
      function updateAllConnectionsMesh() {
        if (lineSegmentsMesh) {
          scene?.remove(lineSegmentsMesh);
          lineSegmentsMesh.geometry.dispose();
          lineSegmentsMesh = null;
        }

        const conns = connectionsRef.current;
        if (!conns || conns.length === 0) return;

        const currentPoints = pointsRef.current;
        const pointMap = new Map<string, THREE.Vector3>();
        currentPoints.forEach(p => {
          pointMap.set(p.id, new THREE.Vector3(p.x, p.y, p.z ?? 0));
        });

        // Add sub-memory positions to lookup
        const expandedIds = expandedIdsRef.current;
        const expandedMap = expandedSubsRef.current;
        expandedIds.forEach(parentId => {
          const parentVec = pointMap.get(parentId);
          const subs = expandedMap.get(parentId);
          if (parentVec && subs) {
            subs.forEach(s => {
              pointMap.set(
                s.id,
                new THREE.Vector3(
                  parentVec.x + s.relativeOffset[0],
                  parentVec.y + s.relativeOffset[1],
                  parentVec.z + s.relativeOffset[2]
                )
              );
            });
          }
        });

        const maxEdges = conns.length;
        const positions = new Float32Array(maxEdges * 6);
        const colors = new Float32Array(maxEdges * 6);
        let validEdgeCount = 0;

        for (let i = 0; i < maxEdges; i++) {
          const c = conns[i];
          const v1 = pointMap.get(c.sourceId);
          const v2 = pointMap.get(c.targetId);
          if (!v1 || !v2) continue;

          const pIdx = validEdgeCount * 6;
          positions[pIdx] = v1.x;
          positions[pIdx + 1] = v1.y;
          positions[pIdx + 2] = v1.z;
          positions[pIdx + 3] = v2.x;
          positions[pIdx + 4] = v2.y;
          positions[pIdx + 5] = v2.z;

          // Color based on connection type
          let r = 0.38, g = 0.51, b = 0.95; // default subtle violet/indigo
          if (c.connectionType === 'explicit') {
            r = 0.22; g = 0.74; b = 0.97; // bright cyan
          } else if (c.connectionType === 'sub_memory') {
            r = 0.96; g = 0.62; b = 0.05; // amber rays
          } else if (c.connectionType === 'temporal') {
            r = 0.05; g = 0.78; b = 0.72; // turquoise
          }

          colors[pIdx] = r;
          colors[pIdx + 1] = g;
          colors[pIdx + 2] = b;
          colors[pIdx + 3] = r * 0.7;
          colors[pIdx + 4] = g * 0.7;
          colors[pIdx + 5] = b * 0.7;

          validEdgeCount++;
        }

        if (validEdgeCount === 0) return;

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(positions.subarray(0, validEdgeCount * 6), 3)
        );
        lineGeo.setAttribute(
          'color',
          new THREE.BufferAttribute(colors.subarray(0, validEdgeCount * 6), 3)
        );

        const lineMat = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        lineSegmentsMesh = new THREE.LineSegments(lineGeo, lineMat);
        scene?.add(lineSegmentsMesh);
      }

      // Initial builds
      updateInstancedMesh();
      updateExpandedSubMesh();
      updateAllConnectionsMesh();

      // Controls & Mouse handling
      const onMouseDown = (e: MouseEvent) => {
        isMouseDown = true;
        prevMousePos = { x: e.clientX, y: e.clientY };
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isMouseDown) return;
        const deltaX = e.clientX - prevMousePos.x;
        const deltaY = e.clientY - prevMousePos.y;
        prevMousePos = { x: e.clientX, y: e.clientY };

        spherical.theta -= deltaX * 0.007;
        spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi - deltaY * 0.007));
        camera?.position.setFromSpherical(spherical);
        camera?.lookAt(0, 0, 0);
      };

      const onMouseUp = () => {
        isMouseDown = false;
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        spherical.radius = Math.max(40, Math.min(1400, spherical.radius + e.deltaY * 0.35));
        camera?.position.setFromSpherical(spherical);
        camera?.lookAt(0, 0, 0);
      };

      // Raycasting for high-speed hit detection
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onClick = (e: MouseEvent) => {
        if (!camera) return;
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // 1. First check sub-memories if active
        if (subInstancedMesh && subMemoryLookup.length > 0) {
          const subHits = raycaster.intersectObject(subInstancedMesh);
          if (subHits.length > 0 && subHits[0].instanceId !== undefined) {
            const hitSub = subMemoryLookup[subHits[0].instanceId];
            if (hitSub) {
              setHoveredSubNode(hitSub);
              const parentP = pointsRef.current.find(p => p.id === hitSub.parentId);
              if (parentP) onSelectRef.current(parentP.record);
              return;
            }
          }
        }

        // 2. Check base memory vectors
        if (instancedMesh) {
          const intersects = raycaster.intersectObject(instancedMesh);
          if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            const clickedPoint = pointsRef.current[idx];
            if (clickedPoint) {
              onSelectRef.current(clickedPoint.record);
            }
          }
        }
      };

      const onPointerMove = (e: MouseEvent) => {
        if (isMouseDown || !camera) return;
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Sub memory hover
        if (subInstancedMesh && subMemoryLookup.length > 0) {
          const subHits = raycaster.intersectObject(subInstancedMesh);
          if (subHits.length > 0 && subHits[0].instanceId !== undefined) {
            const hitSub = subMemoryLookup[subHits[0].instanceId];
            setHoveredSubNode(hitSub || null);
            container.style.cursor = 'pointer';
            return;
          }
        }
        setHoveredSubNode(null);

        // Base memory hover
        if (instancedMesh) {
          const intersects = raycaster.intersectObject(instancedMesh);
          if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            setHoveredPoint(pointsRef.current[idx] || null);
            container.style.cursor = 'pointer';
          } else {
            setHoveredPoint(null);
            container.style.cursor = isMouseDown ? 'grabbing' : 'grab';
          }
        }
      };

      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      container.addEventListener('wheel', onWheel, { passive: false });
      container.addEventListener('click', onClick);
      container.addEventListener('mousemove', onPointerMove);

      // Camera helpers
      resetCameraRef.current = () => {
        spherical.set(270, Math.PI / 2.8, 0);
        camera?.position.setFromSpherical(spherical);
        camera?.lookAt(0, 0, 0);
      };

      zoomInRef.current = () => {
        spherical.radius = Math.max(40, spherical.radius - 40);
        camera?.position.setFromSpherical(spherical);
        camera?.lookAt(0, 0, 0);
      };

      zoomOutRef.current = () => {
        spherical.radius = Math.min(1400, spherical.radius + 40);
        camera?.position.setFromSpherical(spherical);
        camera?.lookAt(0, 0, 0);
      };

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(container);

      // 60 FPS Render loop
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        if (autoRotateRef.current && !isMouseDown) {
          spherical.theta += 0.0018;
          camera?.position.setFromSpherical(spherical);
          camera?.lookAt(0, 0, 0);
        }

        // Position selection halo ring
        const currentPoints = pointsRef.current;
        const selId = selectedIdRef.current;
        if (selId && currentPoints.length > 0) {
          const selP = currentPoints.find(p => p.id === selId);
          if (selP) {
            selectionRing.position.set(selP.x, selP.y, selP.z ?? 0);
            selectionRing.lookAt(camera?.position || new THREE.Vector3());
            selectionRing.visible = true;
          } else {
            selectionRing.visible = false;
          }
        } else {
          selectionRing.visible = false;
        }

        renderer?.render(scene!, camera!);
      };

      animate();

      return () => {
        cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        container.removeEventListener('wheel', onWheel);
        container.removeEventListener('click', onClick);
        container.removeEventListener('mousemove', onPointerMove);

        if (renderer && renderer.domElement) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err: unknown) {
      console.warn('Three.js initialization notice:', err);
      setWebglError(err instanceof Error ? err.message : 'WebGL unavailable');
    }
  }, [points, clusters, colorBy, pointScale, densityScale, activeConnMode, connMaxNeighbors, expandedRecordIds, expandedSubMemories]);

  if (webglError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950 text-slate-400">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
        <h3 className="text-base font-semibold text-slate-200">3D Acceleration Fallback</h3>
        <p className="text-xs text-slate-400 max-w-md mt-1">
          WebGL context is currently running in fallback mode. Switch to the 2D Canvas Semantic Map tab above for ultra-fast vector exploration.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Synaptic Graph & Virtual Memory Reach Telemetry */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-2 text-xs shadow-xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-semibold text-slate-200">3D Vector Manifold</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <span className="font-mono text-cyan-400 font-bold">
            {points.length.toLocaleString()} Base Vectors
          </span>
          <div className="h-3 w-px bg-slate-800" />
          <span className="font-mono text-indigo-400 font-bold flex items-center gap-1" title="Virtual multi-tier capacity reachable via hierarchical sub-memory expansion">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>{(reachMetrics.totalVirtualReach).toLocaleString()} Virtual Reach</span>
          </span>
          <div className="h-3 w-px bg-slate-800" />
          <span className="font-mono text-emerald-400 text-[11px] flex items-center gap-1">
            <Share2 className="w-3 h-3 text-emerald-400" />
            <span>{connections.length.toLocaleString()} Active Synapses</span>
          </span>
        </div>

        {/* Expanded Memory Notice when nodes are expanded */}
        {expandedRecordIds.size > 0 && (
          <div className="bg-indigo-950/90 backdrop-blur border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-indigo-200 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>
                <strong>{expandedRecordIds.size}</strong> Memories Expanded into <strong>{reachMetrics.materializedSubCount}</strong> Micro-Vectors
              </span>
            </div>
            <button
              onClick={onCollapseAll}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-700/60 transition-colors"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Top Right: Quick Action & Camera Toolset */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg shadow-xl">
        <button
          onClick={() => zoomInRef.current?.()}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomOutRef.current?.()}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => resetCameraRef.current?.()}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Reset Camera View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-800 my-0.5" />
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-1.5 rounded transition-colors ${
            autoRotate
              ? 'text-cyan-400 bg-cyan-950/80 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
          title="Toggle Ambient Rotation"
        >
          <Compass className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
        </button>
      </div>

      {/* Hover Tooltip for Base Vectors */}
      {hoveredPoint && !hoveredSubNode && (
        <div className="absolute top-16 left-4 z-10 bg-slate-900/95 backdrop-blur border border-cyan-500/40 rounded-lg p-2.5 text-xs text-slate-200 max-w-xs shadow-2xl pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 uppercase font-semibold">
              {hoveredPoint.record.memoryType || 'semantic'}
            </span>
            <span className="text-[11px] font-mono text-slate-400 truncate">
              {hoveredPoint.id}
            </span>
          </div>
          <p className="line-clamp-2 text-slate-300 font-sans leading-snug">
            {hoveredPoint.record.content}
          </p>
          <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Cluster #{hoveredPoint.clusterId}</span>
            <span className="text-indigo-400 font-semibold">100x Virtual Reach</span>
          </div>
        </div>
      )}

      {/* Hover Tooltip for Expanded Sub-Nodes */}
      {hoveredSubNode && (
        <div className="absolute top-16 left-4 z-10 bg-indigo-950/95 backdrop-blur border border-indigo-400/60 rounded-lg p-2.5 text-xs text-indigo-100 max-w-xs shadow-2xl pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-200 uppercase font-bold">
              {hoveredSubNode.title}
            </span>
            <span className="text-[10px] font-mono text-indigo-300">
              Sim: {(hoveredSubNode.similarityToParent * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-slate-200 font-sans leading-snug">
            {hoveredSubNode.detail}
          </p>
          <div className="mt-1.5 pt-1.5 border-t border-indigo-800/60 flex items-center justify-between text-[10px] text-indigo-300 font-mono">
            <span>Attn: {(hoveredSubNode.attentionWeight * 100).toFixed(0)}%</span>
            <span>{hoveredSubNode.tokensCount} tokens</span>
          </div>
        </div>
      )}

      {/* Bottom Control Dock: Connections Controller, Density Scale & Memory Expansion */}
      <div className="absolute bottom-4 inset-x-4 z-10 flex flex-col items-center pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl shadow-2xl p-2.5 max-w-4xl w-full flex flex-col gap-2">
          {/* Main Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Connection Mode Selector (All Connections, Explicit, Cluster, Focused, Off) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Connections:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'all', label: 'All Synapses' },
                    { id: 'explicit', label: 'Explicit & Causal' },
                    { id: 'cluster', label: 'Cluster Web' },
                    { id: 'focused', label: 'Focused' },
                    { id: 'off', label: 'Off' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleConnModeChange(opt.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      activeConnMode === opt.id
                        ? 'bg-emerald-600 text-white font-semibold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Scale Slider & Memory Expansion Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Density Scale */}
              {onDensityScaleChange && (
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400 text-[11px]">Density Scale:</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={densityScale}
                    onChange={e => onDensityScaleChange(parseFloat(e.target.value))}
                    className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                    title="Scale cluster density & spatial dispersion"
                  />
                  <span className="font-mono text-cyan-400 text-[11px] w-8">
                    {densityScale.toFixed(2)}x
                  </span>
                </div>
              )}

              {/* Point Sphere Scale Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px]">Node Size:</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.2"
                  step="0.1"
                  value={pointScale}
                  onChange={e => setPointScale(parseFloat(e.target.value))}
                  className="w-16 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-400"
                  title="Adjust node sphere radius"
                />
              </div>

              {/* Expand Selected Memory Button */}
              {selectedPoint && onToggleExpandRecord && (
                <button
                  onClick={() => onToggleExpandRecord(selectedPoint.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow ${
                    isSelectedExpanded
                      ? 'bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-400/50'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/50'
                  }`}
                  title="Expand memory into 16 constituent sub-vectors (reaching 100k - 1M virtual space)"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>
                    {isSelectedExpanded ? 'Collapse Sub-Manifold' : '⚡ Expand Memory (100x Reach)'}
                  </span>
                </button>
              )}

              {/* Expand Cluster Button */}
              {selectedPoint && onExpandCluster && (
                <button
                  onClick={() => onExpandCluster(selectedPoint.clusterId)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                  title="Expand all memory vectors in this cluster"
                >
                  Expand Cluster #{selectedPoint.clusterId}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
