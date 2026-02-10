import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { PipelinesContent } from './PipelinesPage';
import { PromptsContent } from './PromptsPage';
import { Workflow, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';

const tabs = [
  { id: 'pipelines', label: 'Сценарии', icon: Workflow },
  { id: 'prompts', label: 'Промпты', icon: BookOpen },
];

export default function ConstructorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'pipelines';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header with tabs */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between py-4">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="constructor-title">Конструктор</h1>
            </div>
            <div className="flex gap-1 -mb-px">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                      isActive
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    )}
                    data-testid={`constructor-tab-${tab.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {activeTab === 'pipelines' && <PipelinesContent />}
          {activeTab === 'prompts' && <PromptsContent />}
        </main>
      </div>
    </AppLayout>
  );
}
