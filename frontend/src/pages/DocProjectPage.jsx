import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { docProjectsApi, docAttachmentsApi, docRunsApi, pipelinesApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  ArrowLeft, FileText, Upload, Link2, Trash2, Paperclip, File, Image, FileType,
  Globe, Loader2, Play, MoreHorizontal, Clock, CheckCircle2, ChevronDown, ChevronRight,
  Copy, AlertCircle, Pencil,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../components/ui/collapsible';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '../lib/utils';

const fileTypeIcons = { pdf: FileType, image: Image, text: FileText, url: Globe, other: File };

// ============ Materials Panel ============
function MaterialsPanel({ attachments, uploading, onUpload, onAddUrl, onDelete }) {
  return (
    <div className="w-60 border-r bg-white flex flex-col shrink-0">
      <div className="px-3 py-2.5 border-b">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Материалы
          <span className="ml-auto text-[10px] font-normal text-slate-400">{attachments.length}</span>
        </h2>
      </div>
      <div className="p-2 space-y-1.5">
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 gap-1 text-[11px] h-7" disabled={uploading}
            onClick={() => document.getElementById('doc-file-input').click()} data-testid="upload-file-btn">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Файл
          </Button>
          <input id="doc-file-input" type="file" multiple className="hidden" onChange={onUpload}
            accept=".pdf,.txt,.md,.csv,.docx,.png,.jpg,.jpeg,.webp" />
          <Button variant="outline" size="sm" className="flex-1 gap-1 text-[11px] h-7" onClick={onAddUrl} data-testid="add-url-btn">
            <Link2 className="w-3 h-3" /> Ссылка
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-0.5">
          {attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Нет материалов</p>
          ) : attachments.map(att => {
            const Icon = fileTypeIcons[att.file_type] || File;
            return (
              <div key={att.id} className="group flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-slate-50 transition-colors"
                data-testid={`attachment-${att.id}`}>
                <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs truncate flex-1">{att.name}</span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50"
                  onClick={() => onDelete(att.id)}>
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ Run Result Card ============
function RunResultCard({ run, onDelete, onCopy }) {
  const [openNodes, setOpenNodes] = useState(new Set());

  const toggleNode = (nodeId) => {
    setOpenNodes(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  const nodeResults = run.node_results || [];

  return (
    <div className="border rounded-lg bg-white" data-testid={`run-${run.id}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{run.pipeline_name}</span>
          <span className="text-xs text-slate-400 ml-2">
            {formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: ru })}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => onCopy(run)}
          data-testid={`copy-run-${run.id}`}>
          <Copy className="w-3 h-3" /> Копировать
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(run.id)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="divide-y">
        {nodeResults.map((nr, idx) => {
          const isOpen = openNodes.has(nr.node_id);
          const outputStr = typeof nr.output === 'string' ? nr.output :
            Array.isArray(nr.output) ? nr.output.join('\n\n---\n\n') :
            JSON.stringify(nr.output, null, 2);

          return (
            <Collapsible key={nr.node_id} open={isOpen} onOpenChange={() => toggleNode(nr.node_id)}>
              <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                  {nr.type === 'ai_prompt' ? 'AI' : nr.type === 'aggregate' ? 'Сборка' : nr.type}
                </Badge>
                <span className="text-sm font-medium truncate">{nr.label}</span>
                <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                  {outputStr ? `${Math.min(outputStr.length, 9999)} сим.` : ''}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto"
                    data-testid={`run-node-output-${nr.node_id}`}>
                    {outputStr || '(пусто)'}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1.5 h-6 px-2 text-[10px] gap-1 text-slate-400"
                    onClick={() => { navigator.clipboard.writeText(outputStr); toast.success('Скопировано'); }}>
                    <Copy className="w-3 h-3" /> Копировать шаг
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function DocProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlDialog, setUrlDialog] = useState({ open: false, url: '', name: '' });

  // Pipelines & Runs
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [runs, setRuns] = useState([]);
  const [running, setRunning] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const res = await docProjectsApi.get(projectId);
      setProject(res.data);
    } catch {
      toast.error('Проект не найден');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await docRunsApi.list(projectId);
      setRuns(res.data);
    } catch { /* ignore */ }
  }, [projectId]);

  const loadPipelines = useCallback(async () => {
    try {
      const res = await pipelinesApi.list();
      setPipelines(res.data);
      if (res.data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(res.data[0].id);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadProject();
    loadRuns();
    loadPipelines();
  }, [loadProject, loadRuns, loadPipelines]);

  // File upload
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) { await docAttachmentsApi.upload(projectId, file); }
      toast.success(`Загружено: ${files.length}`);
      loadProject();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка загрузки'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleAddUrl = async () => {
    if (!urlDialog.url.trim()) return;
    try {
      await docAttachmentsApi.addUrl(projectId, urlDialog.url, urlDialog.name || null);
      toast.success('Ссылка добавлена');
      setUrlDialog({ open: false, url: '', name: '' });
      loadProject();
    } catch { toast.error('Ошибка'); }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try { await docAttachmentsApi.delete(projectId, attachmentId); loadProject(); }
    catch { toast.error('Ошибка'); }
  };

  // Run pipeline
  const handleRunPipeline = async () => {
    if (!selectedPipelineId || running) return;
    setRunning(true);
    try {
      const res = await docRunsApi.run(projectId, selectedPipelineId);
      setRuns(prev => [res.data, ...prev]);
      toast.success('Анализ завершён');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка выполнения');
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteRun = async (runId) => {
    try {
      await docRunsApi.delete(projectId, runId);
      setRuns(prev => prev.filter(r => r.id !== runId));
    } catch { toast.error('Ошибка'); }
  };

  const handleCopyRun = (run) => {
    const parts = (run.node_results || []).map(nr => {
      const out = typeof nr.output === 'string' ? nr.output :
        Array.isArray(nr.output) ? nr.output.join('\n\n---\n\n') :
        JSON.stringify(nr.output, null, 2);
      return `## ${nr.label}\n\n${out}`;
    });
    navigator.clipboard.writeText(parts.join('\n\n---\n\n'));
    toast.success('Результаты скопированы');
  };

  if (loading) {
    return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }
  if (!project) return null;

  const attachments = project.attachments || [];
  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-4 py-2 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/documents')} data-testid="back-to-documents">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate" data-testid="project-title">{project.name}</h1>
              {project.description && <p className="text-xs text-muted-foreground truncate">{project.description}</p>}
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {project.status === 'draft' ? 'Черновик' : project.status === 'in_progress' ? 'В работе' : project.status === 'completed' ? 'Готов' : project.status}
            </Badge>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Materials */}
          <MaterialsPanel attachments={attachments} uploading={uploading}
            onUpload={handleFileUpload}
            onAddUrl={() => setUrlDialog({ open: true, url: '', name: '' })}
            onDelete={handleDeleteAttachment} />

          {/* Center: Pipeline Runner + Results */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Pipeline selector + Run button */}
            <div className="bg-white border-b px-4 py-3">
              <div className="flex items-center gap-3 max-w-3xl">
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="flex-1 h-9" data-testid="pipeline-select">
                    <SelectValue placeholder="Выберите сценарий анализа" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.description && <span className="text-xs text-slate-400 truncate max-w-[200px]">— {p.description}</span>}
                        </div>
                      </SelectItem>
                    ))}
                    {pipelines.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Нет сценариев. Создайте в Конструкторе.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRunPipeline}
                  disabled={!selectedPipelineId || running || attachments.length === 0}
                  className="gap-2 shrink-0"
                  data-testid="run-pipeline-btn"
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {running ? 'Выполнение...' : 'Запустить'}
                </Button>
              </div>
              {attachments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Загрузите материалы перед запуском анализа
                </p>
              )}
            </div>

            {/* Results */}
            <ScrollArea className="flex-1">
              <div className="p-4 max-w-3xl mx-auto space-y-4">
                {running && (
                  <div className="border rounded-lg bg-indigo-50 p-6 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-indigo-700">Выполняется анализ...</p>
                    <p className="text-xs text-indigo-500 mt-1">AI обрабатывает документы по выбранному сценарию</p>
                  </div>
                )}

                {runs.length === 0 && !running && (
                  <div className="text-center py-16">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-medium text-slate-500 mb-1">Нет результатов анализа</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Загрузите материалы, выберите сценарий и нажмите "Запустить" для автоматического анализа документов
                    </p>
                  </div>
                )}

                {runs.map(run => (
                  <RunResultCard key={run.id} run={run} onDelete={handleDeleteRun} onCopy={handleCopyRun} />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* URL Dialog */}
      <Dialog open={urlDialog.open} onOpenChange={(open) => !open && setUrlDialog({ ...urlDialog, open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Добавить ссылку</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="https://..." value={urlDialog.url}
              onChange={(e) => setUrlDialog({ ...urlDialog, url: e.target.value })} autoFocus data-testid="url-input" />
            <Input placeholder="Название (опционально)" value={urlDialog.name}
              onChange={(e) => setUrlDialog({ ...urlDialog, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()} data-testid="url-name-input" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setUrlDialog({ ...urlDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleAddUrl} disabled={!urlDialog.url.trim()} data-testid="url-save-btn">Добавить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
