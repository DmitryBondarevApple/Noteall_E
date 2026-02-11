import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
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
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { nodeTypes, NODE_STYLES } from '../components/pipeline/PipelineNode';
import { NodeConfigPanel } from '../components/pipeline/NodeConfigPanel';
import { PipelineStepPreview } from '../components/pipeline/PipelineStepPreview';
import { pipelinesApi } from '../lib/api';
import { toast } from 'sonner';
import AiChatPanel from '../components/pipeline/AiChatPanel';
import {
  ArrowLeft,
  Save,
  Plus,
  Sparkles,
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
  Play,
  PenTool,
  Trash2,
  Download,
  Bot,
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

// Detect edge type by handle IDs — any handle with "data" in the name = data edge
function getEdgeType(sourceHandle, targetHandle) {
  const sh = sourceHandle || '';
  const th = targetHandle || '';
  if (sh.includes('data') || th.includes('data')) return 'data';
  return 'flow';
}

function makeEdgeStyle(edgeType) {
  if (edgeType === 'data') {
    return {
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#f97316', strokeWidth: 2, strokeDasharray: '6 3' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316', width: 16, height: 16 },
    };
  }
  return {
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
  };
}

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
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('from');
  const isNew = !pipelineId;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(isNew);
  const [mode, setMode] = useState('editor'); // 'editor' | 'preview'
  const [pipeline, setPipeline] = useState(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const { pushState, undo, redo, canUndo, canRedo } = useUndoRedo(
    nodes, edges, setNodes, setEdges
  );

  const saveTimerRef = useRef(null);
  const onNodesChangeWrapped = useCallback(
    (changes) => {
      onNodesChange(changes);
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
      // When removing a data edge, also clean up input_from
      const removedEdges = changes
        .filter((c) => c.type === 'remove')
        .map((c) => edges.find((e) => e.id === c.id))
        .filter(Boolean);

      onEdgesChange(changes);

      if (removedEdges.length > 0) {
        setNodes((nds) =>
          nds.map((n) => {
            const removedDataSources = removedEdges
              .filter((e) => e.target === n.id && e.data?.edgeType === 'data')
              .map((e) => e.source);
            if (removedDataSources.length > 0) {
              const currentInputs = n.data.input_from || [];
              return {
                ...n,
                data: {
                  ...n.data,
                  input_from: currentInputs.filter((id) => !removedDataSources.includes(id)),
                },
              };
            }
            return n;
          })
        );
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(pushState, 100);
      }
    },
    [onEdgesChange, edges, setNodes, pushState]
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
        const pipelineData = res.data;
        setPipeline(pipelineData);
        setPipelineName(pipelineData.name);
        setPipelineDescription(pipelineData.description || '');
        setIsPublic(pipelineData.is_public);

        const loadedNodes = pipelineData.nodes.map((n) => ({
          id: n.node_id,
          type: 'pipelineNode',
          position: { x: n.position_x || 0, y: n.position_y || 0 },
          data: { ...n },
        }));

        const loadedEdges = pipelineData.edges.map((e, i) => {
          const edgeType = getEdgeType(e.source_handle, e.target_handle);
          return {
            id: `e-${e.source}-${e.target}-${i}`,
            source: e.source,
            target: e.target,
            sourceHandle: e.source_handle || null,
            targetHandle: e.target_handle || null,
            data: { edgeType },
            ...makeEdgeStyle(edgeType),
          };
        });

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

  // Save initial state for undo
  const initialSaved = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !initialSaved.current) {
      pushState();
      initialSaved.current = true;
    }
  }, [nodes, pushState]);

  const onConnect = useCallback(
    (params) => {
      const edgeType = getEdgeType(params.sourceHandle, params.targetHandle);
      const edgeStyle = makeEdgeStyle(edgeType);

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            ...edgeStyle,
            data: { edgeType },
          },
          eds
        )
      );

      // If it's a data edge, update input_from on the target node
      if (edgeType === 'data') {
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
      }

      setTimeout(pushState, 50);
    },
    [setEdges, setNodes, pushState]
  );

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    setSelectedEdgeId(edge.id);
    setSelectedNode(null);
  }, []);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    onEdgesChangeWrapped([{ type: 'remove', id: selectedEdgeId }]);
    setSelectedEdgeId(null);
    pushState();
  }, [selectedEdgeId, onEdgesChangeWrapped, pushState]);

  const onReconnect = useCallback(
    (oldEdge, newConnection) => {
      // Remove old edge, add new one
      const edgeType = getEdgeType(newConnection.sourceHandle, newConnection.targetHandle);
      const newEdgeStyle = makeEdgeStyle(edgeType);

      setEdges((eds) => {
        const filtered = eds.filter((e) => e.id !== oldEdge.id);
        const newEdge = {
          ...newConnection,
          id: `e-${newConnection.source}-${newConnection.target}-${Date.now()}`,
          ...newEdgeStyle,
          data: { edgeType },
        };
        return [...filtered, newEdge];
      });

      // Update input_from if data edges changed
      if (oldEdge.data?.edgeType === 'data') {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === oldEdge.target) {
              return {
                ...n,
                data: {
                  ...n.data,
                  input_from: (n.data.input_from || []).filter((id) => id !== oldEdge.source),
                },
              };
            }
            return n;
          })
        );
      }
      if (getEdgeType(newConnection.sourceHandle, newConnection.targetHandle) === 'data') {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === newConnection.target) {
              const currentInputs = n.data.input_from || [];
              if (!currentInputs.includes(newConnection.source)) {
                return {
                  ...n,
                  data: { ...n.data, input_from: [...currentInputs, newConnection.source] },
                };
              }
            }
            return n;
          })
        );
      }

      pushState();
    },
    [setEdges, setNodes, pushState]
  );

  // Delete selected edge on Delete/Backspace key
  useEffect(() => {
    const handler = (e) => {
      if (!selectedEdgeId) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedEdge();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedEdgeId, deleteSelectedEdge]);

  const addNode = useCallback(
    (nodeType) => {
      const nodeId = generateNodeId();
      const style = NODE_STYLES[nodeType];
      const newNode = {
        id: nodeId,
        type: 'pipelineNode',
        position: { x: (nodes.length % 4) * 280 + 50, y: Math.floor(nodes.length / 4) * 160 + 50 },
        data: {
          node_id: nodeId,
          node_type: nodeType,
          label: style?.label || 'Новый узел',
          inline_prompt: nodeType === 'ai_prompt' ? '' : null,
          system_message: nodeType === 'ai_prompt' ? '' : null,
          reasoning_effort: nodeType === 'ai_prompt' ? 'high' : null,
          batch_size: nodeType === 'batch_loop' ? 3 : null,
          template_text: nodeType === 'template' ? '' : null,
          script: null,
          input_from: [],
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

  const handlePipelineFromChat = useCallback((pipelineData) => {
    if (!pipelineData || !pipelineData.nodes) return;
    const loadedNodes = pipelineData.nodes.map((n) => ({
      id: n.node_id,
      type: 'pipelineNode',
      position: { x: n.position_x || 0, y: n.position_y || 0 },
      data: { ...n },
    }));
    const loadedEdges = (pipelineData.edges || []).map((e, i) => ({
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.source_handle || null,
      targetHandle: e.target_handle || null,
      data: { edgeType: getEdgeType(e.source_handle, e.target_handle) },
      ...makeEdgeStyle(getEdgeType(e.source_handle, e.target_handle)),
    }));
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    if (pipelineData.name) setPipelineName(pipelineData.name);
    if (pipelineData.description) setPipelineDescription(pipelineData.description);
    toast.success('Сценарий обновлён через AI');
  }, [setNodes, setEdges]);

  // Build pipeline context for AI chat
  const pipelineContext = useMemo(() => {
    if (nodes.length === 0) return null;
    return {
      name: pipelineName,
      description: pipelineDescription,
      nodes: nodes.map((n) => ({
        node_id: n.id,
        node_type: n.data.node_type,
        label: n.data.label,
        inline_prompt: n.data.inline_prompt || null,
        system_message: n.data.system_message || null,
        batch_size: n.data.batch_size || null,
        template_text: n.data.template_text || null,
        script: n.data.script || null,
        input_from: n.data.input_from || null,
        position_x: Math.round(n.position.x),
        position_y: Math.round(n.position.y),
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [nodes, edges, pipelineName, pipelineDescription]);

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
        script: n.data.script || null,
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
    <AppLayout>
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
          {/* Mode Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setMode('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'editor' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
              data-testid="mode-editor"
            >
              <PenTool className="w-3.5 h-3.5" />
              Редактор
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'preview' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
              data-testid="mode-preview"
            >
              <Play className="w-3.5 h-3.5" />
              Предпросмотр
            </button>
          </div>

          {mode === 'editor' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo} title="Ctrl+Z" data-testid="undo-btn">
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo} title="Ctrl+Y" data-testid="redo-btn">
                <Redo2 className="w-4 h-4" />
              </Button>

              <div className="w-px h-6 bg-slate-200 mx-1" />

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
            </>
          )}

          {pipelineId !== 'new' && (
            <Button
              size="sm"
              variant={aiChatOpen ? 'default' : 'outline'}
              className="gap-1.5"
              data-testid="ai-edit-btn"
              onClick={() => setAiChatOpen(!aiChatOpen)}
            >
              <Bot className="w-4 h-4" />
              AI-ассистент
            </Button>
          )}

          {pipelineId !== 'new' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              data-testid="export-pipeline-btn"
              onClick={async () => {
                try {
                  const res = await pipelinesApi.export(pipelineId);
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${(pipeline?.name || 'scenario').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Сценарий экспортирован');
                } catch (err) {
                  toast.error('Ошибка экспорта');
                }
              }}
            >
              <Download className="w-4 h-4" />
              Экспорт
            </Button>
          )}

          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving} data-testid="save-pipeline-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
        </div>
      </header>

      {/* Canvas (Editor) or Step Preview */}
      <div className="flex-1 flex overflow-hidden">
        {mode === 'editor' ? (
          <>
            <div className="flex-1 relative">
              <ReactFlow
                nodes={nodes}
                edges={edges.map((e) => ({
                  ...e,
                  selected: e.id === selectedEdgeId,
                  style: e.id === selectedEdgeId
                    ? { ...e.style, stroke: '#ef4444', strokeWidth: 3 }
                    : e.style,
                }))}
                onNodesChange={onNodesChangeWrapped}
                onEdgesChange={onEdgesChangeWrapped}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                onReconnect={onReconnect}
                nodeTypes={nodeTypes}
                edgesReconnectable
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
                      ai_prompt: '#c4b5fd', parse_list: '#7dd3fc', batch_loop: '#fcd34d',
                      aggregate: '#6ee7b7', template: '#cbd5e1', user_edit_list: '#f9a8d4', user_review: '#5eead4',
                    };
                    return colors[type] || '#cbd5e1';
                  }}
                  position="bottom-right"
                  style={{ height: 100, width: 150 }}
                />
              </ReactFlow>

              {/* Legend */}
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-[11px] space-y-1.5 z-10 pointer-events-none" data-testid="edge-legend">
                <div className="flex items-center gap-2">
                  <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="#94a3b8" strokeWidth="2" /><polygon points="28,2 32,5 28,8" fill="#94a3b8" /></svg>
                  <span className="text-slate-600">Порядок выполнения</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="#f97316" strokeWidth="2" strokeDasharray="4 2" /><polygon points="28,2 32,5 28,8" fill="#f97316" /></svg>
                  <span className="text-orange-600">Источник данных</span>
                </div>
              </div>

              {/* Selected edge actions */}
              {selectedEdgeId && (
                <div
                  className="absolute top-3 right-3 bg-white border border-red-200 rounded-lg shadow-lg px-3 py-2 z-20 flex items-center gap-2"
                  data-testid="edge-actions-panel"
                >
                  <span className="text-xs text-muted-foreground">Стрелка выбрана</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 gap-1.5 text-xs"
                    onClick={deleteSelectedEdge}
                    data-testid="delete-edge-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    или перетащите конец для переподключения
                  </span>
                </div>
              )}
            </div>

            {selectedNode && (
              <NodeConfigPanel
                node={selectedNode}
                allNodes={nodes}
                edges={edges}
                onUpdate={updateNodeData}
                onDelete={deleteNode}
                onClose={() => setSelectedNode(null)}
              />
            )}

            {aiChatOpen && (
              <AiChatPanel
                open={aiChatOpen}
                onClose={() => setAiChatOpen(false)}
                pipelineId={pipelineId}
                onPipelineGenerated={handlePipelineFromChat}
                pipelineContext={pipelineContext}
              />
            )}
          </>
        ) : (
          <PipelineStepPreview nodes={nodes} edges={edges} />
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
    </AppLayout>
  );
}
