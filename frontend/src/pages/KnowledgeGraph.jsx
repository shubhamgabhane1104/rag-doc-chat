import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Network,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RefreshCw,
  Download,
  Search,
  BookOpen,
  MessageSquare,
  Sparkles,
  Layers,
  FileText,
  Sliders,
  X,
  Play,
  Pause,
  ChevronRight,
  ExternalLink,
  Info,
  Check,
} from 'lucide-react';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';

// Color palette mapping by category
const CATEGORY_COLORS = {
  Architecture: {
    bg: '#4f46e5', // indigo-600
    border: '#818cf8',
    glow: 'rgba(99, 102, 241, 0.4)',
    text: '#ffffff',
    pillBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    pillText: 'text-indigo-700 dark:text-indigo-300',
    pillBorder: 'border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  Algorithm: {
    bg: '#059669', // emerald-600
    border: '#34d399',
    glow: 'rgba(16, 185, 129, 0.4)',
    text: '#ffffff',
    pillBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    pillText: 'text-emerald-700 dark:text-emerald-300',
    pillBorder: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  Component: {
    bg: '#d97706', // amber-600
    border: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.4)',
    text: '#ffffff',
    pillBg: 'bg-amber-50 dark:bg-amber-950/60',
    pillText: 'text-amber-700 dark:text-amber-300',
    pillBorder: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  Security: {
    bg: '#e11d48', // rose-600
    border: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.4)',
    text: '#ffffff',
    pillBg: 'bg-rose-50 dark:bg-rose-950/60',
    pillText: 'text-rose-700 dark:text-rose-300',
    pillBorder: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  Metric: {
    bg: '#0891b2', // cyan-600
    border: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.4)',
    text: '#ffffff',
    pillBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    pillText: 'text-cyan-700 dark:text-cyan-300',
    pillBorder: 'border-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-500',
  },
  Concept: {
    bg: '#9333ea', // purple-600
    border: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.4)',
    text: '#ffffff',
    pillBg: 'bg-purple-50 dark:bg-purple-950/60',
    pillText: 'text-purple-700 dark:text-purple-300',
    pillBorder: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
};

const DEFAULT_COLOR = {
  bg: '#64748b', // slate-500
  border: '#94a3b8',
  glow: 'rgba(100, 116, 139, 0.3)',
  text: '#ffffff',
  pillBg: 'bg-slate-50 dark:bg-slate-800',
  pillText: 'text-slate-700 dark:text-slate-300',
  pillBorder: 'border-slate-200 dark:border-slate-700',
  dot: 'bg-slate-400',
};

