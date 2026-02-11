import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { pipelinesApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  ArrowLeft,
  Plus,
  Workflow,
  Globe,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Loader2,
  Sparkles,
  ListOrdered,
  Repeat,
  Layers,
  Variable,
  UserPen,
  Eye,
  Download,
  Upload,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';

const NODE_ICON_MAP = {
  ai_prompt: Sparkles,
  parse_list: ListOrdered,
  batch_loop: Repeat,
  aggregate: Layers,
  template: Variable,
  user_edit_list: UserPen,
  user_review: Eye,
};

export function PipelinesContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      const res = await pipelinesApi.list();
      setPipelines(res.data);
    } catch (err) {
      toast.error('Ошибка загрузки сценариев');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить сценарий?')) return;
    try {
      await pipelinesApi.delete(id);
      setPipelines((prev) => prev.filter((p) => p.id !== id));
      toast.success('Сценарий удалён');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await pipelinesApi.duplicate(id);
      setPipelines((prev) => [res.data, ...prev]);
      toast.success('Копия создана');
    } catch (err) {
      toast.error('Ошибка копирования');
    }
  };

  const handleExport = async (id, name) => {
    try {
      const res = await pipelinesApi.export(id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Сценарий экспортирован');
    } catch (err) {
      toast.error('Ошибка экспорта');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await pipelinesApi.import(file);
      setPipelines((prev) => [res.data, ...prev]);
      toast.success('Сценарий импортирован');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка импорта');
    }
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-2">
          <label>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
              data-testid="import-pipeline-input"
            />
            <Button
              variant="outline"
              className="gap-2 rounded-full cursor-pointer"
              asChild
            >
              <span>
                <Upload className="w-4 h-4" />
                Импорт
              </span>
            </Button>
          </label>
          <Button
            className="gap-2 rounded-full"
            onClick={() => navigate('/pipelines/new')}
            data-testid="create-pipeline-btn"
          >
            <Plus className="w-4 h-4" />
            Новый сценарий
          </Button>
        </div>
      </div>
      {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : pipelines.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Workflow className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Нет сценариев</h3>
              <p className="text-muted-foreground mb-6">
                Создайте первый сценарий для анализа встреч
              </p>
              <Button onClick={() => navigate('/pipelines/new')} className="rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Создать сценарий
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pipelines.map((pipeline) => {
              const canEdit = pipeline.user_id === user?.id;
              const nodeTypeCounts = {};
              (pipeline.nodes || []).forEach((n) => {
                nodeTypeCounts[n.node_type] = (nodeTypeCounts[n.node_type] || 0) + 1;
              });

              return (
                <Card
                  key={pipeline.id}
                  className="group hover:shadow-md transition-shadow cursor-pointer"
                  data-testid={`pipeline-card-${pipeline.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1" onClick={() => navigate(`/pipelines/${pipeline.id}`)}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-indigo-100 text-indigo-700 gap-1">
                            <Workflow className="w-3 h-3" />
                            Сценарий
                          </Badge>
                          {pipeline.is_public && (
                            <Badge variant="outline" className="gap-1">
                              <Globe className="w-3 h-3" />
                              Общий
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                        {pipeline.description && (
                          <CardDescription className="mt-1">
                            {pipeline.description}
                          </CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/pipelines/${pipeline.id}`)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            {canEdit ? 'Редактировать' : 'Просмотреть'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(pipeline.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Дублировать
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(pipeline.id, pipeline.name)}>
                            <Download className="w-4 h-4 mr-2" />
                            Экспорт
                          </DropdownMenuItem>
                          {canEdit && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(pipeline.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent onClick={() => navigate(`/pipelines/${pipeline.id}`)}>
                    {/* Node type badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(nodeTypeCounts).map(([type, count]) => {
                        const Icon = NODE_ICON_MAP[type] || Workflow;
                        return (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                          >
                            <Icon className="w-3 h-3" />
                            {count}
                          </span>
                        );
                      })}
                      <span className="text-[11px] text-muted-foreground ml-1">
                        {pipeline.nodes?.length || 0} узлов
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

export default function PipelinesPage() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-7xl mx-auto px-6 py-8">
          <PipelinesContent />
        </main>
      </div>
    </AppLayout>
  );
}
