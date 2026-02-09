import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Sparkles,
  ListOrdered,
  Repeat,
  Layers,
  FileText,
  UserPen,
  Eye,
  Variable,
} from 'lucide-react';

const NODE_STYLES = {
  ai_prompt: {
    icon: Sparkles,
    bg: 'bg-violet-50 border-violet-300',
    iconBg: 'bg-violet-100 text-violet-600',
    label: 'AI Промпт',
  },
  parse_list: {
    icon: ListOrdered,
    bg: 'bg-sky-50 border-sky-300',
    iconBg: 'bg-sky-100 text-sky-600',
    label: 'Парсинг списка',
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

export function PipelineNode({ data, selected }) {
  const style = NODE_STYLES[data.node_type] || NODE_STYLES.template;
  const Icon = style.icon;

  return (
    <div
      className={`rounded-xl border-2 shadow-sm min-w-[200px] max-w-[260px] transition-shadow ${style.bg} ${
        selected ? 'ring-2 ring-indigo-400 shadow-md' : ''
      }`}
      data-testid={`pipeline-node-${data.node_id}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${style.iconBg}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {style.label}
          </span>
        </div>
        <div className="text-sm font-semibold text-slate-800 truncate">
          {data.label}
        </div>
        {data.node_type === 'ai_prompt' && data.reasoning_effort && (
          <div className="mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              data.reasoning_effort === 'high' ? 'bg-red-100 text-red-600' :
              data.reasoning_effort === 'medium' ? 'bg-amber-100 text-amber-600' :
              'bg-green-100 text-green-600'
            }`}>
              {data.reasoning_effort}
            </span>
          </div>
        )}
        {data.node_type === 'batch_loop' && data.batch_size && (
          <div className="text-[11px] text-muted-foreground mt-1">
            По {data.batch_size} за раз
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />
    </div>
  );
}

export const nodeTypes = {
  pipelineNode: PipelineNode,
};

export { NODE_STYLES };
