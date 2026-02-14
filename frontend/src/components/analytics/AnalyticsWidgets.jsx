import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Mic, Brain, HardDrive } from 'lucide-react';

export function KpiCard({ label, value, sub, icon: Icon, trend, color = 'text-slate-900' }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <p className={`text-xl font-bold tracking-tight ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        {trend !== undefined && trend !== 0 && (
          <p className={`text-[11px] mt-0.5 ${trend > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}% vs пред. период
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CategoryBar({ transcription, analysis, storage }) {
  const total = transcription + analysis + storage;
  if (total === 0) return <div className="h-2 rounded-full bg-slate-100" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden">
      {transcription > 0 && (
        <div className="bg-indigo-500" style={{ width: `${(transcription / total) * 100}%` }} title={`Транскрибация: ${transcription.toFixed(2)}`} />
      )}
      {analysis > 0 && (
        <div className="bg-cyan-500" style={{ width: `${(analysis / total) * 100}%` }} title={`Анализ: ${analysis.toFixed(2)}`} />
      )}
      {storage > 0 && (
        <div className="bg-emerald-500" style={{ width: `${(storage / total) * 100}%` }} title={`Хранение: ${storage.toFixed(2)}`} />
      )}
    </div>
  );
}

export function CategoryLegend({ expenses, fmtNum }) {
  return (
    <div className="flex items-center gap-4 mt-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
        <Mic className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs text-muted-foreground">Транскрибация</span>
        <span className="text-xs font-semibold">{fmtNum(expenses.transcription || 0, 2)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
        <Brain className="w-3.5 h-3.5 text-cyan-500" />
        <span className="text-xs text-muted-foreground">Анализ (AI)</span>
        <span className="text-xs font-semibold">{fmtNum(expenses.analysis || 0, 2)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs text-muted-foreground">Хранение</span>
        <span className="text-xs font-semibold">{fmtNum(expenses.storage || 0, 2)}</span>
      </div>
    </div>
  );
}

export const PERIOD_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё время' },
];

export const PIE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#94a3b8'];

export const ROLE_LABELS = { superadmin: 'Суперадмин', org_admin: 'Админ', user: 'Юзер', admin: 'Админ' };

export function PeriodFilter({ period, onPeriodChange }) {
  return (
    <div className="flex items-center gap-1 border-b" data-testid="period-filter">
      {PERIOD_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onPeriodChange(opt.value)}
          data-testid={`period-${opt.value}`}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            period === opt.value
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