export default function KnowledgeGraph() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const canvasRef = useRef(null);

  // Graph Data State
  const [graphData, setGraphData] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Interactive View Controls
  const [layoutMode, setLayoutMode] = useState('force'); // 'force' | 'radial'
  const [physicsPaused, setPhysicsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showSummaryBanner, setShowSummaryBanner] = useState(true);

  // Simulation state stored in refs to prevent render lag
  const simNodesRef = useRef([]);
  const simEdgesRef = useRef([]);
  const animFrameRef = useRef(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const draggedNodeRef = useRef(null);

  // Fetch document details and knowledge graph
  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch document metadata
      const docRes = await client.get('/documents');
      const doc = docRes.data.find((d) => d.id === documentId);
      if (doc) setDocumentInfo(doc);

      // 2. Fetch existing or generated graph
      const graphRes = await client.get(`/graphs/${documentId}`);
      if (graphRes.data.graph) {
        initGraphSimulation(graphRes.data.graph);
      } else {
        // Trigger auto-generation if not cached
        await handleGenerate();
      }
    } catch (err) {
      console.error('Failed to load knowledge graph:', err);
      setError(
        err.response?.data?.error ||
          'Failed to load Knowledge Graph. Please try generating it.'
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadGraph();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [loadGraph]);

  // Handle Graph Generation / Regeneration
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await client.post(`/graphs/${documentId}/generate`);
      initGraphSimulation(res.data.graph);
    } catch (err) {
      console.error('Generation error:', err);
      setError(
        err.response?.data?.error ||
          'AI graph generation encountered an issue. Please try again.'
      );
    } finally {
      setGenerating(false);
    }
  };

  // Initialize nodes and edge positions
  const initGraphSimulation = (data) => {
    setGraphData(data);
    setSelectedNode(null);

    const canvas = canvasRef.current;
    const width = canvas ? canvas.clientWidth : 900;
    const height = canvas ? canvas.clientHeight : 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodes = (data.nodes || []).map((node, i) => {
      const angle = (i / data.nodes.length) * 2 * Math.PI;
      const dist =
        node.importance === 1
          ? 0
          : node.importance === 2
          ? 140 + (i % 3) * 30
          : 250 + (i % 4) * 40;

      const radius =
        node.importance === 1 ? 34 : node.importance === 2 ? 26 : 20;

      return {
        ...node,
        x: centerX + Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
        y: centerY + Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius,
      };
    });

    simNodesRef.current = nodes;
    simEdgesRef.current = data.edges || [];

    // Reset view transform to center
    transformRef.current = { x: 0, y: 0, scale: 0.95 };
  };

  // Physics simulation step
  const updatePhysics = () => {
    if (physicsPaused || layoutMode === 'radial') return;

    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    if (!nodes || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const centerX = (canvas ? canvas.clientWidth : 900) / 2;
    const centerY = (canvas ? canvas.clientHeight : 600) / 2;

    const repulsionConstant = 3600;
    const springLength = 150;
    const springStiffness = 0.04;
    const centerGravity = 0.015;
    const damping = 0.84;

    // 1. Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);

        if (dist < 400) {
          const force = repulsionConstant / (distSq + 100);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }
    }

    // 2. Spring attraction along edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const delta = dist - springLength;
      const force = delta * springStiffness;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      src.vx += fx;
      src.vy += fy;
      tgt.vx -= fx;
      tgt.vy -= fy;
    }

    // 3. Central gravity and position integration
    for (const node of nodes) {
      // Gentle pull to center
      node.vx += (centerX - node.x) * centerGravity;
      node.vy += (centerY - node.y) * centerGravity;

      if (draggedNodeRef.current !== node) {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      } else {
        node.vx = 0;
        node.vy = 0;
      }
    }
  };

  // Radial Mind Map calculation
  const applyRadialLayout = () => {
    const nodes = simNodesRef.current;
    if (!nodes || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const centerX = (canvas ? canvas.clientWidth : 900) / 2;
    const centerY = (canvas ? canvas.clientHeight : 600) / 2;

    const tier1 = nodes.filter((n) => n.importance === 1);
    const tier2 = nodes.filter((n) => n.importance === 2);
    const tier3 = nodes.filter((n) => n.importance === 3);

    // Center root nodes
    tier1.forEach((n, idx) => {
      n.x = centerX + (idx - (tier1.length - 1) / 2) * 80;
      n.y = centerY;
      n.vx = 0;
      n.vy = 0;
    });

    // Inner ring (Tier 2)
    tier2.forEach((n, idx) => {
      const angle = (idx / Math.max(tier2.length, 1)) * 2 * Math.PI;
      n.x = centerX + Math.cos(angle) * 170;
      n.y = centerY + Math.sin(angle) * 170;
      n.vx = 0;
      n.vy = 0;
    });

    // Outer ring (Tier 3)
    tier3.forEach((n, idx) => {
      const angle = (idx / Math.max(tier3.length, 1)) * 2 * Math.PI;
      n.x = centerX + Math.cos(angle) * 310;
      n.y = centerY + Math.sin(angle) * 310;
      n.vx = 0;
      n.vy = 0;
    });
  };

  // Switch layout
  const handleToggleLayout = (mode) => {
    setLayoutMode(mode);
    if (mode === 'radial') {
      applyRadialLayout();
    }
  };

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      updatePhysics();

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background clearing
      ctx.fillStyle = isDark ? '#090d16' : '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid dots
      const { x: tx, y: ty, scale } = transformRef.current;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);

      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      const gridSize = 40;
      const startX = Math.floor((-tx / scale) / gridSize) * gridSize - gridSize * 2;
      const endX = startX + (width / scale) + gridSize * 4;
      const startY = Math.floor((-ty / scale) / gridSize) * gridSize - gridSize * 2;
      const endY = startY + (height / scale) + gridSize * 4;

      for (let gx = startX; gx < endX; gx += gridSize) {
        for (let gy = startY; gy < endY; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      const nodes = simNodesRef.current;
      const edges = simEdgesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // 1. Draw Edges
      for (const edge of edges) {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;

        const isRelatedToSelected =
          selectedNode &&
          (selectedNode.id === src.id || selectedNode.id === tgt.id);

        const isFiltered =
          (activeCategory !== 'All' &&
            src.category !== activeCategory &&
            tgt.category !== activeCategory) ||
          (searchQuery &&
            !src.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !tgt.label.toLowerCase().includes(searchQuery.toLowerCase()));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (isRelatedToSelected) {
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2.4;
          ctx.setLineDash([]);
        } else if (isFiltered) {
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([]);
        }
        ctx.stroke();

        // Edge Direction Arrow
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 60) {
          const arrowOffset = tgt.radius + 6;
          const arrowX = tgt.x - (dx / dist) * arrowOffset;
          const arrowY = tgt.y - (dy / dist) * arrowOffset;
          const angle = Math.atan2(dy, dx);
          const arrowLen = 8;

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - arrowLen * Math.cos(angle - Math.PI / 7),
            arrowY - arrowLen * Math.sin(angle - Math.PI / 7)
          );
          ctx.lineTo(
            arrowX - arrowLen * Math.cos(angle + Math.PI / 7),
            arrowY - arrowLen * Math.sin(angle + Math.PI / 7)
          );
          ctx.closePath();
          ctx.fillStyle = isRelatedToSelected
            ? '#6366f1'
            : isDark
            ? 'rgba(148, 163, 184, 0.6)'
            : 'rgba(100, 116, 139, 0.7)';
          ctx.fill();
        }

        // Edge Relation Label (drawn if highlighted or zoom scale >= 0.85)
        if (edge.relation && (isRelatedToSelected || scale >= 0.85) && !isFiltered) {
          const midX = (src.x + tgt.x) / 2;
          const midY = (src.y + tgt.y) / 2;
          ctx.font = '500 10px -apple-system, sans-serif';
          const textMetrics = ctx.measureText(edge.relation);
          const padW = 7;
          const padH = 3;

          ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
          ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.roundRect(
            midX - textMetrics.width / 2 - padW,
            midY - 8 - padH,
            textMetrics.width + padW * 2,
            16 + padH,
            4
          );
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.relation, midX, midY);
        }

        ctx.restore();
      }

      // 2. Draw Nodes
      for (const node of nodes) {
        const colors = CATEGORY_COLORS[node.category] || DEFAULT_COLOR;
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;

        const matchesSearch =
          !searchQuery ||
          node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.description?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory =
          activeCategory === 'All' || node.category === activeCategory;

        const isDimmed = !matchesSearch || !matchesCategory;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.25 : 1.0;

        // Glowing selection halo
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, 2 * Math.PI);
          ctx.fillStyle = colors.glow;
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = colors.bg;
        ctx.fill();

        ctx.lineWidth = isSelected ? 3.5 : isHovered ? 2.5 : 1.8;
        ctx.strokeStyle = isSelected ? '#ffffff' : colors.border;
        ctx.stroke();

        // Node Label (inside node or below)
        ctx.font =
          node.importance === 1
            ? 'bold 12px -apple-system, sans-serif'
            : '600 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Draw label with contrasting pill below node
        const labelText = node.label;
        const metrics = ctx.measureText(labelText);
        const labelY = node.y + node.radius + 6;
        const bgWidth = metrics.width + 12;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(node.x - bgWidth / 2, labelY, bgWidth, 18, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
        ctx.fillText(labelText, node.x, labelY + 3);

        // Core / Tier indicator inside node
        if (node.importance === 1) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText('CORE', node.x, node.y);
        } else if (node.page) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '600 9px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(`P.${node.page}`, node.x, node.y);
        }

        ctx.restore();
      }

      ctx.restore(); // Transform restore
      ctx.restore(); // Scale restore

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isDark, selectedNode, hoveredNode, searchQuery, activeCategory, layoutMode, physicsPaused]);

  // Pointer interactions for dragging nodes and panning canvas
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { x: tx, y: ty, scale } = transformRef.current;
    const worldX = (mouseX - tx) / scale;
    const worldY = (mouseY - ty) / scale;

    // Check if clicked on a node
    const nodes = simNodesRef.current;
    let clickedNode = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: mouseX - tx, y: mouseY - ty };
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggedNodeRef.current) {
      const { x: tx, y: ty, scale } = transformRef.current;
      draggedNodeRef.current.x = (mouseX - tx) / scale;
      draggedNodeRef.current.y = (mouseY - ty) / scale;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else if (isDraggingCanvasRef.current) {
      transformRef.current.x = mouseX - dragStartRef.current.x;
      transformRef.current.y = mouseY - dragStartRef.current.y;
    } else {
      // Hover detection
      const { x: tx, y: ty, scale } = transformRef.current;
      const worldX = (mouseX - tx) / scale;
      const worldY = (mouseY - ty) / scale;

      const nodes = simNodesRef.current;
      let found = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        if (dx * dx + dy * dy <= node.radius * node.radius) {
          found = node;
          break;
        }
      }
      setHoveredNode(found);
      canvas.style.cursor = found ? 'pointer' : isDraggingCanvasRef.current ? 'grabbing' : 'grab';
    }
  };

  const handlePointerUp = () => {
    draggedNodeRef.current = null;
    isDraggingCanvasRef.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const currentScale = transformRef.current.scale;
    const newScale = Math.min(Math.max(currentScale * zoomFactor, 0.3), 3.2);

    // Zoom toward pointer
    const { x: tx, y: ty } = transformRef.current;
    transformRef.current = {
      x: mouseX - (mouseX - tx) * (newScale / currentScale),
      y: mouseY - (mouseY - ty) * (newScale / currentScale),
      scale: newScale,
    };
  };

  // Zoom control buttons
  const handleZoom = (direction) => {
    const factor = direction === 'in' ? 1.25 : 0.8;
    const canvas = canvasRef.current;
    const centerX = canvas ? canvas.clientWidth / 2 : 450;
    const centerY = canvas ? canvas.clientHeight / 2 : 300;

    const currentScale = transformRef.current.scale;
    const newScale = Math.min(Math.max(currentScale * factor, 0.3), 3.2);

    transformRef.current = {
      x: centerX - (centerX - transformRef.current.x) * (newScale / currentScale),
      y: centerY - (centerY - transformRef.current.y) * (newScale / currentScale),
      scale: newScale,
    };
  };

  const handleResetView = () => {
    transformRef.current = { x: 0, y: 0, scale: 0.95 };
  };

  // Export Graph to PNG
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${documentInfo?.filename || 'document'}_knowledge_graph.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  // Export Graph to SVG for high-res vector documentation
  const handleExportSvg = () => {
    if (!graphData) return;
    const width = 1200;
    const height = 800;
    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    let svg = `<?xml version="1.0" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#090d16"/>
  <text x="30" y="45" font-family="sans-serif" font-size="22" font-weight="bold" fill="#ffffff">${
    graphData.centralTopic || 'AI Knowledge Graph'
  }</text>
  <text x="30" y="70" font-family="sans-serif" font-size="12" fill="#94a3b8">${
    documentInfo?.filename || ''
  } · Extracted with RAG Concept Graph</text>
  <g id="edges">`;

    for (const e of edges) {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) continue;
      svg += `\n    <line x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}" stroke="#475569" stroke-width="1.5"/>`;
    }

    svg += `\n  </g>\n  <g id="nodes">`;

    for (const n of nodes) {
      const colors = CATEGORY_COLORS[n.category] || DEFAULT_COLOR;
      svg += `\n    <g>
      <circle cx="${n.x}" cy="${n.y}" r="${n.radius}" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2"/>
      <text x="${n.x}" y="${n.y + n.radius + 14}" font-family="sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="#ffffff">${
        n.label
      }</text>
    </g>`;
    }

    svg += `\n  </g>\n</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${documentInfo?.filename || 'document'}_knowledge_graph.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Find relationships for the selected node inspector
  const getSelectedNodeRelations = () => {
    if (!selectedNode || !graphData) return { incoming: [], outgoing: [] };
    const nodeMap = new Map(simNodesRef.current.map((n) => [n.id, n]));

    const outgoing = (graphData.edges || [])
      .filter((e) => e.source === selectedNode.id)
      .map((e) => ({
        relation: e.relation,
        node: nodeMap.get(e.target),
      }))
      .filter((item) => !!item.node);

    const incoming = (graphData.edges || [])
      .filter((e) => e.target === selectedNode.id)
      .map((e) => ({
        relation: e.relation,
        node: nodeMap.get(e.source),
      }))
      .filter((item) => !!item.node);

    return { incoming, outgoing };
  };

  // Navigate to Chat with prefilled query
  const handleAskInChat = (node) => {
    navigate(`/chat/${documentId}`, {
      state: {
        initialQuestion: `Can you explain the concept "${node.label}" in detail and how it relates to this document?`,
      },
    });
  };

  const categories = ['All', 'Architecture', 'Algorithm', 'Component', 'Security', 'Metric', 'Concept'];
  const { incoming, outgoing } = getSelectedNodeRelations();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/chat/${documentId}`)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Back to Document Chat"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Network size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base leading-tight">
                  AI Knowledge Graph & Concept Map
                </h1>
                <span className="hidden md:inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/80">
                  Interactive RAG Graph
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                {documentInfo?.filename || 'Document Analysis'}
              </p>
            </div>
          </div>
        </div>

        {/* Center / Right Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Layout Mode Selector */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => handleToggleLayout('force')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                layoutMode === 'force'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Network View
            </button>
            <button
              onClick={() => handleToggleLayout('radial')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                layoutMode === 'radial'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Radial Mind Map
            </button>
          </div>

          {/* Regenerate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition disabled:opacity-50"
            title="Re-extract concepts and relations using Gemini"
          >
            <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
            <span className="hidden md:inline">
              {generating ? 'Extracting...' : 'Regenerate'}
            </span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportPng}
              disabled={!graphData || generating}
              className="p-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
              title="Download Graph Image (PNG)"
            >
              <Download size={15} />
            </button>
            <button
              onClick={handleExportSvg}
              disabled={!graphData || generating}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
              title="Export Vector SVG for reports & viva"
            >
              SVG
            </button>
          </div>
        </div>
      </header>

      {/* Filter Chips & Search Ribbon */}
      <div className="h-11 border-b border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-4 flex items-center justify-between gap-3 text-xs overflow-x-auto shrink-0 z-10">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          <span className="text-slate-400 font-medium text-[11px] mr-1 hidden sm:inline">
            Category:
          </span>
          {categories.map((cat) => {
            const count =
              cat === 'All'
                ? graphData?.nodes?.length || 0
                : graphData?.nodes?.filter((n) => n.category === cat).length || 0;

            const isActive = activeCategory === cat;
            const catColor = CATEGORY_COLORS[cat];

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {catColor && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: catColor.bg }}
                  />
                )}
                <span>{cat}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Quick Search Input */}
        <div className="relative shrink-0 w-36 sm:w-48">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-6 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Loading / Generating Overlay */}
        {(loading || generating) && (
          <div className="absolute inset-0 z-30 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-200 dark:border-indigo-950 animate-ping opacity-25" />
              <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <Sparkles className="absolute text-indigo-600 dark:text-indigo-400" size={20} />
            </div>
            <div className="text-center max-w-sm px-4">
              <p className="font-semibold text-slate-900 dark:text-white text-sm">
                {generating
                  ? 'AI Extracting Knowledge Graph & Relations...'
                  : 'Loading Conceptual Mind Map...'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Gemini is parsing semantic entities, architecture components, and multi-tier dependencies.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !generating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-3">
              <Info size={24} />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white max-w-md">{error}</p>
            <button
              onClick={handleGenerate}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
            >
              Generate Knowledge Graph
            </button>
          </div>
        )}

        {/* HTML5 Canvas Element */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          className="w-full h-full block touch-none"
        />

        {/* Summary Banner Overlay */}
        {graphData && showSummaryBanner && (
          <div className="absolute top-4 left-4 z-10 max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-lg text-xs animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                  {graphData.centralTopic}
                </h3>
              </div>
              <button
                onClick={() => setShowSummaryBanner(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md"
                title="Hide summary"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              {graphData.summary}
            </p>
            <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>{graphData.nodes?.length || 0} Core Entities</span>
              <span>•</span>
              <span>{graphData.edges?.length || 0} Semantic Relationships</span>
            </div>
          </div>
        )}

        {/* Bottom Floating Canvas Navigation Controls */}
        <div className="absolute bottom-5 left-5 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-md">
          <button
            onClick={() => handleZoom('in')}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Reset View"
          >
            <RotateCcw size={15} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            onClick={() => setPhysicsPaused(!physicsPaused)}
            className={`p-2 rounded-xl transition ${
              physicsPaused
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={physicsPaused ? 'Resume Physics' : 'Freeze Graph Physics'}
          >
            {physicsPaused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>

        {/* Slide-Out Concept Inspector Drawer */}
        {selectedNode && (
          <aside className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800 shadow-2xl z-20 flex flex-col p-5 overflow-y-auto animate-slide-in-right">
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    CATEGORY_COLORS[selectedNode.category]?.pillBg || 'bg-slate-100'
                  } ${
                    CATEGORY_COLORS[selectedNode.category]?.pillText || 'text-slate-800'
                  } ${
                    CATEGORY_COLORS[selectedNode.category]?.pillBorder || 'border-slate-300'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[selectedNode.category]?.bg || '#6366f1',
                    }}
                  />
                  {selectedNode.category}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {selectedNode.label}
                </h2>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Entity Metadata Stats */}
            <div className="grid grid-cols-2 gap-2 my-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Hierarchy Tier
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedNode.importance === 1
                    ? 'Tier 1 (Core)'
                    : selectedNode.importance === 2
                    ? 'Tier 2 (Major)'
                    : 'Tier 3 (Detail)'}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">
                  Citation Page
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                  <BookOpen size={12} className="text-indigo-500" />
                  Page {selectedNode.page || 1}
                </p>
              </div>
            </div>

            {/* Semantic Concept Description */}
            <div className="space-y-1.5 mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Concept Definition & Role
              </h4>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                {selectedNode.description ||
                  'No detailed explanation provided for this entity.'}
              </p>
            </div>

            {/* Connected Concept Relationships */}
            <div className="space-y-3 flex-1 mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Direct Relationships
              </h4>

              {outgoing.length === 0 && incoming.length === 0 && (
                <p className="text-xs text-slate-400 italic">No connected relations found.</p>
              )}

              {/* Outgoing Relations */}
              {outgoing.map((rel, i) => (
                <div
                  key={`out-${i}`}
                  onClick={() => setSelectedNode(rel.node)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer transition text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 rounded-md shrink-0">
                      {rel.relation}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {rel.node.label}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-400 group-hover:text-indigo-500 shrink-0"
                  />
                </div>
              ))}

              {/* Incoming Relations */}
              {incoming.map((rel, i) => (
                <div
                  key={`in-${i}`}
                  onClick={() => setSelectedNode(rel.node)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 cursor-pointer transition text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {rel.node.label}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950 rounded-md shrink-0">
                      {rel.relation}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-400 group-hover:text-purple-500 shrink-0"
                  />
                </div>
              ))}
            </div>

            {/* Bottom Action CTA */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-auto">
              <button
                onClick={() => handleAskInChat(selectedNode)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-500/20 transition"
              >
                <MessageSquare size={14} />
                <span>Ask AI About This Concept in Chat</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
