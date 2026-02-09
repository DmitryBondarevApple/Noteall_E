import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Code,
  Repeat,
  Layers,
  Variable,
  UserPen,
  Eye,
  Play,
  Loader2,
} from 'lucide-react';

const STEP_ICONS = {
  ai_prompt: Sparkles,
  parse_list: Code,
  batch_loop: Repeat,
  aggregate: Layers,
  template: Variable,
  user_edit_list: UserPen,
  user_review: Eye,
};

const STEP_COLORS = {
  ai_prompt: 'text-violet-600 bg-violet-100',
  parse_list: 'text-sky-600 bg-sky-100',
  batch_loop: 'text-amber-600 bg-amber-100',
  aggregate: 'text-emerald-600 bg-emerald-100',
  template: 'text-slate-600 bg-slate-100',
  user_edit_list: 'text-pink-600 bg-pink-100',
  user_review: 'text-teal-600 bg-teal-100',
};

// Topological sort following flow edges
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

// Group nodes into wizard stages:
// Each interactive node (template, user_edit_list, user_review) starts a new stage
// Non-interactive nodes are grouped with the previous stage
function buildWizardStages(orderedNodes) {
  const stages = [];
  let currentStage = null;

  for (const node of orderedNodes) {
    const type = node.data.node_type;
    const isInteractive = ['template', 'user_edit_list', 'user_review'].includes(type);

    if (isInteractive || !currentStage) {
      currentStage = {
        id: node.id,
        label: node.data.label,
        type: type,
        icon: STEP_ICONS[type] || Variable,
        color: STEP_COLORS[type] || STEP_COLORS.template,
        nodes: [node],
        isInteractive: true,
      };
      stages.push(currentStage);
    } else {
      currentStage.nodes.push(node);
    }
  }

  return stages;
}

