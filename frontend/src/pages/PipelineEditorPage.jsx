import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { nodeTypes, NODE_STYLES } from '../components/pipeline/PipelineNode';
import { NodeConfigPanel } from '../components/pipeline/NodeConfigPanel';
import { pipelinesApi } from '../lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Plus,
  Sparkles,
  ListOrdered,
  Repeat,
  Layers,
  Variable,
  UserPen,
  Eye,
  Loader2,
  Pencil,
  Undo2,
  Redo2,
  Code,
} from 'lucide-react';

const NODE_TYPE_OPTIONS = [
  { type: 'ai_prompt', label: 'AI Промпт', icon: Sparkles },
  { type: 'parse_list', label: 'Скрипт парсинга', icon: Code },
  { type: 'batch_loop', label: 'Батч-цикл', icon: Repeat },
  { type: 'aggregate', label: 'Агрегация', icon: Layers },
  { type: 'template', label: 'Шаблон / Переменная', icon: Variable },
  { type: 'user_edit_list', label: 'Редактирование списка', icon: UserPen },
  { type: 'user_review', label: 'Просмотр результата', icon: Eye },
];

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
};

function generateNodeId() {
  return 'node_' + Math.random().toString(36).substr(2, 9);
}

// --- Undo/Redo hook ---
function useUndoRedo(nodes, edges, setNodes, setEdges) {
  const historyRef = useRef([]);
  const indexRef = useRef(-1);
  const skipRef = useRef(false);

  const pushState = useCallback(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    // Trim future states
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 50) historyRef.current.shift();
    indexRef.current = historyRef.current.length - 1;
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const state = historyRef.current[indexRef.current];
    skipRef.current = true;
    setNodes(state.nodes);
    skipRef.current = true;
    setEdges(state.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    const state = historyRef.current[indexRef.current];
    skipRef.current = true;
    setNodes(state.nodes);
    skipRef.current = true;
    setEdges(state.edges);
  }, [setNodes, setEdges]);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return { pushState, undo, redo, canUndo, canRedo };
}

