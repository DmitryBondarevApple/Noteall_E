import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import {
  Sparkles,
  Play,
  Pause,
  Check,
  ChevronRight,
  ChevronLeft,
  List,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Copy,
  Download,
  Save,
  RotateCcw,
  FileType,
  File,
  Workflow
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { chatApi, exportApi, pipelinesApi } from '../../lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const STEPS = [
  { id: 'setup', title: 'Настройка', icon: Sparkles },
  { id: 'topics', title: 'Темы', icon: List },
  { id: 'analysis', title: 'Анализ', icon: FileText },
  { id: 'result', title: 'Результат', icon: Check },
];

export function FullAnalysisTab({ projectId, processedTranscript, onSaveResult }) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Step 1: Setup
  const [meetingSubject, setMeetingSubject] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loadingPipelines, setLoadingPipelines] = useState(true);

  // Load available pipelines
  useEffect(() => {
    (async () => {
      try {
        const res = await pipelinesApi.list();
        setPipelines(res.data);
        if (res.data.length > 0) {
          setSelectedPipelineId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load pipelines:', err);
      } finally {
        setLoadingPipelines(false);
      }
    })();
  }, []);
  
  // Step 2: Topics
  const [topics, setTopics] = useState([]);
  const [editingTopicIndex, setEditingTopicIndex] = useState(null);
  const [newTopicText, setNewTopicText] = useState('');
  
  // Step 3: Analysis
  const [batchSize, setBatchSize] = useState(3);
  const [analysisResults, setAnalysisResults] = useState([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
  // Step 4: Result
  const [finalDocument, setFinalDocument] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [isEditingResult, setIsEditingResult] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset wizard
  const resetWizard = () => {
    setCurrentStep(0);
    setIsProcessing(false);
    setIsPaused(false);
    setMeetingSubject('');
    setTopics([]);
    setAnalysisResults([]);
    setCurrentBatch(0);
    setAnalysisProgress(0);
    setFinalDocument('');
    setShortSummary('');
    setIsEditingResult(false);
  };

  // Step 1: Start analysis - extract topics
  const extractTopics = async () => {
    if (!meetingSubject.trim()) {
      toast.error('Введите предмет обсуждения');
      return;
    }
    
    setIsProcessing(true);
    try {
      const prompt = `Данный текст является транскриптом встречи для "${meetingSubject}".
Составь общий список обсужденных тем.
Выдай только нумерованный список тем, без дополнительных пояснений.
Формат: 
1. Тема
2. Тема
...`;

      const response = await chatApi.analyzeRaw(projectId, {
        system_message: 'Ты — ассистент для анализа встреч. Выдавай только запрошенную информацию без лишних комментариев.',
        user_message: prompt,
        reasoning_effort: 'medium'
      });
      
      // Parse topics from response
      const lines = response.data.response_text.split('\n');
      const parsedTopics = lines
        .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(line => line.length > 0);
      
      setTopics(parsedTopics.map((text, index) => ({ id: index, text, selected: true })));
      setCurrentStep(1);
      toast.success(`Найдено ${parsedTopics.length} тем`);
    } catch (error) {
      toast.error('Ошибка извлечения тем');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Edit topics
  const toggleTopic = (index) => {
    setTopics(topics.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const updateTopic = (index, newText) => {
    setTopics(topics.map((t, i) => i === index ? { ...t, text: newText } : t));
    setEditingTopicIndex(null);
  };

  const deleteTopic = (index) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const addTopic = () => {
    if (newTopicText.trim()) {
      setTopics([...topics, { id: Date.now(), text: newTopicText.trim(), selected: true }]);
      setNewTopicText('');
    }
  };

  // Step 3: Analyze topics in batches
  const startAnalysis = async () => {
    const selectedTopics = topics.filter(t => t.selected);
    if (selectedTopics.length === 0) {
      toast.error('Выберите хотя бы одну тему');
      return;
    }
    
    setCurrentStep(2);
    setAnalysisResults([]);
    setCurrentBatch(0);
    setIsPaused(false);
    
    await runAnalysisBatches(selectedTopics, 0);
  };

  const runAnalysisBatches = async (selectedTopics, startBatch) => {
    const effectiveBatchSize = batchSize === 0 ? selectedTopics.length : batchSize;
    const totalBatches = Math.ceil(selectedTopics.length / effectiveBatchSize);
    
    setIsProcessing(true);
    
    for (let batch = startBatch; batch < totalBatches; batch++) {
      if (isPaused) {
        setCurrentBatch(batch);
        setIsProcessing(false);
        return;
      }
      
      const start = batch * effectiveBatchSize;
      const end = Math.min(start + effectiveBatchSize, selectedTopics.length);
      const batchTopics = selectedTopics.slice(start, end);
      
      const topicsList = batchTopics.map((t, i) => `${start + i + 1}. ${t.text}`).join('\n');
      
      const isLast = end >= selectedTopics.length;
      const prompt = batch === 0 
        ? `Сделай анализ следующих тем:
${topicsList}

Строй предложения не от чьего-то имени, а в безличной форме - излагаем факты.
Формат: в заголовке пишем краткое описание темы, булитные списки внутри тем не нужны - пишем просто отдельными абзацами.`
        : `Продолжай анализ следующих тем:
${topicsList}

Строй предложения не от чьего-то имени, а в безличной форме - излагаем факты.
Формат: в заголовке пишем краткое описание темы, булитные списки внутри тем не нужны - пишем просто отдельными абзацами.`;

      try {
        const response = await chatApi.analyzeRaw(projectId, {
          system_message: `Ты анализируешь транскрипт встречи по теме "${meetingSubject}". Анализируй только указанные темы, используя информацию из транскрипта.`,
          user_message: prompt,
          reasoning_effort: 'high'
        });
        
        setAnalysisResults(prev => [...prev, {
          batch,
          topics: batchTopics.map(t => t.text),
          content: response.data.response_text
        }]);
        
        setAnalysisProgress(Math.round((end / selectedTopics.length) * 100));
        setCurrentBatch(batch + 1);
        
      } catch (error) {
        toast.error(`Ошибка анализа тем ${start + 1}-${end}`);
        console.error(error);
        setIsProcessing(false);
        return;
      }
    }
    
    setIsProcessing(false);
    toast.success('Анализ тем завершён');
  };

  const pauseAnalysis = () => {
    setIsPaused(true);
  };

  const resumeAnalysis = () => {
    const selectedTopics = topics.filter(t => t.selected);
    setIsPaused(false);
    runAnalysisBatches(selectedTopics, currentBatch);
  };

  // Step 4: Build final document and generate summary
  const buildFinalDocument = async () => {
    setIsProcessing(true);
    setCurrentStep(3);
    
    // Assemble document from analysis results (script, no AI)
    const detailedAnalysis = analysisResults.map(r => r.content).join('\n\n');
    
    // Generate short summary with AI
    try {
      const summaryPrompt = `На основе следующего подробного анализа встречи по теме "${meetingSubject}":

${detailedAnalysis}

Сделай общее резюме наиболее существенных с точки зрения ключевой цели тем, итоговый вывод о чем договорились и план дальнейших шагов.
Формат: краткий связный текст без списков.`;

      const response = await chatApi.analyzeRaw(projectId, {
        system_message: 'Ты — ассистент для создания резюме встреч. Пиши кратко и по существу.',
        user_message: summaryPrompt,
        reasoning_effort: 'high'
      });
      
      setShortSummary(response.data.response_text);
      
      // Build final document
      const document = `# Резюме встречи: ${meetingSubject}

## Краткое саммари

${response.data.response_text}

---

## Подробный анализ по темам

${detailedAnalysis}`;
      
      setFinalDocument(document);
      toast.success('Документ готов!');
      
    } catch (error) {
      toast.error('Ошибка генерации резюме');
      console.error(error);
      
      // Still show the detailed analysis even if summary failed
      const document = `# Резюме встречи: ${meetingSubject}

## Подробный анализ по темам

${detailedAnalysis}`;
      
      setFinalDocument(document);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save final result
  const saveResult = async () => {
    setIsSaving(true);
    try {
      await chatApi.saveFullAnalysis(projectId, {
        subject: meetingSubject,
        content: finalDocument
      });
      
      onSaveResult?.(finalDocument);
      toast.success('Результат сохранён');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalDocument);
    toast.success('Скопировано в буфер обмена');
  };

  // Download as file
  const downloadAsFile = () => {
    const blob = new Blob([finalDocument], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-summary-${meetingSubject.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Файл скачан');
  };

  // Download as Word
  const downloadAsWord = async () => {
    try {
      const filename = `meeting-summary-${meetingSubject.replace(/\s+/g, '-').toLowerCase()}`;
      const response = await exportApi.toWord(finalDocument, filename);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Word документ скачан');
    } catch (error) {
      console.error('Word export error:', error);
      toast.error('Ошибка экспорта в Word');
    }
  };

  // Download as PDF
  const downloadAsPdf = async () => {
    try {
      const filename = `meeting-summary-${meetingSubject.replace(/\s+/g, '-').toLowerCase()}`;
      const response = await exportApi.toPdf(finalDocument, filename);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF документ скачан');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Ошибка экспорта в PDF');
    }
  };

  // Check if can proceed to next step
  const canProceed = () => {
    switch (currentStep) {
      case 0: return meetingSubject.trim().length > 0;
      case 1: return topics.some(t => t.selected);
      case 2: return analysisResults.length > 0 && !isProcessing;
      default: return false;
    }
  };

  const selectedTopicsCount = topics.filter(t => t.selected).length;
  const effectiveBatchSize = batchSize === 0 ? selectedTopicsCount : batchSize;
  const totalBatches = selectedTopicsCount > 0 ? Math.ceil(selectedTopicsCount / effectiveBatchSize) : 0;

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-4">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div 
              className={`flex items-center gap-2 ${
                index === currentStep 
                  ? 'text-indigo-600' 
                  : index < currentStep 
                    ? 'text-green-600' 
                    : 'text-slate-400'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                index === currentStep 
                  ? 'bg-indigo-100' 
                  : index < currentStep 
                    ? 'bg-green-100' 
                    : 'bg-slate-100'
              }`}>
                {index < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <step.icon className="w-4 h-4" />
                )}
              </div>
              <span className="font-medium hidden sm:inline">{step.title}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${
                index < currentStep ? 'bg-green-300' : 'bg-slate-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 0: Setup */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Настройка анализа</h2>
                <p className="text-muted-foreground">
                  Укажите ключевую тему встречи для более точного анализа
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Предмет обсуждения *</Label>
                <Input
                  id="subject"
                  value={meetingSubject}
                  onChange={(e) => setMeetingSubject(e.target.value)}
                  placeholder="Например: разработка нового продукта, квартальное планирование..."
                  data-testid="meeting-subject-input"
                />
              </div>
              
              <Button 
                onClick={extractTopics} 
                disabled={!canProceed() || isProcessing}
                className="gap-2"
                data-testid="extract-topics-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Извлечение тем...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Извлечь темы из транскрипта
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 1: Topics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Список тем</h2>
                  <p className="text-muted-foreground">
                    Проверьте и отредактируйте темы. Выбрано: {selectedTopicsCount} из {topics.length}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep(0)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Назад
                </Button>
              </div>
              
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-2">
                  {topics.map((topic, index) => (
                    <div 
                      key={topic.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        topic.selected ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Checkbox
                        checked={topic.selected}
                        onCheckedChange={() => toggleTopic(index)}
                      />
                      
                      {editingTopicIndex === index ? (
                        <Input
                          value={topic.text}
                          onChange={(e) => updateTopic(index, e.target.value)}
                          onBlur={() => setEditingTopicIndex(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingTopicIndex(null)}
                          autoFocus
                          className="flex-1"
                        />
                      ) : (
                        <span className="flex-1">{index + 1}. {topic.text}</span>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingTopicIndex(index)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => deleteTopic(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {/* Add new topic */}
              <div className="flex gap-2">
                <Input
                  value={newTopicText}
                  onChange={(e) => setNewTopicText(e.target.value)}
                  placeholder="Добавить тему..."
                  onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                />
                <Button variant="outline" onClick={addTopic} disabled={!newTopicText.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Batch size setting */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <Label className="whitespace-nowrap">Тем за раз:</Label>
                <Input
                  type="number"
                  min={0}
                  max={topics.length}
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 0)}
                  className="w-20"
                  data-testid="batch-size-input"
                />
                <span className="text-sm text-muted-foreground">
                  {batchSize === 0 ? 'Все сразу' : `${totalBatches} ${totalBatches === 1 ? 'запрос' : 'запросов'}`}
                </span>
              </div>
              
              <Button 
                onClick={startAnalysis} 
                disabled={!canProceed()}
                className="gap-2"
                data-testid="start-analysis-btn"
              >
                <Play className="w-4 h-4" />
                Начать анализ
              </Button>
            </div>
          )}

          {/* Step 2: Analysis */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Анализ по темам</h2>
                  <p className="text-muted-foreground">
                    {isProcessing 
                      ? `Анализ тем ${currentBatch * effectiveBatchSize + 1}-${Math.min((currentBatch + 1) * effectiveBatchSize, selectedTopicsCount)} из ${selectedTopicsCount}...`
                      : `Проанализировано ${analysisResults.length} из ${totalBatches} порций`
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  {isProcessing && !isPaused && (
                    <Button variant="outline" size="sm" onClick={pauseAnalysis}>
                      <Pause className="w-4 h-4 mr-1" />
                      Пауза
                    </Button>
                  )}
                  {isPaused && (
                    <Button variant="outline" size="sm" onClick={resumeAnalysis}>
                      <Play className="w-4 h-4 mr-1" />
                      Продолжить
                    </Button>
                  )}
                </div>
              </div>
              
              <Progress value={analysisProgress} className="h-2" />
              
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-6">
                  {analysisResults.map((result, index) => (
                    <div key={index} className="space-y-2">
                      <Badge variant="outline">
                        Темы: {result.topics.join(', ')}
                      </Badge>
                      <div className="prose prose-sm max-w-none">
                        <Markdown>{result.content}</Markdown>
                      </div>
                      {index < analysisResults.length - 1 && <hr />}
                    </div>
                  ))}
                  
                  {isProcessing && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {!isProcessing && analysisResults.length === totalBatches && (
                <Button 
                  onClick={buildFinalDocument}
                  className="gap-2"
                  data-testid="build-document-btn"
                >
                  <FileText className="w-4 h-4" />
                  Собрать итоговый документ
                </Button>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Итоговый документ</h2>
                  <p className="text-muted-foreground">
                    Проверьте и при необходимости отредактируйте результат
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingResult(!isEditingResult)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    {isEditingResult ? 'Просмотр' : 'Редактировать'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetWizard}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Начать заново
                  </Button>
                </div>
              </div>
              
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                  <p className="text-muted-foreground">Генерация краткого резюме...</p>
                </div>
              ) : isEditingResult ? (
                <Textarea
                  value={finalDocument}
                  onChange={(e) => setFinalDocument(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  data-testid="final-document-textarea"
                />
              ) : (
                <ScrollArea className="h-[500px] border rounded-lg p-6 bg-white">
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{finalDocument}</Markdown>
                  </div>
                </ScrollArea>
              )}
              
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={copyToClipboard} variant="outline" className="gap-2">
                  <Copy className="w-4 h-4" />
                  Копировать
                </Button>
                <Button onClick={downloadAsFile} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  .md
                </Button>
                <Button onClick={downloadAsWord} variant="outline" className="gap-2">
                  <FileType className="w-4 h-4" />
                  Word
                </Button>
                <Button onClick={downloadAsPdf} variant="outline" className="gap-2">
                  <File className="w-4 h-4" />
                  PDF
                </Button>
                <Button onClick={saveResult} disabled={isSaving} className="gap-2 ml-auto">
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Сохранить в историю
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