export function PipelineStepPreview({ nodes, edges }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mockInputs, setMockInputs] = useState({});
  const [mockTopics, setMockTopics] = useState([]);
  const [simulating, setSimulating] = useState(false);

  const orderedNodes = useMemo(
    () => resolveExecutionOrder(nodes, edges),
    [nodes, edges]
  );

  const stages = useMemo(() => buildWizardStages(orderedNodes), [orderedNodes]);

  if (stages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Добавьте узлы в сценарий для предпросмотра</p>
      </div>
    );
  }

  const stage = stages[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === stages.length - 1;

  const handleNext = () => {
    if (currentStep < stages.length - 1) {
      // Simulate auto-processing for non-interactive upcoming nodes
      const nextStage = stages[currentStep + 1];
      const hasAutoNodes = nextStage.nodes.some(
        (n) => !['template', 'user_edit_list', 'user_review'].includes(n.data.node_type)
      );
      if (hasAutoNodes) {
        setSimulating(true);
        setTimeout(() => {
          setSimulating(false);
          setCurrentStep((s) => s + 1);
        }, 800);
      } else {
        setCurrentStep((s) => s + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Progress Steps */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center max-w-4xl mx-auto">
          {stages.map((s, index) => {
            const Icon = s.icon;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setCurrentStep(index)}
                  className={`flex items-center gap-2 shrink-0 transition-colors ${
                    index === currentStep
                      ? 'text-indigo-600'
                      : index < currentStep
                        ? 'text-green-600'
                        : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      index === currentStep
                        ? 'bg-indigo-100'
                        : index < currentStep
                          ? 'bg-green-100'
                          : 'bg-slate-100'
                    }`}
                  >
                    {index < currentStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-sm font-medium hidden lg:inline max-w-[120px] truncate">
                    {s.label}
                  </span>
                </button>
                {index < stages.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 min-w-[20px] ${
                      index < currentStep ? 'bg-green-300' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full">
        {simulating ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              <p className="text-muted-foreground">Обработка...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Stage Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={stage.color + ' gap-1'}>
                    <stage.icon className="w-3 h-3" />
                    {stage.label}
                  </Badge>
                </div>

                {/* Show all nodes in this stage */}
                {stage.nodes.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {stage.nodes.map((n) => {
                      const NIcon = STEP_ICONS[n.data.node_type] || Variable;
                      const color = STEP_COLORS[n.data.node_type] || STEP_COLORS.template;
                      return (
                        <span
                          key={n.id}
                          className={`inline-flex items-center gap-1 text-[10px] ${color} px-2 py-0.5 rounded-full`}
                        >
                          <NIcon className="w-3 h-3" />
                          {n.data.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Render based on stage type */}
              {stage.type === 'template' && (
                <TemplateStepContent node={stage.nodes[0]} mockInputs={mockInputs} setMockInputs={setMockInputs} />
              )}

              {stage.type === 'user_edit_list' && (
                <UserEditListContent node={stage.nodes[0]} mockTopics={mockTopics} setMockTopics={setMockTopics} />
              )}

              {stage.type === 'user_review' && (
                <UserReviewContent node={stage.nodes[0]} stages={stages} currentStep={currentStep} />
              )}

              {/* Auto nodes in this stage */}
              {stage.nodes
                .filter((n) => !['template', 'user_edit_list', 'user_review'].includes(n.data.node_type))
                .map((n) => (
                  <AutoNodePreview key={n.id} node={n} />
                ))}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirst}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </Button>

          {!isLast ? (
            <Button
              onClick={handleNext}
              className="gap-2"
              data-testid="preview-next-step"
            >
              Далее
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button className="gap-2" variant="outline" disabled>
              <Check className="w-4 h-4" />
              Завершено
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components for each step type ---

function TemplateStepContent({ node, mockInputs, setMockInputs }) {
  const templateText = node.data.template_text || '';
  const vars = templateText.match(/\{\{(\w+)\}\}/g) || [];
  const uniqueVars = [...new Set(vars.map((v) => v.replace(/[{}]/g, '')))];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{node.data.label}</h2>
      <p className="text-sm text-muted-foreground">
        Заполните параметры для запуска анализа
      </p>
      {uniqueVars.map((varName) => (
        <div key={varName} className="space-y-1.5">
          <Label className="text-sm">{varName} *</Label>
          <Input
            value={mockInputs[varName] || ''}
            onChange={(e) =>
              setMockInputs((prev) => ({ ...prev, [varName]: e.target.value }))
            }
            placeholder={`Введите ${varName}...`}
            data-testid={`preview-input-${varName}`}
          />
        </div>
      ))}
      {uniqueVars.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Нет переменных для ввода</p>
      )}
    </div>
  );
}

function UserEditListContent({ node, mockTopics, setMockTopics }) {
  // Show mock topics for preview
  const demoTopics =
    mockTopics.length > 0
      ? mockTopics
      : [
          { text: 'Тема 1 (пример)', selected: true },
          { text: 'Тема 2 (пример)', selected: true },
          { text: 'Тема 3 (пример)', selected: false },
          { text: 'Тема 4 (пример)', selected: true },
          { text: 'Тема 5 (пример)', selected: true },
        ];

  const [topics, setTopics] = useState(demoTopics);

  const toggle = (index) => {
    setTopics((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{node.data.label}</h2>
        <p className="text-sm text-muted-foreground">
          Выберите элементы для обработки. Снимите галочку, чтобы исключить.
        </p>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {topics.map((t, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              t.selected ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-50'
            }`}
          >
            <Checkbox
              checked={t.selected}
              onCheckedChange={() => toggle(i)}
              data-testid={`preview-topic-${i}`}
            />
            <span className="text-sm">{t.text}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Выбрано: {topics.filter((t) => t.selected).length} из {topics.length}
      </p>
    </div>
  );
}

function UserReviewContent({ node, stages, currentStep }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{node.data.label}</h2>
      <p className="text-sm text-muted-foreground">
        Итоговый результат анализа будет показан здесь
      </p>
      <div className="bg-slate-50 rounded-lg border p-6 min-h-[200px]">
        <p className="text-sm text-muted-foreground italic text-center">
          Здесь будет отображён результат выполнения сценария
        </p>
      </div>
    </div>
  );
}

function AutoNodePreview({ node }) {
  const Icon = STEP_ICONS[node.data.node_type] || Variable;
  const color = STEP_COLORS[node.data.node_type] || STEP_COLORS.template;

  return (
    <div className="bg-slate-50 rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium">{node.data.label}</span>
        <Badge variant="outline" className="text-[10px]">авто</Badge>
      </div>
      {node.data.node_type === 'ai_prompt' && node.data.inline_prompt && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          Промпт: {node.data.inline_prompt.substring(0, 120)}...
        </p>
      )}
      {node.data.node_type === 'batch_loop' && (
        <p className="text-xs text-muted-foreground">
          Цикл по {node.data.batch_size || 3} элементов
        </p>
      )}
      {(node.data.node_type === 'parse_list' || node.data.node_type === 'aggregate') && (
        <p className="text-xs text-muted-foreground">
          Выполняется автоматически
        </p>
      )}
    </div>
  );
}