export default function PipelineEditorPage() {
  const { pipelineId } = useParams();
  const navigate = useNavigate();
  const isNew = !pipelineId;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(isNew);

  const { pushState, undo, redo, canUndo, canRedo } = useUndoRedo(
    nodes, edges, setNodes, setEdges
  );

  // Save state on meaningful changes (debounced)
  const saveTimerRef = useRef(null);
  const onNodesChangeWrapped = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Save undo state after drag ends
      const hasDragStop = changes.some(
        (c) => c.type === 'position' && c.dragging === false
      );
      if (hasDragStop) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(pushState, 100);
      }
    },
    [onNodesChange, pushState]
  );

  const onEdgesChangeWrapped = useCallback(
    (changes) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === 'remove')) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(pushState, 100);
      }
    },
    [onEdgesChange, pushState]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Load existing pipeline
  useEffect(() => {
    if (!pipelineId) return;
    (async () => {
      try {
        const res = await pipelinesApi.get(pipelineId);
        const pipeline = res.data;
        setPipelineName(pipeline.name);
        setPipelineDescription(pipeline.description || '');
        setIsPublic(pipeline.is_public);

        const loadedNodes = pipeline.nodes.map((n) => ({
          id: n.node_id,
          type: 'pipelineNode',
          position: { x: n.position_x || 0, y: n.position_y || 0 },
          data: { ...n },
        }));
        const loadedEdges = pipeline.edges.map((e, i) => ({
          id: `e-${e.source}-${e.target}-${i}`,
          source: e.source,
          target: e.target,
          sourceHandle: e.source_handle || null,
          targetHandle: e.target_handle || null,
          ...defaultEdgeOptions,
        }));

        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } catch (err) {
        toast.error('Ошибка загрузки сценария');
        navigate('/pipelines');
      } finally {
        setLoading(false);
      }
    })();
  }, [pipelineId, navigate, setNodes, setEdges]);

  // Save initial state for undo after load
  const initialSaved = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !initialSaved.current) {
      pushState();
      initialSaved.current = true;
    }
  }, [nodes, pushState]);

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...defaultEdgeOptions,
          },
          eds
        )
      );
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === params.target) {
            const currentInputs = n.data.input_from || [];
            if (!currentInputs.includes(params.source)) {
              return {
                ...n,
                data: { ...n.data, input_from: [...currentInputs, params.source] },
              };
            }
          }
          return n;
        })
      );
      setTimeout(pushState, 50);
    },
    [setEdges, setNodes, pushState]
  );

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = useCallback(
    (nodeType) => {
      const nodeId = generateNodeId();
      const style = NODE_STYLES[nodeType];
      const newNode = {
        id: nodeId,
        type: 'pipelineNode',
        position: { x: (nodes.length % 4) * 280 + 50, y: Math.floor(nodes.length / 4) * 140 + 50 },
        data: {
          node_id: nodeId,
          node_type: nodeType,
          label: style?.label || 'Новый узел',
          inline_prompt: nodeType === 'ai_prompt' ? '' : null,
          system_message: nodeType === 'ai_prompt' ? '' : null,
          reasoning_effort: nodeType === 'ai_prompt' ? 'high' : null,
          batch_size: nodeType === 'batch_loop' ? 3 : null,
          template_text: nodeType === 'template' ? '' : null,
          script: nodeType === 'parse_list' ? null : null,
          input_from: [],
          position_x: (nodes.length % 4) * 280 + 50,
          position_y: Math.floor(nodes.length / 4) * 140 + 50,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setTimeout(pushState, 50);
    },
    [nodes, setNodes, pushState]
  );

  const updateNodeData = useCallback(
    (nodeId, newData) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data: newData } : prev
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
      setTimeout(pushState, 50);
    },
    [setNodes, setEdges, pushState]
  );

  const handleSave = async () => {
    if (!pipelineName.trim()) {
      setEditMetaOpen(true);
      toast.error('Введите название сценария');
      return;
    }
    if (nodes.length === 0) {
      toast.error('Добавьте хотя бы один узел');
      return;
    }

    setSaving(true);
    try {
      const pipelineNodes = nodes.map((n) => ({
        node_id: n.id,
        node_type: n.data.node_type,
        label: n.data.label,
        prompt_id: n.data.prompt_id || null,
        inline_prompt: n.data.inline_prompt || null,
        system_message: n.data.system_message || null,
        reasoning_effort: n.data.reasoning_effort || null,
        batch_size: n.data.batch_size || null,
        template_text: n.data.template_text || null,
        input_from: n.data.input_from || null,
        position_x: n.position.x,
        position_y: n.position.y,
      }));

      const pipelineEdges = edges.map((e) => ({
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle || null,
        target_handle: e.targetHandle || null,
      }));

      const payload = {
        name: pipelineName,
        description: pipelineDescription,
        nodes: pipelineNodes,
        edges: pipelineEdges,
        is_public: isPublic,
      };

      if (pipelineId) {
        await pipelinesApi.update(pipelineId, payload);
        toast.success('Сценарий сохранён');
      } else {
        const res = await pipelinesApi.create(payload);
        toast.success('Сценарий создан');
        navigate(`/pipelines/${res.data.id}`, { replace: true });
      }
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/pipelines">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="back-to-pipelines">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <button
            onClick={() => setEditMetaOpen(true)}
            className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
            data-testid="edit-pipeline-name"
          >
            <span className="font-semibold text-lg">
              {pipelineName || 'Новый сценарий'}
            </span>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo / Redo */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
            title="Отменить (Ctrl+Z)"
            data-testid="undo-btn"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
            title="Повторить (Ctrl+Y)"
            data-testid="redo-btn"
          >
            <Redo2 className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          {/* Add Node */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="add-node-btn">
                <Plus className="w-4 h-4" />
                Добавить узел
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {NODE_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <DropdownMenuItem
                    key={opt.type}
                    onClick={() => addNode(opt.type)}
                    className="gap-2"
                    data-testid={`add-node-${opt.type}`}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save */}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-pipeline-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Сохранить
          </Button>
        </div>
      </header>

      {/* Canvas + Config Panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeWrapped}
            onEdgesChange={onEdgesChangeWrapped}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode={['Backspace', 'Delete']}
            connectionMode="loose"
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls position="bottom-left" />
            <MiniMap
              nodeColor={(n) => {
                const type = n.data?.node_type;
                const colors = {
                  ai_prompt: '#c4b5fd',
                  parse_list: '#7dd3fc',
                  batch_loop: '#fcd34d',
                  aggregate: '#6ee7b7',
                  template: '#cbd5e1',
                  user_edit_list: '#f9a8d4',
                  user_review: '#5eead4',
                };
                return colors[type] || '#cbd5e1';
              }}
              position="bottom-right"
              style={{ height: 100, width: 150 }}
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            allNodes={nodes}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* Edit Name/Description Dialog */}
      <Dialog open={editMetaOpen} onOpenChange={setEditMetaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Новый сценарий анализа' : 'Настройки сценария'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Название *</label>
              <Input
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="Например: Стандартный анализ встречи"
                data-testid="pipeline-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Описание</label>
              <Textarea
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                placeholder="Краткое описание сценария..."
                rows={3}
                data-testid="pipeline-description-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is-public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="is-public" className="text-sm">
                Общедоступный сценарий
              </label>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setEditMetaOpen(false)} data-testid="confirm-meta-btn">
                {isNew ? 'Создать' : 'Готово'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
