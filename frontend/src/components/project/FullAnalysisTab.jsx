import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import {
  Sparkles,
  Play,
  Pause,
  Check,
  ChevronRight,
  ChevronLeft,
  List,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Copy,
  Download,
  Save,
  RotateCcw,
  FileType,
  File,
  Workflow,
  Code,
  Repeat,
  Layers,
  Variable,
  UserPen,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { chatApi, exportApi, pipelinesApi } from '../../lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

// ==================== PIPELINE ENGINE UTILITIES ====================

const STEP_ICONS = {
  ai_prompt: Sparkles,
  parse_list: Code,
  batch_loop: Repeat,
  aggregate: Layers,
  template: Variable,
  user_edit_list: UserPen,
  user_review: Eye,
};

// Topological sort via flow edges (reused from PipelineStepPreview)
function resolveExecutionOrder(nodes, edges) {
  const flowEdges = edges.filter(
    (e) => !e.data?.edgeType || e.data.edgeType === 'flow'
  );
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map(nodes.map((n) => [n.id, []]));

  for (const e of flowEdges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }

  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    for (const next of adj.get(current) || []) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  return sorted.map((id) => nodeMap.get(id)).filter(Boolean);
}

// Build data dependency map: nodeId -> [sourceNodeIds]
// Uses both edge types AND input_from field on nodes
function buildDataDeps(nodes, edges) {
  const deps = {};
  // From edges with data type
  for (const e of edges) {
    if (e.data?.edgeType === 'data') {
      if (!deps[e.target]) deps[e.target] = [];
      if (!deps[e.target].includes(e.source)) deps[e.target].push(e.source);
    }
  }
  // From input_from field on nodes
  for (const node of nodes) {
    const inputFrom = node.data.input_from;
    if (inputFrom && inputFrom.length > 0) {
      if (!deps[node.id]) deps[node.id] = [];
      for (const src of inputFrom) {
        if (!deps[node.id].includes(src)) deps[node.id].push(src);
      }
    }
  }
  return deps;
}

// Build wizard stages: group auto-nodes together, interactive/pause_after nodes start new visible stages
function buildWizardStages(orderedNodes) {
  const stages = [];
  let autoBuffer = [];

  for (const node of orderedNodes) {
    const type = node.data.node_type;
    const isInteractive = ['template', 'user_edit_list', 'user_review'].includes(type);
    const pauseAfter = !!node.data.pause_after;

    if (isInteractive) {
      // Interactive node = new visible stage (with any preceding auto nodes)
      stages.push({
        id: node.id,
        label: node.data.step_title || node.data.label,
        type: type,
        icon: STEP_ICONS[type] || Variable,
        primaryNode: node,
        autoNodesBefore: [...autoBuffer],
        autoNodesAfter: [],
        isInteractive: true,
      });
      autoBuffer = [];
    } else if (pauseAfter) {
      // Auto node with pause_after = new visible stage to show results
      stages.push({
        id: node.id,
        label: node.data.step_title || node.data.label,
        type: type,
        icon: STEP_ICONS[type] || Variable,
        primaryNode: node,
        autoNodesBefore: [...autoBuffer],
        autoNodesAfter: [],
        isInteractive: false,
        isPauseStage: true,
      });
      autoBuffer = [];
    } else {
      // Pure auto node — buffer it
      autoBuffer.push(node);
    }
  }

  // If there are trailing auto nodes with no stage after, attach to last stage
  if (autoBuffer.length > 0 && stages.length > 0) {
    stages[stages.length - 1].autoNodesAfter = autoBuffer;
  } else if (autoBuffer.length > 0) {
    // All nodes are auto — create one synthetic stage
    stages.push({
      id: autoBuffer[0].id,
      label: autoBuffer[0].data.step_title || 'Обработка',
      type: autoBuffer[0].data.node_type,
      icon: STEP_ICONS[autoBuffer[0].data.node_type] || Variable,
      primaryNode: autoBuffer[0],
      autoNodesBefore: autoBuffer.slice(1),
      autoNodesAfter: [],
      isInteractive: false,
      isPauseStage: true,
    });
  }

  return stages;
}

// Execute a script node (parse_list, aggregate, batch_loop, template, ai_prompt prep)
function executeScript(node, context) {
  const scriptText = node.data.script;
  if (!scriptText) return { output: context.input };

  try {
    // Extract the function body — look for function run(context) { ... }
    const fnMatch = scriptText.match(/function\s+run\s*\([\w]*\)\s*\{([\s\S]*)\}$/);
    if (fnMatch) {
      const fn = new Function('context', fnMatch[1]);
      return fn(context);
    }
    // Fallback: try executing directly
    const fn = new Function('context', scriptText);
    return fn(context);
  } catch (err) {
    console.error('Script execution error:', err);
    return { output: context.input, error: err.message };
  }
}

// ==================== MAIN COMPONENT ====================

export function FullAnalysisTab({ projectId, processedTranscript, onSaveResult }) {
  // Pipeline selection
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loadingPipelines, setLoadingPipelines] = useState(true);
  const [pipelineData, setPipelineData] = useState(null);

  // Wizard state
  const [currentStageIdx, setCurrentStageIdx] = useState(-1); // -1 = setup screen
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const pausedRef = useRef(false);

  // Execution context: nodeId -> output
  const [nodeOutputs, setNodeOutputs] = useState({});
  // For batch_loop: track iteration state
  const [batchState, setBatchState] = useState(null);
  const [batchProgress, setBatchProgress] = useState(0);

  // User inputs for template nodes
  const [templateInputs, setTemplateInputs] = useState({});
  // User editable list for user_edit_list nodes
  const [editableList, setEditableList] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [newItemText, setNewItemText] = useState('');
  // Final document for user_review
  const [reviewContent, setReviewContent] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Pause-stage result display
  const [pauseResult, setPauseResult] = useState('');
  
  // Track if wizard has meaningful results (to warn on reset)
  const hasResults = currentStageIdx > 0 || reviewContent.length > 0;

  // Computed pipeline structure
  const [stages, setStages] = useState([]);
  const [dataDeps, setDataDeps] = useState({});
  const [orderedNodes, setOrderedNodes] = useState([]);

  // Load pipelines list
  useEffect(() => {
    (async () => {
      try {
        const res = await pipelinesApi.list();
        setPipelines(res.data);
        if (res.data.length > 0) {
          setSelectedPipelineId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load pipelines:', err);
      } finally {
        setLoadingPipelines(false);
      }
    })();
  }, []);

  // Load full pipeline data when selection changes
  useEffect(() => {
    if (!selectedPipelineId) return;
    (async () => {
      try {
        const res = await pipelinesApi.get(selectedPipelineId);
        const pl = res.data;
        // Convert to internal node format
        const nodes = pl.nodes.map((n) => ({
          id: n.node_id,
          data: { ...n },
        }));
        const edges = pl.edges.map((e, i) => {
          const sh = e.source_handle || '';
          const th = e.target_handle || '';
          const edgeType = (sh.includes('data') || th.includes('data')) ? 'data' : 'flow';
          return { source: e.source, target: e.target, data: { edgeType } };
        });
        setPipelineData({ ...pl, _nodes: nodes, _edges: edges });

        const ordered = resolveExecutionOrder(nodes, edges);
        setOrderedNodes(ordered);
        setStages(buildWizardStages(ordered));
        setDataDeps(buildDataDeps(nodes, edges));
      } catch (err) {
        console.error('Failed to load pipeline:', err);
      }
    })();
  }, [selectedPipelineId]);

  // Reset everything
  const resetWizard = useCallback(() => {
    setCurrentStageIdx(-1);
    setIsProcessing(false);
    setProcessingLabel('');
    setIsPaused(false);
    pausedRef.current = false;
    setNodeOutputs({});
    setBatchState(null);
    setBatchProgress(0);
    setTemplateInputs({});
    setEditableList([]);
    setEditingIndex(null);
    setNewItemText('');
    setReviewContent('');
    setIsEditingReview(false);
    setPauseResult('');
    nodesConsumedByLoop.current = new Set();  }, []);

  // Get data for a node from its data dependencies
  const getNodeInput = useCallback((nodeId, outputs) => {
    const deps = dataDeps[nodeId] || [];
    if (deps.length === 0) return null;
    if (deps.length === 1) return outputs[deps[0]] || null;
    // Multiple sources: return as object
    const result = {};
    for (const depId of deps) {
      result[depId] = outputs[depId] || null;
    }
    return result;
  }, [dataDeps]);

  // Execute a single auto node
  const executeNode = useCallback(async (node, currentOutputs) => {
    const type = node.data.node_type;
    const input = getNodeInput(node.id, currentOutputs);

    if (type === 'ai_prompt') {
      // Build prompt with variable substitution
      let prompt = node.data.inline_prompt || '';
      const systemMsg = node.data.system_message || 'Ты — ассистент для анализа встреч.';

      // Run prep script if exists
      if (node.data.script) {
        const scriptResult = executeScript(node, {
          input,
          prompt,
          vars: currentOutputs,
        });
        if (scriptResult.promptVars) {
          for (const [key, value] of Object.entries(scriptResult.promptVars)) {
            prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          }
        }
      }

      // Also substitute any remaining {{var}} from outputs
      const varMatches = prompt.match(/\{\{(\w+)\}\}/g) || [];
      for (const m of varMatches) {
        const varName = m.replace(/[{}]/g, '');
        if (currentOutputs[varName] !== undefined) {
          prompt = prompt.replace(m, String(currentOutputs[varName]));
        }
      }

      // If input is a string and prompt has {{input}}, substitute it
      if (typeof input === 'string') {
        prompt = prompt.replace(/\{\{input\}\}/g, input);
      }

      const response = await chatApi.analyzeRaw(projectId, {
        system_message: systemMsg,
        user_message: prompt,
        reasoning_effort: node.data.reasoning_effort || 'high',
      });
      return response.data.response_text;
    }

    if (type === 'parse_list' || type === 'aggregate' || type === 'template') {
      const result = executeScript(node, {
        input,
        vars: currentOutputs,
      });
      return result.output;
    }

    // batch_loop is handled specially in runStageAutoNodes
    return input;
  }, [projectId, getNodeInput]);

  // Run all auto nodes for a stage (before/after primary node)
  // nodesConsumedByLoop tracks AI nodes handled inside batch_loop
  const nodesConsumedByLoop = useRef(new Set());

  const runAutoNodes = useCallback(async (nodes, currentOutputs) => {
    let outputs = { ...currentOutputs };
    for (const node of nodes) {
      if (pausedRef.current) return outputs;
      // Skip nodes already consumed by a batch loop
      if (nodesConsumedByLoop.current.has(node.id)) continue;

      setProcessingLabel(node.data.step_title || node.data.label);

      if (node.data.node_type === 'batch_loop') {
        // Handle batch loop
        outputs = await runBatchLoop(node, outputs);
      } else {
        const result = await executeNode(node, outputs);
        outputs[node.id] = result;
        // Also store by label for variable reference
        if (node.data.label) {
          outputs[node.data.label] = result;
        }
      }
    }
    return outputs;
  }, [executeNode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run a batch loop node
  const runBatchLoop = useCallback(async (loopNode, currentOutputs) => {
    const input = getNodeInput(loopNode.id, currentOutputs);
    const items = Array.isArray(input) ? input : [];
    const batchSize = loopNode.data.batch_size || 3;
    const effectiveSize = batchSize === 0 ? items.length : batchSize;
    const totalBatches = Math.ceil(items.length / effectiveSize);

    // Find the AI prompt node that follows this loop in the ordered nodes
    const loopIdx = orderedNodes.findIndex((n) => n.id === loopNode.id);
    const nextNodes = orderedNodes.slice(loopIdx + 1);
    const aiNode = nextNodes.find((n) => n.data.node_type === 'ai_prompt');

    let results = [];
    let outputs = { ...currentOutputs };

    for (let iteration = 0; iteration < totalBatches; iteration++) {
      if (pausedRef.current) {
        setBatchState({ loopNode, items, iteration, results, aiNode, outputs });
        return outputs;
      }

      const context = {
        input: items,
        iteration,
        batchSize: effectiveSize,
        results,
        vars: outputs,
      };

      // Execute batch_loop script to get promptVars
      const scriptResult = executeScript(loopNode, context);

      if (scriptResult.done) {
        outputs[loopNode.id] = scriptResult.output;
        if (loopNode.data.label) outputs[loopNode.data.label] = scriptResult.output;
        break;
      }

      // If there's an AI node following, call it with the promptVars
      if (aiNode && scriptResult.promptVars) {
        let prompt = aiNode.data.inline_prompt || '';
        const systemMsg = aiNode.data.system_message || 'Ты — ассистент для анализа.';

        for (const [key, value] of Object.entries(scriptResult.promptVars)) {
          prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }

        // Substitute remaining vars
        const varMatches = prompt.match(/\{\{(\w+)\}\}/g) || [];
        for (const m of varMatches) {
          const varName = m.replace(/[{}]/g, '');
          if (outputs[varName] !== undefined) {
            prompt = prompt.replace(m, String(outputs[varName]));
          }
        }

        setProcessingLabel(`${loopNode.data.label}: ${iteration + 1}/${totalBatches}`);

        const response = await chatApi.analyzeRaw(projectId, {
          system_message: systemMsg,
          user_message: prompt,
          reasoning_effort: aiNode.data.reasoning_effort || 'high',
        });

        results.push(response.data.response_text);
      }

      setBatchProgress(Math.round(((iteration + 1) / totalBatches) * 100));
    }

    // Final script call to get aggregated output
    if (!pausedRef.current) {
      const finalContext = {
        input: items,
        iteration: totalBatches,
        batchSize: effectiveSize,
        results,
        vars: outputs,
      };
      const finalResult = executeScript(loopNode, finalContext);
      outputs[loopNode.id] = finalResult.output || results.join('\n\n');
      if (loopNode.data.label) outputs[loopNode.data.label] = finalResult.output || results.join('\n\n');

      // Mark the AI node as done too (its output is the combined results)
      if (aiNode) {
        outputs[aiNode.id] = results.join('\n\n');
        if (aiNode.data.label) outputs[aiNode.data.label] = results.join('\n\n');
        nodesConsumedByLoop.current.add(aiNode.id);
      }
    }

    return outputs;
  }, [orderedNodes, projectId, getNodeInput]);

  // Start the wizard — run first stage
  const startWizard = useCallback(async () => {
    if (stages.length === 0) return;
    resetWizard();
    setCurrentStageIdx(0);

    // Run auto nodes before first stage
    const firstStage = stages[0];
    if (firstStage.autoNodesBefore.length > 0) {
      setIsProcessing(true);
      try {
        const outputs = await runAutoNodes(firstStage.autoNodesBefore, {});
        setNodeOutputs(outputs);
      } catch (err) {
        toast.error('Ошибка выполнения: ' + (err.message || ''));
      } finally {
        setIsProcessing(false);
        setProcessingLabel('');
      }
    }
  }, [stages, resetWizard, runAutoNodes]);

  // Proceed to the next stage after user confirms current one
  const proceedToNextStage = useCallback(async (userOutput) => {
    const currentStage = stages[currentStageIdx];
    let outputs = { ...nodeOutputs };

    // Store the output of the primary node from user interaction
    if (userOutput !== undefined) {
      outputs[currentStage.primaryNode.id] = userOutput;
      if (currentStage.primaryNode.data.label) {
        outputs[currentStage.primaryNode.data.label] = userOutput;
      }
    }

    setIsProcessing(true);
    setBatchProgress(0);

    try {
      // Run auto nodes AFTER current stage's primary node
      if (currentStage.autoNodesAfter.length > 0) {
        outputs = await runAutoNodes(currentStage.autoNodesAfter, outputs);
      }

      // Move to next stage
      const nextIdx = currentStageIdx + 1;
      if (nextIdx >= stages.length) {
        // Wizard complete
        setNodeOutputs(outputs);
        setIsProcessing(false);
        setProcessingLabel('');
        return;
      }

      const nextStage = stages[nextIdx];

      // Run auto nodes BEFORE next stage
      if (nextStage.autoNodesBefore.length > 0) {
        outputs = await runAutoNodes(nextStage.autoNodesBefore, outputs);
      }

      // If next stage is a non-interactive pause stage, execute its primary node
      if (nextStage.isPauseStage && !nextStage.isInteractive) {
        setProcessingLabel(nextStage.primaryNode.data.step_title || nextStage.primaryNode.data.label);
        if (nextStage.primaryNode.data.node_type === 'batch_loop') {
          outputs = await runBatchLoop(nextStage.primaryNode, outputs);
        } else {
          const result = await executeNode(nextStage.primaryNode, outputs);
          outputs[nextStage.primaryNode.id] = result;
          if (nextStage.primaryNode.data.label) {
            outputs[nextStage.primaryNode.data.label] = result;
          }
        }
      }

      setNodeOutputs(outputs);
      setCurrentStageIdx(nextIdx);

      // Prepare state for next stage
      prepareStageUI(nextStage, outputs);

    } catch (err) {
      toast.error('Ошибка: ' + (err.message || ''));
      console.error(err);
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  }, [stages, currentStageIdx, nodeOutputs, runAutoNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prepare UI state when entering a new stage
  const prepareStageUI = useCallback((stage, outputs) => {
    const type = stage.primaryNode.data.node_type;

    if (type === 'user_edit_list') {
      // Input should be an array of strings (from parse_list or similar)
      const input = getNodeInput(stage.primaryNode.id, outputs);
      const items = Array.isArray(input) ? input : (typeof input === 'string' ? input.split('\n').filter(Boolean) : []);
      setEditableList(items.map((text, i) => ({ id: i, text, selected: true })));
    }

    if (type === 'user_review') {
      const input = getNodeInput(stage.primaryNode.id, outputs);
      let content = '';
      if (typeof input === 'string') {
        content = input;
      } else if (input && typeof input === 'object') {
        // Multiple data sources — build document from all inputs
        const depIds = dataDeps[stage.primaryNode.id] || [];
        const parts = depIds.map((id) => outputs[id]).filter(Boolean);
        if (parts.length >= 2) {
          // First dep = summary source, second = detailed analysis
          const subject = outputs['meeting_subject'] || outputs['subject'] || 'Анализ';
          const summary = parts[0];
          const detailed = parts.slice(1).join('\n\n');
          content = `# Резюме встречи: ${subject}\n\n## Краткое саммари\n\n${summary}\n\n---\n\n## Подробный анализ по темам\n\n${detailed}`;
        } else {
          content = parts.join('\n\n');
        }
      }
      setReviewContent(content);
      setIsEditingReview(false);
    }

    if (type === 'template') {
      // Reset template inputs but keep subject if previously set
      setTemplateInputs({});
    }

    if (stage.isPauseStage) {
      // Show the output of the primary node
      const nodeOut = outputs[stage.primaryNode.id];
      setPauseResult(typeof nodeOut === 'string' ? nodeOut : JSON.stringify(nodeOut, null, 2));
    }
  }, [getNodeInput]);

  // Handle template submit
  const handleTemplateSubmit = useCallback(() => {
    const stage = stages[currentStageIdx];
    const tplText = stage.primaryNode.data.template_text || '';
    const vars = (tplText.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/[{}]/g, ''));
    const uniqueVars = [...new Set(vars)];
    const varConfig = stage.primaryNode.data.variable_config || {};

    // Validate required fields
    for (const varName of uniqueVars) {
      const cfg = varConfig[varName] || {};
      if (cfg.required !== false && !templateInputs[varName]?.trim()) {
        toast.error(`Заполните поле: ${cfg.label || varName}`);
        return;
      }
    }

    // Store each variable as a named output
    let outputs = { ...nodeOutputs };
    for (const [key, value] of Object.entries(templateInputs)) {
      outputs[key] = value;
    }
    // Also store the template node's output as substituted text
    let result = tplText;
    for (const [key, value] of Object.entries(templateInputs)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    setNodeOutputs(outputs);
    proceedToNextStage(result);
  }, [stages, currentStageIdx, templateInputs, nodeOutputs, proceedToNextStage]);

  // Handle user_edit_list submit
  const handleEditListSubmit = useCallback(() => {
    const stage = stages[currentStageIdx];
    const minSelected = stage.primaryNode.data.min_selected ?? 1;
    const selected = editableList.filter((t) => t.selected);

    if (selected.length < minSelected) {
      toast.error(`Выберите минимум ${minSelected} элементов`);
      return;
    }

    const selectedTexts = selected.map((t) => t.text);
    proceedToNextStage(selectedTexts);
  }, [stages, currentStageIdx, editableList, proceedToNextStage]);

  // Handle pause stage continue
  const handlePauseContinue = useCallback(() => {
    proceedToNextStage(nodeOutputs[stages[currentStageIdx]?.primaryNode.id]);
  }, [stages, currentStageIdx, nodeOutputs, proceedToNextStage]);

  // Handle user_review save
  const handleSaveResult = useCallback(async () => {
    setIsSaving(true);
    try {
      // Find meeting subject from outputs
      const subject = nodeOutputs['meeting_subject'] || nodeOutputs['subject'] || 'Анализ встречи';
      await chatApi.saveFullAnalysis(projectId, {
        subject: typeof subject === 'string' ? subject : 'Анализ встречи',
        content: reviewContent,
      });
      onSaveResult?.(reviewContent);
      toast.success('Результат сохранён');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, reviewContent, nodeOutputs, onSaveResult]);

  // Export functions
  const copyToClipboard = () => {
    navigator.clipboard.writeText(reviewContent);
    toast.success('Скопировано в буфер обмена');
  };

  const downloadAsFile = () => {
    const blob = new Blob([reviewContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis-result.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsWord = async () => {
    try {
      const response = await exportApi.toWord(reviewContent, 'analysis-result');
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analysis-result.docx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Word документ скачан');
    } catch (error) {
      toast.error('Ошибка экспорта в Word');
    }
  };

  const downloadAsPdf = async () => {
    try {
      const response = await exportApi.toPdf(reviewContent, 'analysis-result');
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analysis-result.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF документ скачан');
    } catch (error) {
      toast.error('Ошибка экспорта в PDF');
    }
  };

  // Pause/resume for batch processing
  const handlePause = () => {
    pausedRef.current = true;
    setIsPaused(true);
  };

  const handleResume = useCallback(async () => {
    if (!batchState) return;
    pausedRef.current = false;
    setIsPaused(false);
    setIsProcessing(true);

    try {
      const outputs = await runBatchLoop(
        batchState.loopNode,
        batchState.outputs,
      );
      setNodeOutputs(outputs);
    } catch (err) {
      toast.error('Ошибка: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [batchState, runBatchLoop]);

  // ==================== RENDER ====================

  const currentStage = currentStageIdx >= 0 ? stages[currentStageIdx] : null;
  const isSetup = currentStageIdx === -1;

  // Setup screen (pipeline selector)
  if (isSetup) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2" data-testid="wizard-title">Мастер-анализ</h2>
              <p className="text-muted-foreground text-sm">
                Выберите сценарий анализа и запустите его
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Workflow className="w-4 h-4" />
                Сценарий анализа
              </Label>
              {loadingPipelines ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка сценариев...
                </div>
              ) : pipelines.length > 0 ? (
                <Select
                  value={selectedPipelineId}
                  onValueChange={setSelectedPipelineId}
                >
                  <SelectTrigger data-testid="pipeline-select">
                    <SelectValue placeholder="Выберите сценарий" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.is_public && (
                            <span className="text-[10px] text-muted-foreground">(общий)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Нет доступных сценариев. Создайте сценарий в конструкторе.
                </div>
              )}
              {selectedPipelineId && pipelineData && (
                <p className="text-xs text-muted-foreground">
                  {pipelineData.description}
                </p>
              )}
              {stages.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs font-medium text-slate-600 mb-2">Шаги сценария:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-white border rounded-full px-2.5 py-1">
                          <Icon className="w-3 h-3 text-slate-500" />
                          {s.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={startWizard}
              disabled={!selectedPipelineId || stages.length === 0}
              className="gap-2"
              data-testid="start-wizard-btn"
            >
              <Play className="w-4 h-4" />
              Запустить сценарий
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No stages loaded
  if (!currentStage) return null;

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-4" data-testid="wizard-progress-bar">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.id}>
              <div
                className={`flex items-center gap-2 shrink-0 ${
                  index === currentStageIdx
                    ? 'text-indigo-600'
                    : index < currentStageIdx
                      ? 'text-green-600'
                      : 'text-slate-400'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  index === currentStageIdx
                    ? 'bg-indigo-100'
                    : index < currentStageIdx
                      ? 'bg-green-100'
                      : 'bg-slate-100'
                }`}>
                  {index < currentStageIdx ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className="font-medium text-sm hidden sm:inline max-w-[120px] truncate">
                  {stage.label}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 min-w-[16px] ${
                  index < currentStageIdx ? 'bg-green-300' : 'bg-slate-200'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-muted-foreground text-sm">{processingLabel || 'Обработка...'}</p>
            {batchProgress > 0 && batchProgress < 100 && (
              <div className="w-full max-w-xs space-y-2">
                <Progress value={batchProgress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{batchProgress}%</span>
                  {!isPaused && (
                    <button onClick={handlePause} className="text-indigo-600 hover:underline flex items-center gap-1">
                      <Pause className="w-3 h-3" /> Пауза
                    </button>
                  )}
                </div>
              </div>
            )}
            {isPaused && (
              <Button size="sm" onClick={handleResume} className="gap-1.5">
                <Play className="w-3.5 h-3.5" /> Продолжить
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stage Content */}
      {!isProcessing && (
        <Card>
          <CardContent className="p-6">
            {/* Stage header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1" data-testid="stage-title">
                {currentStage.label}
              </h2>
              {currentStage.primaryNode.data.step_description && (
                <p className="text-muted-foreground text-sm" data-testid="stage-description">
                  {currentStage.primaryNode.data.step_description}
                </p>
              )}
            </div>

            {/* Template node */}
            {currentStage.type === 'template' && (
              <TemplateStageContent
                node={currentStage.primaryNode}
                inputs={templateInputs}
                setInputs={setTemplateInputs}
                onSubmit={handleTemplateSubmit}
              />
            )}

            {/* User edit list node */}
            {currentStage.type === 'user_edit_list' && (
              <EditListStageContent
                node={currentStage.primaryNode}
                items={editableList}
                setItems={setEditableList}
                editingIndex={editingIndex}
                setEditingIndex={setEditingIndex}
                newItemText={newItemText}
                setNewItemText={setNewItemText}
                onSubmit={handleEditListSubmit}
              />
            )}

            {/* User review node */}
            {currentStage.type === 'user_review' && (
              <ReviewStageContent
                node={currentStage.primaryNode}
                content={reviewContent}
                setContent={setReviewContent}
                isEditing={isEditingReview}
                setIsEditing={setIsEditingReview}
                isSaving={isSaving}
                onSave={handleSaveResult}
                onCopy={copyToClipboard}
                onDownloadMd={downloadAsFile}
                onDownloadWord={downloadAsWord}
                onDownloadPdf={downloadAsPdf}
                onReset={resetWizard}
              />
            )}

            {/* Pause stage (showing auto-node result) */}
            {currentStage.isPauseStage && !currentStage.isInteractive && (
              <PauseStageContent
                node={currentStage.primaryNode}
                result={pauseResult}
                buttonLabel={currentStage.primaryNode.data.continue_button_label || 'Далее'}
                onContinue={handlePauseContinue}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== STAGE SUB-COMPONENTS ====================

function TemplateStageContent({ node, inputs, setInputs, onSubmit }) {
  const tplText = node.data.template_text || '';
  const vars = (tplText.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/[{}]/g, ''));
  const uniqueVars = [...new Set(vars)];
  const varConfig = node.data.variable_config || {};
  const btnLabel = node.data.continue_button_label || 'Далее';

  return (
    <div className="space-y-4">
      {uniqueVars.map((varName) => {
        const cfg = varConfig[varName] || {};
        const label = cfg.label || varName;
        const placeholder = cfg.placeholder || '';
        const inputType = cfg.input_type || 'text';
        const required = cfg.required !== false;

        return (
          <div key={varName} className="space-y-1.5">
            <Label className="text-sm">
              {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {inputType === 'textarea' ? (
              <Textarea
                value={inputs[varName] || ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [varName]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                data-testid={`template-input-${varName}`}
              />
            ) : (
              <Input
                type={inputType === 'number' ? 'number' : 'text'}
                value={inputs[varName] || ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [varName]: e.target.value }))}
                placeholder={placeholder}
                data-testid={`template-input-${varName}`}
              />
            )}
          </div>
        );
      })}

      {uniqueVars.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Этот шаг не требует ввода данных
        </p>
      )}

      <Button onClick={onSubmit} className="gap-2" data-testid="template-submit-btn">
        <Sparkles className="w-4 h-4" />
        {btnLabel}
      </Button>
    </div>
  );
}

function EditListStageContent({ node, items, setItems, editingIndex, setEditingIndex, newItemText, setNewItemText, onSubmit }) {
  const allowAdd = node.data.allow_add !== false;
  const allowEdit = node.data.allow_edit !== false;
  const allowDelete = node.data.allow_delete !== false;
  const btnLabel = node.data.continue_button_label || 'Далее';
  const selectedCount = items.filter((t) => t.selected).length;

  const toggleItem = (index) => {
    setItems((prev) => prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t)));
  };

  const updateItem = (index, newText) => {
    setItems((prev) => prev.map((t, i) => (i === index ? { ...t, text: newText } : t)));
    setEditingIndex(null);
  };

  const deleteItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (newItemText.trim()) {
      setItems((prev) => [...prev, { id: Date.now(), text: newItemText.trim(), selected: true }]);
      setNewItemText('');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Выбрано: {selectedCount} из {items.length}
      </p>

      <ScrollArea className="h-[400px] border rounded-lg p-4">
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                item.selected ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
              }`}
              data-testid={`edit-list-item-${index}`}
            >
              <Checkbox
                checked={item.selected}
                onCheckedChange={() => toggleItem(index)}
              />

              {editingIndex === index && allowEdit ? (
                <Input
                  value={item.text}
                  onChange={(e) => updateItem(index, e.target.value)}
                  onBlur={() => setEditingIndex(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingIndex(null)}
                  autoFocus
                  className="flex-1"
                />
              ) : (
                <span className="flex-1 text-sm">{index + 1}. {item.text}</span>
              )}

              <div className="flex items-center gap-1">
                {allowEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingIndex(index)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {allowDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => deleteItem(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {allowAdd && (
        <div className="flex gap-2">
          <Input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Добавить элемент..."
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            data-testid="edit-list-new-item"
          />
          <Button variant="outline" onClick={addItem} disabled={!newItemText.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Button onClick={onSubmit} className="gap-2" data-testid="edit-list-submit-btn">
        <Play className="w-4 h-4" />
        {btnLabel}
      </Button>
    </div>
  );
}

function ReviewStageContent({
  node, content, setContent, isEditing, setIsEditing,
  isSaving, onSave, onCopy, onDownloadMd, onDownloadWord, onDownloadPdf, onReset,
}) {
  const allowEdit = node.data.allow_review_edit !== false;
  const showExport = node.data.show_export !== false;
  const showSave = node.data.show_save !== false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          {allowEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              {isEditing ? 'Просмотр' : 'Редактировать'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Начать заново
          </Button>
        </div>
      </div>

      {isEditing ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[500px] font-mono text-sm"
          data-testid="review-textarea"
        />
      ) : (
        <ScrollArea className="h-[500px] border rounded-lg p-6 bg-white">
          <div className="prose prose-sm max-w-none">
            <Markdown>{content}</Markdown>
          </div>
        </ScrollArea>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {showExport && (
          <>
            <Button onClick={onCopy} variant="outline" className="gap-2" data-testid="review-copy-btn">
              <Copy className="w-4 h-4" />
              Копировать
            </Button>
            <Button onClick={onDownloadMd} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              .md
            </Button>
            <Button onClick={onDownloadWord} variant="outline" className="gap-2">
              <FileType className="w-4 h-4" />
              Word
            </Button>
            <Button onClick={onDownloadPdf} variant="outline" className="gap-2">
              <File className="w-4 h-4" />
              PDF
            </Button>
          </>
        )}
        {showSave && (
          <Button onClick={onSave} disabled={isSaving} className="gap-2 ml-auto" data-testid="review-save-btn">
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Сохранить в историю
          </Button>
        )}
      </div>
    </div>
  );
}

function PauseStageContent({ node, result, buttonLabel, onContinue }) {
  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px] border rounded-lg p-6 bg-white">
        <div className="prose prose-sm max-w-none">
          <Markdown>{result || '*Нет данных*'}</Markdown>
        </div>
      </ScrollArea>

      <Button onClick={onContinue} className="gap-2" data-testid="pause-continue-btn">
        <ChevronRight className="w-4 h-4" />
        {buttonLabel}
      </Button>
    </div>
  );
}
