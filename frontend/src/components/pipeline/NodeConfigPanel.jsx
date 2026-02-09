import React from 'react';
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
import { X } from 'lucide-react';
import { NODE_STYLES } from './PipelineNode';

const DEFAULT_PARSE_SCRIPT = `// Парсинг нумерованного списка из ответа AI
// input: строка текста от AI
// output: массив строк (элементов списка)

function parse(input) {
  const lines = input.split('\\n');
  return lines
    .map(line => line.replace(/^\\d+[\\.)\\-]\\s*/, '').trim())
    .filter(line => line.length > 0);
}`;

export function NodeConfigPanel({ node, allNodes, onUpdate, onDelete, onClose }) {
  if (!node) return null;

  const nodeData = node.data;

  const handleChange = (field, value) => {
    onUpdate(node.id, { ...nodeData, [field]: value });
  };

  const style = NODE_STYLES[nodeData.node_type] || NODE_STYLES.template;
  const Icon = style.icon;

  return (
    <div className="w-80 border-l bg-white overflow-y-auto" data-testid="node-config-panel">
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

        {/* AI Prompt fields */}
        {nodeData.node_type === 'ai_prompt' && (
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
                rows={6}
                placeholder="Текст промпта. Используйте {{переменная}} для подстановки..."
                data-testid="node-inline-prompt"
              />
              <p className="text-[10px] text-muted-foreground">
                Переменные: {'{{meeting_subject}}'}, {'{{topics_batch}}'}, {'{{aggregated_text}}'}
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

        {/* Parse list — script editor */}
        {nodeData.node_type === 'parse_list' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Скрипт парсинга</Label>
            <Textarea
              value={nodeData.script || DEFAULT_PARSE_SCRIPT}
              onChange={(e) => handleChange('script', e.target.value)}
              rows={12}
              className="font-mono text-xs leading-relaxed"
              data-testid="node-parse-script"
            />
            <p className="text-[10px] text-muted-foreground">
              JavaScript-функция parse(input). Получает текст ответа AI, возвращает массив строк.
            </p>
          </div>
        )}

        {/* Template fields */}
        {nodeData.node_type === 'template' && (
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

        {/* Batch loop fields */}
        {nodeData.node_type === 'batch_loop' && (
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

        {/* Input from */}
        {nodeData.input_from && nodeData.input_from.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Входные данные от</Label>
            <div className="flex flex-wrap gap-1">
              {nodeData.input_from.map((sourceId) => {
                const sourceNode = allNodes.find((n) => n.id === sourceId);
                return (
                  <span
                    key={sourceId}
                    className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                  >
                    {sourceNode?.data?.label || sourceId}
                  </span>
                );
              })}
            </div>
          </div>
        )}

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
