'use client';

import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  MarkerType,
  Position,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import type { EndingCondition, GameEnding } from '@citygame/shared';

export interface FlowDiagramTaskNode {
  id: string;
  label: string;
  index: number;
  type: string;
}

export interface FlowDiagramEndingNode {
  id: string;
  slug: string;
  title: string;
  isDefault: boolean;
  condition: EndingCondition | GameEnding['condition'];
}

interface FlowDiagramTransition {
  fromTaskId: string | null;
  toTaskId: string;
  label?: string | null;
}

interface GameFlowDiagramProps {
  tasks: FlowDiagramTaskNode[];
  transitions: FlowDiagramTransition[];
  endings: FlowDiagramEndingNode[];
  height?: number;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 76;
const START_NODE_ID = '__start__';

/**
 * Visualises a game's flow: tasks as primary nodes, endings as terminal
 * "sink" nodes synthesised from each ending's `condition`. Auto-laid out
 * left-to-right with dagre, then admins may drag individual nodes for a
 * cleaner picture (positions are session-local; the underlying transitions
 * stay read-only and editing still happens on step 3).
 */
export function GameFlowDiagram({
  tasks,
  transitions,
  endings,
  height = 480,
}: GameFlowDiagramProps) {
  const layout = useMemo(
    () => buildLayout(tasks, transitions, endings),
    [tasks, transitions, endings],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  // Re-seed positions whenever the source blueprint changes (e.g. user goes
  // back to step 3 and edits tasks). Drag-induced positions are intentionally
  // discarded then because the auto-layout reflects the new graph.
  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  return (
    <div
      className="w-full rounded-xl border border-gray-200 bg-white overflow-hidden"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function buildLayout(
  tasks: FlowDiagramTaskNode[],
  transitions: FlowDiagramTransition[],
  endings: FlowDiagramEndingNode[],
): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 80 });

  const hasStartTransitions = transitions.some((t) => t.fromTaskId === null);
  if (hasStartTransitions) {
    graph.setNode(START_NODE_ID, { width: 80, height: 40 });
  }

  for (const t of tasks) {
    graph.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of endings) {
    graph.setNode(e.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const tr of transitions) {
    const source = tr.fromTaskId ?? START_NODE_ID;
    if (!graph.hasNode(source)) graph.setNode(source, { width: 80, height: 40 });
    graph.setEdge(source, tr.toTaskId);
  }

  // Tasks that have no outgoing real transition — these are the natural
  // path endpoints. An ending semantically fires AFTER such a leaf task
  // completes, so wiring synth edges from leaves only (instead of from every
  // task in an ALL_OF list) keeps the diagram readable: one or two arrows
  // per ending instead of N.
  const sourceTaskIds = new Set(
    transitions
      .map((t) => t.fromTaskId)
      .filter((id): id is string => typeof id === 'string'),
  );
  const taskIds = new Set(tasks.map((t) => t.id));
  const leafTaskIds = new Set(
    tasks.filter((t) => !sourceTaskIds.has(t.id)).map((t) => t.id),
  );
  const pickEdgeSources = (
    candidateIds: string[] | null,
  ): string[] => {
    const candidates = candidateIds
      ? candidateIds.filter((id) => taskIds.has(id))
      : [...taskIds];
    if (candidates.length === 0) return [];
    const leaves = candidates.filter((id) => leafTaskIds.has(id));
    if (leaves.length > 0) return leaves;
    // No leaf in the candidate set — fall back to the highest-orderIndex task
    // among the candidates so we still draw exactly one edge.
    const orderById = new Map(tasks.map((t, i) => [t.id, i]));
    return [
      candidates.reduce((best, id) =>
        (orderById.get(id) ?? -1) > (orderById.get(best) ?? -1) ? id : best,
      ),
    ];
  };

  const virtualEdges: Array<{ source: string; target: string; label?: string }> = [];
  for (const ending of endings) {
    const cond = ending.condition as EndingCondition;
    let sources: string[] = [];
    let label: string | undefined;
    if (cond.type === 'ALL_OF' || cond.type === 'ANY_OF') {
      sources = pickEdgeSources(cond.taskIds);
      label = cond.type;
    } else if (cond.type === 'DEFAULT') {
      const lastTask = tasks[tasks.length - 1];
      if (lastTask) sources = [lastTask.id];
      label = 'default';
    } else if (cond.type === 'SCORE_GTE') {
      sources = pickEdgeSources(null);
      label = `≥${cond.minScore} pkt`;
    } else if (cond.type === 'ITEM_COLLECTED') {
      sources = pickEdgeSources(null);
      label = `+${cond.slug}`;
    } else if (cond.type === 'TIMEOUT') {
      sources = [START_NODE_ID];
      label = 'timeout';
    }
    for (const source of sources) {
      virtualEdges.push({ source, target: ending.id, label });
      graph.setEdge(source, ending.id);
    }
  }

  dagre.layout(graph);

  const nodes: Node[] = [];
  if (hasStartTransitions || virtualEdges.some((e) => e.source === START_NODE_ID)) {
    if (graph.hasNode(START_NODE_ID)) {
      const pos = graph.node(START_NODE_ID);
      nodes.push({
        id: START_NODE_ID,
        position: { x: pos.x - 40, y: pos.y - 20 },
        data: { label: 'Start' },
        style: {
          background: '#111827',
          color: '#fff',
          padding: 6,
          borderRadius: 999,
          fontSize: 12,
          width: 80,
          textAlign: 'center',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    }
  }

  for (const t of tasks) {
    const pos = graph.node(t.id);
    nodes.push({
      id: t.id,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: (
          <div className="flex flex-col gap-0.5 text-left px-1">
            <span className="text-[11px] uppercase tracking-wider text-[#FF6B35]">
              #{t.index} · {t.type}
            </span>
            <span className="text-sm font-semibold text-gray-900 leading-tight">
              {t.label}
            </span>
          </div>
        ),
      },
      style: {
        background: '#fff',
        border: '1px solid #FFBD9A',
        borderRadius: 12,
        padding: 8,
        width: NODE_WIDTH,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  }

  for (const e of endings) {
    const pos = graph.node(e.id);
    nodes.push({
      id: e.id,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: (
          <div className="flex flex-col gap-0.5 text-left px-1">
            <span className="text-[11px] uppercase tracking-wider text-emerald-600">
              {e.isDefault ? 'Domyślne' : 'Zakończenie'}
            </span>
            <span className="text-sm font-semibold text-gray-900 leading-tight">
              {e.title}
            </span>
          </div>
        ),
      },
      style: {
        background: e.isDefault ? '#ECFDF5' : '#F0F9FF',
        border: e.isDefault ? '1px solid #6EE7B7' : '1px solid #BAE6FD',
        borderRadius: 12,
        padding: 8,
        width: NODE_WIDTH,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  }

  const edges: Edge[] = [
    ...transitions.map((tr, i) => ({
      id: `t-${i}`,
      source: tr.fromTaskId ?? START_NODE_ID,
      target: tr.toTaskId,
      label: tr.label ?? undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#FF6B35' },
      style: { stroke: '#FF6B35', strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: '#6B7280' },
    })),
    ...virtualEdges.map((ve, i) => ({
      id: `v-${i}`,
      source: ve.source,
      target: ve.target,
      label: ve.label,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10B981' },
      style: {
        stroke: '#10B981',
        strokeWidth: 1.5,
        strokeDasharray: '4 4',
      },
      labelStyle: { fontSize: 10, fill: '#10B981' },
    })),
  ];

  return { nodes, edges };
}
