import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Sparkles,
  Repeat,
  Layers,
  UserPen,
  Eye,
  Variable,
  Code,
  PenLine,
  Braces,
  FileCode2,
} from 'lucide-react';

const NODE_STYLES = {
  ai_prompt: {
    icon: Sparkles,
    bg: 'bg-violet-50 border-violet-300',
    iconBg: 'bg-violet-100 text-violet-600',
    label: 'AI Промпт',
  },
  parse_list: {
    icon: Code,
    bg: 'bg-sky-50 border-sky-300',
    iconBg: 'bg-sky-100 text-sky-600',
    label: 'Скрипт парсинга',
  },
  batch_loop: {
    icon: Repeat,
    bg: 'bg-amber-50 border-amber-300',
    iconBg: 'bg-amber-100 text-amber-600',
    label: 'Батч-цикл',
  },
  aggregate: {
    icon: Layers,
    bg: 'bg-emerald-50 border-emerald-300',
    iconBg: 'bg-emerald-100 text-emerald-600',
    label: 'Агрегация',
  },
  template: {
    icon: Variable,
    bg: 'bg-slate-50 border-slate-300',
    iconBg: 'bg-slate-100 text-slate-600',
    label: 'Шаблон',
  },
  user_input: {
    icon: PenLine,
    bg: 'bg-blue-50 border-blue-300',
    iconBg: 'bg-blue-100 text-blue-600',
    label: 'Ввод данных',
  },
  format_template: {
    icon: FileCode2,
    bg: 'bg-cyan-50 border-cyan-300',
    iconBg: 'bg-cyan-100 text-cyan-600',
    label: 'Форматирование',
  },
  batch_prompt_template: {
    icon: Braces,
    bg: 'bg-indigo-50 border-indigo-300',
    iconBg: 'bg-indigo-100 text-indigo-600',
    label: 'Батч-шаблон',
  },
  user_edit_list: {
    icon: UserPen,
    bg: 'bg-pink-50 border-pink-300',
    iconBg: 'bg-pink-100 text-pink-600',
    label: 'Ред. пользователем',
  },
  user_review: {
    icon: Eye,
    bg: 'bg-teal-50 border-teal-300',
    iconBg: 'bg-teal-100 text-teal-600',
    label: 'Просмотр',
  },
};

// Handles hidden by default, appear on hover via CSS
const baseHandle = 'opacity-0 group-hover/node:opacity-100 transition-opacity duration-150';
const flowHandle = `${baseHandle} !w-2 !h-2 !bg-slate-400 !border-[1.5px] !border-white`;
const dataHandle = `${baseHandle} !w-2.5 !h-2.5 !bg-orange-400 !border-[1.5px] !border-white !rounded-sm`;

export function PipelineNode({ data, selected }) {
  const style = NODE_STYLES[data.node_type] || NODE_STYLES.template;
  const Icon = style.icon;

  return (
    <div
      className={`group/node rounded-xl border-2 shadow-sm min-w-[170px] max-w-[220px] transition-shadow ${style.bg} ${
        selected ? 'ring-2 ring-indigo-400 shadow-md' : ''
      }`}
      data-testid={`pipeline-node-${data.node_id}`}
    >
      {/* ---- TOP: target handles ---- */}
      <Handle type="target" position={Position.Top} id="top-flow-in"
        className={flowHandle} style={{ left: '35%' }} />
      <Handle type="target" position={Position.Top} id="top-data-in"
        className={dataHandle} style={{ left: '65%' }} />

      {/* ---- RIGHT: source + target ---- */}
      <Handle type="source" position={Position.Right} id="right-flow-out"
        className={flowHandle} style={{ top: '30%' }} />
      <Handle type="source" position={Position.Right} id="right-data-out"
        className={dataHandle} style={{ top: '60%' }} />
      <Handle type="target" position={Position.Right} id="right-flow-in"
        className={flowHandle} style={{ top: '45%' }} />
      <Handle type="target" position={Position.Right} id="right-data-in"
        className={dataHandle} style={{ top: '75%' }} />

      {/* ---- BOTTOM: source handles ---- */}
      <Handle type="source" position={Position.Bottom} id="bottom-flow-out"
        className={flowHandle} style={{ left: '35%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-data-out"
        className={dataHandle} style={{ left: '65%' }} />

      {/* ---- LEFT: source + target ---- */}
      <Handle type="target" position={Position.Left} id="left-flow-in"
        className={flowHandle} style={{ top: '30%' }} />
      <Handle type="target" position={Position.Left} id="left-data-in"
        className={dataHandle} style={{ top: '60%' }} />
      <Handle type="source" position={Position.Left} id="left-flow-out"
        className={flowHandle} style={{ top: '45%' }} />
      <Handle type="source" position={Position.Left} id="left-data-out"
        className={dataHandle} style={{ top: '75%' }} />

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className={`w-5 h-5 rounded flex items-center justify-center ${style.iconBg}`}>
            <Icon className="w-3 h-3" />
          </div>
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
            {style.label}
          </span>
        </div>
        <div className="text-[13px] font-semibold text-slate-800 truncate">
          {data.label}
        </div>
        {data.node_type === 'ai_prompt' && data.reasoning_effort && (
          <div className="mt-0.5">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              data.reasoning_effort === 'high' ? 'bg-red-100 text-red-600' :
              data.reasoning_effort === 'medium' ? 'bg-amber-100 text-amber-600' :
              'bg-green-100 text-green-600'
            }`}>
              {data.reasoning_effort}
            </span>
          </div>
        )}
        {data.node_type === 'batch_loop' && data.batch_size && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            По {data.batch_size} за раз
          </div>
        )}
        {(data.node_type === 'parse_list' || data.node_type === 'aggregate' || data.node_type === 'batch_loop' || data.node_type === 'template') && (
          <div className="text-[9px] text-sky-600 mt-0.5 font-mono truncate">
            {data.script ? '{ скрипт }' : '{ по умолчанию }'}
          </div>
        )}
      </div>
    </div>
  );
}

export const nodeTypes = {
  pipelineNode: PipelineNode,
};

export { NODE_STYLES };
