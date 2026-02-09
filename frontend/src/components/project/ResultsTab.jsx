import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import {
  Archive,
  Sparkles,
  Loader2,
  Pencil,
  Trash2,
  Copy,
  Download,
  FileType,
  File,
  Save,
  ChevronLeft,
  Play,
  FileText,
  Workflow,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { chatApi, exportApi, promptsApi, pipelinesApi } from '../../lib/api';

export function ResultsTab({ projectId, selectedReasoningEffort }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewingResult, setViewingResult] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(null); // 'prompt' | 'pipeline'
  const [prompts, setPrompts] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');

  const loadResults = useCallback(async () => {
    try {
      const res = await chatApi.analysisResults(projectId);
      setResults(res.data);
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadResults(); }, [loadResults]);

  // Load prompts and pipelines for analysis
  useEffect(() => {
    Promise.all([
      promptsApi.list().catch(() => ({ data: [] })),
      pipelinesApi.list().catch(() => ({ data: [] })),
    ]).then(([promptsRes, pipelinesRes]) => {
      setPrompts(promptsRes.data);
      setPipelines(pipelinesRes.data);
    });
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.id)));
    }
  };

  const openResult = (result) => {
    setViewingResult(result);
    setEditText(result.response_text);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!viewingResult) return;
    setSaving(true);
    try {
      await chatApi.updateResponse(projectId, viewingResult.id, editText);
      setViewingResult({ ...viewingResult, response_text: editText });
      setResults((prev) =>
        prev.map((r) => (r.id === viewingResult.id ? { ...r, response_text: editText } : r))
      );
      setIsEditing(false);
      toast.success('Сохранено');
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await chatApi.deleteChat(projectId, id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (viewingResult?.id === id) setViewingResult(null);
      toast.success('Удалено');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано');
  };

  const downloadMd = (text, name) => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'result'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWord = async (text, name) => {
    try {
      const res = await exportApi.toWord(text, name || 'result');
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'result'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Ошибка экспорта'); }
  };

  const downloadPdf = async (text, name) => {
    try {
      const res = await exportApi.toPdf(text, name || 'result');
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'result'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Ошибка экспорта'); }
  };

  // Run analysis on selected results
  const handleAnalyze = async () => {
    const selected = results.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) return;

    const sourceText = selected.map((r) => r.response_text).join('\n\n---\n\n');

    if (analysisMode === 'prompt' && selectedPromptId) {
      setAnalyzing(true);
      try {
        const prompt = prompts.find((p) => p.id === selectedPromptId);
        const promptText = prompt?.content || prompt?.prompt_text || '';

        const response = await chatApi.analyzeRaw(projectId, {
          system_message: 'Ты — ассистент для анализа документов. Отвечай подробно и по существу.',
          user_message: `${promptText}\n\n---\n\nТекст для анализа:\n\n${sourceText}`,
          reasoning_effort: selectedReasoningEffort || 'high',
        });

        // Save the result
        await chatApi.saveFullAnalysis(projectId, {
          subject: `Анализ: ${prompt?.title || prompt?.name || 'промпт'}`,
          content: response.data.response_text,
        });

        await loadResults();
        setSelectedIds(new Set());
        setAnalysisMode(null);
        toast.success('Анализ завершён и сохранён');
      } catch (err) {
        toast.error('Ошибка анализа: ' + (err.response?.data?.detail || err.message));
      } finally {
        setAnalyzing(false);
      }
    }
  };

  // =================== RENDER ===================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Viewing a single result
  if (viewingResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setViewingResult(null)} data-testid="back-to-results-btn">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Назад к результатам
          </Button>
          <div className="flex-1" />
          <div className="flex gap-1.5">
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="edit-result-btn">
                <Pencil className="w-4 h-4 mr-1" />
                Редактировать
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Отмена</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} data-testid="save-edit-btn">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Сохранить
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold" data-testid="result-title">{viewingResult.prompt_content}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{formatDate(viewingResult.created_at)}</span>
                {viewingResult.pipeline_name && (
                  <Badge variant="outline" className="text-xs">
                    <Workflow className="w-3 h-3 mr-1" />
                    {viewingResult.pipeline_name}
                  </Badge>
                )}
              </div>
            </div>

            {isEditing ? (
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                data-testid="result-edit-textarea"
              />
            ) : (
              <ScrollArea className="h-[500px] border rounded-lg p-6 bg-white">
                <div className="prose prose-sm max-w-none">
                  <Markdown>{viewingResult.response_text}</Markdown>
                </div>
              </ScrollArea>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(viewingResult.response_text)} data-testid="result-copy-btn">
                <Copy className="w-4 h-4 mr-1" /> Копировать
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadMd(viewingResult.response_text, 'result')}>
                <Download className="w-4 h-4 mr-1" /> .md
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadWord(viewingResult.response_text, 'result')}>
                <FileType className="w-4 h-4 mr-1" /> Word
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadPdf(viewingResult.response_text, 'result')}>
                <File className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Results list
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" data-testid="results-title">Результаты анализов</h2>
          <p className="text-sm text-muted-foreground">
            {results.length > 0
              ? `${results.length} ${pluralize(results.length, 'результат', 'результата', 'результатов')}`
              : 'Здесь будут храниться результаты мастер-анализа'}
          </p>
        </div>
      </div>

      {/* Action bar (when items selected) */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="shrink-0">
              <Check className="w-3 h-3 mr-1" />
              Выбрано: {selectedIds.size}
            </Badge>

            {!analysisMode ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAnalysisMode('prompt')}
                  className="gap-1.5"
                  data-testid="analyze-with-prompt-btn"
                >
                  <Sparkles className="w-4 h-4" />
                  Анализ по промпту
                </Button>
                {/* Pipeline analysis can be added later */}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                {analysisMode === 'prompt' && (
                  <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                    <SelectTrigger className="h-8 text-xs flex-1 max-w-[300px]" data-testid="analysis-prompt-select">
                      <SelectValue placeholder="Выберите промпт..." />
                    </SelectTrigger>
                    <SelectContent>
                      {prompts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzing || (analysisMode === 'prompt' && !selectedPromptId)}
                  className="gap-1.5 shrink-0"
                  data-testid="run-analysis-btn"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Запустить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAnalysisMode(null)}>
                  Отмена
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results list */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Archive className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Пока нет результатов анализа</p>
            <p className="text-xs text-muted-foreground mt-1">
              Запустите мастер-анализ на вкладке «Мастер» — результаты появятся здесь
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select all */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={selectedIds.size === results.length && results.length > 0}
              onCheckedChange={selectAll}
              data-testid="select-all-results"
            />
            <span className="text-xs text-muted-foreground">Выбрать все</span>
          </div>

          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              isSelected={selectedIds.has(result.id)}
              onToggleSelect={() => toggleSelect(result.id)}
              onOpen={() => openResult(result)}
              onDelete={() => handleDelete(result.id)}
              onCopy={() => copyToClipboard(result.response_text)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =================== SUB-COMPONENTS ===================

function ResultCard({ result, isSelected, onToggleSelect, onOpen, onDelete, onCopy }) {
  const preview = (result.response_text || '').slice(0, 200).replace(/[#*_`]/g, '');
  const isMaster = result.prompt_id === 'full-analysis';

  return (
    <Card
      className={`transition-colors cursor-pointer hover:border-indigo-300 ${isSelected ? 'border-indigo-400 bg-indigo-50/50' : ''}`}
      data-testid={`result-card-${result.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
            />
          </div>

          <div className="flex-1 min-w-0" onClick={onOpen}>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{result.prompt_content}</h4>
              {isMaster && (
                <Badge variant="outline" className="text-[10px] shrink-0">Мастер</Badge>
              )}
              {result.prompt_id === 'result-analysis' && (
                <Badge variant="secondary" className="text-[10px] shrink-0">Ре-анализ</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{preview}...</p>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
              <span>{formatDate(result.created_at)}</span>
              {result.pipeline_name && (
                <span className="flex items-center gap-0.5">
                  <Workflow className="w-3 h-3" />
                  {result.pipeline_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} title="Копировать">
              <Copy className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title="Удалить">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить результат?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Результат анализа будет удалён безвозвратно.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-btn">
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helpers

function formatDate(isoStr) {
  try {
    return formatDistanceToNow(new Date(isoStr), { addSuffix: true, locale: ru });
  } catch {
    return isoStr;
  }
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
