import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { X, Sparkles, Loader2, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { NODE_STYLES } from './PipelineNode';
import { chatApi } from '../../lib/api';
import { toast } from 'sonner';

// --- Default scripts matching current FullAnalysisTab logic ---

const DEFAULT_SCRIPTS = {
  parse_list: `// Парсинг нумерованного списка из ответа AI
// context.input — строка текста (ответ AI)
// Возвращает: { output: string[] }

function run(context) {
  const lines = context.input.split('\\n');
  const items = lines
    .map(line => line.replace(/^\\d+[\\.)\\-]\\s*/, '').trim())
    .filter(line => line.length > 0);
  return { output: items };
}`,

  batch_loop: `// Нарезка на батчи + подстановка в промпт
// context.input — массив элементов (например, тем)
// context.iteration — номер текущей итерации (0, 1, 2...)
// context.batchSize — размер батча из настроек узла
// context.results — массив ответов AI от предыдущих итераций
// Возвращает: { done, output?, promptVars? }

function run(context) {
  const items = context.input;
  const size = context.batchSize || 3;
  const effectiveSize = size === 0 ? items.length : size;
  const start = context.iteration * effectiveSize;
  const batch = items.slice(start, start + effectiveSize);

  // Условие остановки — элементы закончились
  if (batch.length === 0) {
    return {
      done: true,
      output: context.results.join('\\n\\n')
    };
  }

  // Формируем нумерованный список для подстановки
  const topicsList = batch
    .map((t, i) => \`\${start + i + 1}. \${t}\`)
    .join('\\n');

  const prefix = context.iteration === 0
    ? 'Сделай анализ следующих тем:'
    : 'Продолжай анализ следующих тем:';

  return {
    done: false,
    promptVars: {
      topics_batch: \`\${prefix}\\n\${topicsList}\`
    }
  };
}`,

  aggregate: `// Склейка результатов из нескольких итераций
// context.input — массив строк (результаты батч-анализа)
// Возвращает: { output: string }

function run(context) {
  const parts = Array.isArray(context.input)
    ? context.input
    : [context.input];
  return {
    output: parts.join('\\n\\n')
  };
}`,

  template: `// Подстановка переменных в шаблон
// context.vars — объект переменных из источников данных
// context.input — данные от предыдущего узла
// Возвращает: { output: string }

function run(context) {
  let text = context.input || '';
  if (context.vars) {
    for (const [key, value] of Object.entries(context.vars)) {
      text = text.replace(
        new RegExp('\\\\{\\\\{' + key + '\\\\}\\\\}', 'g'),
        value
      );
    }
  }
  return { output: text };
}`,

  ai_prompt: `// Подготовка данных перед отправкой промпта в AI
// context.input — данные от источника данных
// context.prompt — шаблон промпта из настроек узла
// context.vars — переменные из источников данных
// Возвращает: { promptVars: { key: value } }
// Подставленные переменные заменят {{key}} в промпте

function run(context) {
  return {
    promptVars: {
      // Пример: meeting_subject будет подставлен в {{meeting_subject}}
    }
  };
}`,

  user_edit_list: null,
  user_review: null,
};

const SCRIPT_DESCRIPTIONS = {
  parse_list: 'Скрипт парсинга: преобразует текст ответа AI в структурированные данные',
  batch_loop: 'Скрипт цикла: нарезает данные на порции и управляет повторным вызовом AI',
  aggregate: 'Скрипт склейки: объединяет результаты нескольких итераций',
  template: 'Скрипт шаблона: подставляет переменные в текст',
  ai_prompt: 'Скрипт подготовки: формирует данные перед отправкой в AI',
};

export function NodeConfigPanel({ node, allNodes, edges, onUpdate, onDelete, onClose }) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!node) return null;

  const nodeData = node.data;
  const nodeType = nodeData.node_type;

  const handleChange = (field, value) => {
    onUpdate(node.id, { ...nodeData, [field]: value });
  };

  const style = NODE_STYLES[nodeType] || NODE_STYLES.template;
  const Icon = style.icon;

  const hasScript = DEFAULT_SCRIPTS[nodeType] !== null && DEFAULT_SCRIPTS[nodeType] !== undefined;
  const currentScript = nodeData.script || DEFAULT_SCRIPTS[nodeType] || '';

  const flowSources = (edges || [])
    .filter((e) => e.target === node.id && e.data?.edgeType !== 'data')
    .map((e) => allNodes.find((n) => n.id === e.source))
    .filter(Boolean);

  const dataSources = (edges || [])
    .filter((e) => e.target === node.id && e.data?.edgeType === 'data')
    .map((e) => allNodes.find((n) => n.id === e.source))
    .filter(Boolean);

  const handleGenerateScript = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Опишите что должен делать скрипт');
      return;
    }
    setGenerating(true);
    try {
      const res = await chatApi.generateScript({
        description: aiPrompt,
        node_type: nodeType,
        context: `Текущий скрипт узла:\n${currentScript}`
      });
      handleChange('script', res.data.response_text);
      setAiPrompt('');
      toast.success('Скрипт сгенерирован');
    } catch (err) {
      toast.error('Ошибка генерации скрипта');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-[340px] border-l bg-white overflow-y-auto" data-testid="node-config-panel">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${style.iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm">{style.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Название узла</Label>
          <Input
            value={nodeData.label}
            onChange={(e) => handleChange('label', e.target.value)}
            data-testid="node-label-input"
          />
        </div>

        {/* AI Prompt specific fields */}
        {nodeType === 'ai_prompt' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">System message</Label>
              <Textarea
                value={nodeData.system_message || ''}
                onChange={(e) => handleChange('system_message', e.target.value)}
                rows={3}
                placeholder="Системное сообщение для AI..."
                data-testid="node-system-message"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Промпт</Label>
              <Textarea
                value={nodeData.inline_prompt || ''}
                onChange={(e) => handleChange('inline_prompt', e.target.value)}
                rows={5}
                placeholder="Текст промпта..."
                data-testid="node-inline-prompt"
              />
              <p className="text-[10px] text-muted-foreground">
                {'{{переменная}}'} — подстановка из скрипта
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reasoning effort</Label>
              <Select
                value={nodeData.reasoning_effort || 'high'}
                onValueChange={(v) => handleChange('reasoning_effort', v)}
              >
                <SelectTrigger data-testid="node-reasoning-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Template text (for template nodes) */}
        {nodeType === 'template' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Шаблон</Label>
            <Textarea
              value={nodeData.template_text || ''}
              onChange={(e) => handleChange('template_text', e.target.value)}
              rows={3}
              placeholder="{{meeting_subject}}"
              data-testid="node-template-text"
            />
          </div>
        )}

        {/* Batch size (for batch_loop) */}
        {nodeType === 'batch_loop' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Размер батча</Label>
            <Input
              type="number"
              min={0}
              value={nodeData.batch_size || 3}
              onChange={(e) => handleChange('batch_size', parseInt(e.target.value) || 0)}
              data-testid="node-batch-size"
            />
            <p className="text-[10px] text-muted-foreground">
              0 = все элементы за один раз
            </p>
          </div>
        )}

        {/* ===== SCRIPT EDITOR (for all script-capable nodes) ===== */}
        {hasScript && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700">
                {SCRIPT_DESCRIPTIONS[nodeType] || 'Скрипт'}
              </Label>
            </div>

            <Textarea
              value={currentScript}
              onChange={(e) => handleChange('script', e.target.value)}
              rows={14}
              className="font-mono text-[11px] leading-relaxed bg-slate-50"
              data-testid="node-script-editor"
            />

            {/* AI Script Generator */}
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 space-y-2">
              <Label className="text-xs text-violet-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI-помощник
              </Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Опишите что должен делать скрипт..."
                data-testid="ai-script-prompt"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 text-xs border-violet-300 text-violet-700 hover:bg-violet-100"
                onClick={handleGenerateScript}
                disabled={generating}
                data-testid="generate-script-btn"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Сгенерировать скрипт
              </Button>
            </div>
          </div>
        )}

        {/* ===== WIZARD DISPLAY SETTINGS ===== */}
        <div className="border-t pt-3">
          <button
            onClick={() => setWizardOpen(!wizardOpen)}
            className="flex items-center justify-between w-full text-left"
            data-testid="wizard-settings-toggle"
          >
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
              <Settings2 className="w-3.5 h-3.5" />
              Настройки визарда
            </Label>
            {wizardOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {wizardOpen && (
            <div className="mt-3 space-y-3">
              {/* Step title */}
              <div className="space-y-1">
                <Label className="text-xs">Заголовок шага</Label>
                <div className="relative">
                  <Input
                    value={nodeData.step_title || ''}
                    onChange={(e) => handleChange('step_title', e.target.value.slice(0, 40))}
                    placeholder={nodeData.label}
                    maxLength={40}
                    data-testid="wizard-step-title"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    {(nodeData.step_title || '').length}/40
                  </span>
                </div>
              </div>

              {/* Step description */}
              <div className="space-y-1">
                <Label className="text-xs">Описание шага</Label>
                <div className="relative">
                  <Textarea
                    value={nodeData.step_description || ''}
                    onChange={(e) => handleChange('step_description', e.target.value.slice(0, 200))}
                    placeholder="Инструкция для пользователя..."
                    rows={2}
                    maxLength={200}
                    data-testid="wizard-step-description"
                  />
                  <span className="absolute right-2 bottom-1.5 text-[10px] text-muted-foreground">
                    {(nodeData.step_description || '').length}/200
                  </span>
                </div>
              </div>

              {/* Continue button label */}
              <div className="space-y-1">
                <Label className="text-xs">Текст кнопки</Label>
                <div className="relative">
                  <Input
                    value={nodeData.continue_button_label || ''}
                    onChange={(e) => handleChange('continue_button_label', e.target.value.slice(0, 25))}
                    placeholder="Далее"
                    maxLength={25}
                    data-testid="wizard-button-label"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    {(nodeData.continue_button_label || '').length}/25
                  </span>
                </div>
              </div>

              {/* Pause after execution */}
              {!['template', 'user_edit_list', 'user_review'].includes(nodeType) && (
                <div className="flex items-center justify-between py-1">
                  <Label className="text-xs">Остановка после выполнения</Label>
                  <Switch
                    checked={!!nodeData.pause_after}
                    onCheckedChange={(v) => handleChange('pause_after', v)}
                    data-testid="wizard-pause-after"
                  />
                </div>
              )}

              {/* user_edit_list specific options */}
              {nodeType === 'user_edit_list' && (
                <div className="space-y-2 bg-pink-50 rounded-lg p-3 border border-pink-200">
                  <p className="text-[10px] font-semibold text-pink-700 uppercase tracking-wide">Опции списка</p>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Добавление элементов</Label>
                    <Switch
                      checked={nodeData.allow_add !== false}
                      onCheckedChange={(v) => handleChange('allow_add', v)}
                      data-testid="wizard-allow-add"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Редактирование</Label>
                    <Switch
                      checked={nodeData.allow_edit !== false}
                      onCheckedChange={(v) => handleChange('allow_edit', v)}
                      data-testid="wizard-allow-edit"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Удаление</Label>
                    <Switch
                      checked={nodeData.allow_delete !== false}
                      onCheckedChange={(v) => handleChange('allow_delete', v)}
                      data-testid="wizard-allow-delete"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Мин. выбранных</Label>
                    <Input
                      type="number"
                      min={0}
                      value={nodeData.min_selected ?? 1}
                      onChange={(e) => handleChange('min_selected', parseInt(e.target.value) || 0)}
                      className="w-20"
                      data-testid="wizard-min-selected"
                    />
                  </div>
                </div>
              )}

              {/* user_review specific options */}
              {nodeType === 'user_review' && (
                <div className="space-y-2 bg-teal-50 rounded-lg p-3 border border-teal-200">
                  <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide">Опции просмотра</p>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Редактирование результата</Label>
                    <Switch
                      checked={nodeData.allow_review_edit !== false}
                      onCheckedChange={(v) => handleChange('allow_review_edit', v)}
                      data-testid="wizard-allow-review-edit"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Кнопки экспорта</Label>
                    <Switch
                      checked={nodeData.show_export !== false}
                      onCheckedChange={(v) => handleChange('show_export', v)}
                      data-testid="wizard-show-export"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Кнопка "Сохранить"</Label>
                    <Switch
                      checked={nodeData.show_save !== false}
                      onCheckedChange={(v) => handleChange('show_save', v)}
                      data-testid="wizard-show-save"
                    />
                  </div>
                </div>
              )}

              {/* template variable config */}
              {nodeType === 'template' && (
                <TemplateVarConfig
                  templateText={nodeData.template_text || ''}
                  variableConfig={nodeData.variable_config || {}}
                  onChange={(cfg) => handleChange('variable_config', cfg)}
                />
              )}
            </div>
          )}
        </div>

        {/* Flow connections */}
        {flowSources.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-slate-400 rounded" />
              Выполняется после
            </Label>
            <div className="flex flex-wrap gap-1">
              {flowSources.map((src) => (
                <span key={src.id} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {src.data?.label || src.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Data connections */}
        <div className="space-y-1.5">
          <Label className="text-xs text-orange-600 flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-orange-400 rounded" style={{ borderTop: '2px dashed #f97316', height: 0 }} />
            Источники данных
          </Label>
          {dataSources.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {dataSources.map((src) => (
                <span
                  key={src.id}
                  className="text-[11px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full"
                >
                  {src.data?.label || src.id}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Соедините оранжевые порты для передачи данных
            </p>
          )}
        </div>

        {/* Delete */}
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDelete(node.id)}
            data-testid="delete-node-btn"
          >
            Удалить узел
          </Button>
        </div>
      </div>
    </div>
  );
}
