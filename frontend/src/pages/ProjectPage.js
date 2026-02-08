import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  projectsApi,
  transcriptsApi,
  fragmentsApi,
  speakersApi,
  chatApi,
  promptsApi
} from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  ArrowLeft,
  Upload,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  MessageSquare,
  FileText,
  Sparkles,
  Clock,
  Mic,
  Play,
  Check,
  X,
  Send,
  History,
  Pencil,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import Markdown from 'react-markdown';
import { ru } from 'date-fns/locale';

const statusConfig = {
  new: { label: 'Новый', color: 'bg-slate-100 text-slate-700' },
  transcribing: { label: 'Транскрибация...', color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Обработка...', color: 'bg-indigo-100 text-indigo-700' },
  needs_review: { label: 'Требует проверки', color: 'bg-orange-100 text-orange-700' },
  ready: { label: 'Готов к анализу', color: 'bg-green-100 text-green-700' },
  error: { label: 'Ошибка', color: 'bg-red-100 text-red-700' }
};

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [fragments, setFragments] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [dragActive, setDragActive] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [additionalText, setAdditionalText] = useState('');
  const [activeTab, setActiveTab] = useState('transcript');
  const [editingFragment, setEditingFragment] = useState(null);
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('ru');
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState('high');
  const [isEditingProcessed, setIsEditingProcessed] = useState(false);
  const [editProcessedText, setEditProcessedText] = useState('');
  const [savingProcessed, setSavingProcessed] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editChatText, setEditChatText] = useState('');
  const [savingChat, setSavingChat] = useState(false);
  const processedScrollRef = useRef(null);

  const languageOptions = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'fr', label: 'Français' },
    { value: 'es', label: 'Español' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'pl', label: 'Polski' },
    { value: 'uk', label: 'Українська' },
  ];

  const reasoningEffortOptions = [
    { value: 'auto', label: 'Auto', description: 'Автоматический выбор' },
    { value: 'minimal', label: 'Minimal', description: 'Быстрый ответ' },
    { value: 'low', label: 'Low', description: 'Лёгкий анализ' },
    { value: 'medium', label: 'Medium', description: 'Средний анализ' },
    { value: 'high', label: 'High', description: 'Глубокий анализ' },
    { value: 'xhigh', label: 'Deep Thinking', description: 'Максимальный анализ' },
  ];

  const loadData = useCallback(async () => {
    try {
      const [projectRes, transcriptsRes, fragmentsRes, speakersRes, promptsRes, chatRes] = await Promise.all([
        projectsApi.get(projectId),
        transcriptsApi.list(projectId).catch(() => ({ data: [] })),
        fragmentsApi.list(projectId).catch(() => ({ data: [] })),
        speakersApi.list(projectId).catch(() => ({ data: [] })),
        promptsApi.list({ project_id: projectId }),
        chatApi.history(projectId).catch(() => ({ data: [] }))
      ]);

      setProject(projectRes.data);
      setTranscripts(transcriptsRes.data);
      setFragments(fragmentsRes.data);
      setSpeakers(speakersRes.data);
      setPrompts(promptsRes.data);
      setChatHistory(chatRes.data);
    } catch (error) {
      toast.error('Ошибка загрузки проекта');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for status updates when transcribing/processing
  useEffect(() => {
    if (project?.status === 'transcribing' || project?.status === 'processing') {
      const interval = setInterval(async () => {
        try {
          const res = await projectsApi.get(projectId);
          setProject(res.data);
          if (res.data.status !== 'transcribing' && res.data.status !== 'processing') {
            setProcessing(false);
            loadData();
            if (res.data.status === 'ready') {
              toast.success('Обработка завершена');
              setActiveTab('processed');
            }
          }
        } catch (e) {}
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.status, projectId, loadData]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      await handleUpload(files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file);
    }
  };

  const handleUpload = async (file) => {
    const allowedTypes = ['audio/', 'video/'];
    if (!allowedTypes.some(type => file.type.startsWith(type))) {
      toast.error('Поддерживаются только аудио и видео файлы');
      return;
    }

    setUploading(true);
    try {
      await projectsApi.upload(projectId, file, selectedLanguage, selectedReasoningEffort);
      toast.success('Файл загружен, начинается транскрибация');
      // Update project status to trigger polling
      setProject(prev => ({ ...prev, status: 'transcribing' }));
    } catch (error) {
      toast.error('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmFragment = async (fragment, correctedText) => {
    try {
      await fragmentsApi.update(projectId, fragment.id, {
        corrected_text: correctedText,
        status: 'confirmed'
      });
      setFragments(fragments.map(f => 
        f.id === fragment.id ? { ...f, corrected_text: correctedText, status: 'confirmed' } : f
      ));
      setEditingFragment(null);

      // Apply correction to processed transcript
      const processed = getTranscript('processed');
      if (processed) {
        const word = fragment.original_text;
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\[+${escaped}\\?+\\]+`, 'g');
        const updatedContent = processed.content.replace(pattern, correctedText);
        if (updatedContent !== processed.content) {
          setTranscripts(transcripts.map(t =>
            t.version_type === 'processed' ? { ...t, content: updatedContent } : t
          ));
          transcriptsApi.updateContent(projectId, 'processed', updatedContent).catch(() => {});
        }
      }

      toast.success('Фрагмент подтвержден');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleUpdateSpeaker = async (speaker, newName) => {
    try {
      await speakersApi.update(projectId, speaker.id, {
        speaker_label: speaker.speaker_label,
        speaker_name: newName
      });
      setSpeakers(speakers.map(s =>
        s.id === speaker.id ? { ...s, speaker_name: newName } : s
      ));
      setEditingSpeaker(null);
      toast.success('Спикер обновлен');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleConfirmTranscript = async () => {
    setConfirming(true);
    try {
      await transcriptsApi.confirm(projectId);
      toast.success('Транскрипт подтвержден');
      loadData();
    } catch (error) {
      toast.error('Ошибка подтверждения');
    } finally {
      setConfirming(false);
    }
  };

  const handleProcessWithGPT = async () => {
    setProcessing(true);
    try {
      await transcriptsApi.process(projectId);
      toast.success('Обработка запущена. Ожидайте завершения...');
      // Update project status in state to trigger polling useEffect
      setProject(prev => ({ ...prev, status: 'processing' }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка запуска обработки');
      setProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedPrompt) {
      toast.error('Выберите промпт для анализа');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await chatApi.analyze(projectId, {
        prompt_id: selectedPrompt,
        additional_text: additionalText,
        reasoning_effort: selectedReasoningEffort
      });
      setChatHistory([...chatHistory, response.data]);
      setAdditionalText('');
      toast.success('Анализ завершен');
    } catch (error) {
      toast.error('Ошибка анализа');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartEditProcessed = () => {
    const processed = getTranscript('processed');
    if (processed) {
      // Capture inner scroll position from ScrollArea viewport
      const viewport = processedScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      const innerScroll = viewport?.scrollTop || 0;
      setEditProcessedText(processed.content);
      setIsEditingProcessed(true);
      // Restore scroll position in the textarea after render
      requestAnimationFrame(() => {
        const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
        if (textarea) textarea.scrollTop = innerScroll;
      });
    }
  };

  const handleSaveProcessed = async () => {
    const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
    const innerScroll = textarea?.scrollTop || 0;
    setSavingProcessed(true);
    try {
      await transcriptsApi.updateContent(projectId, 'processed', editProcessedText);
      setTranscripts(transcripts.map(t =>
        t.version_type === 'processed' ? { ...t, content: editProcessedText } : t
      ));
      setIsEditingProcessed(false);
      toast.success('Текст сохранён');
      requestAnimationFrame(() => {
        const viewport = processedScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = innerScroll;
      });
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setSavingProcessed(false);
    }
  };

  const handleCancelEditProcessed = () => {
    const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
    const innerScroll = textarea?.scrollTop || 0;
    setIsEditingProcessed(false);
    setEditProcessedText('');
    requestAnimationFrame(() => {
      const viewport = processedScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = innerScroll;
    });
  };

  const handleStartEditChat = (chat) => {
    setEditingChatId(chat.id);
    setEditChatText(chat.response_text);
  };

  const handleSaveChat = async () => {
    setSavingChat(true);
    try {
      await chatApi.updateResponse(projectId, editingChatId, editChatText);
      setChatHistory(chatHistory.map(c =>
        c.id === editingChatId ? { ...c, response_text: editChatText } : c
      ));
      setEditingChatId(null);
      setEditChatText('');
      toast.success('Текст сохранён');
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setSavingChat(false);
    }
  };

  const handleCancelEditChat = () => {
    setEditingChatId(null);
    setEditChatText('');
  };

  const getTranscript = (type) => transcripts.find(t => t.version_type === type);
  const currentTranscript = getTranscript('confirmed') || getTranscript('processed') || getTranscript('raw');
  const pendingFragments = fragments.filter(f => f.status === 'pending' || f.status === 'auto_corrected');
  const status = statusConfig[project?.status] || statusConfig.new;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" data-testid="back-to-dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight" data-testid="project-title">{project?.name}</h1>
              <p className="text-sm text-muted-foreground">{project?.description || 'Без описания'}</p>
            </div>
          </div>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Upload Section - Show only for new projects */}
        {project?.status === 'new' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Загрузите запись встречи
              </CardTitle>
              <CardDescription>
                Поддерживаются форматы: MP3, WAV, MP4, WEBM и другие аудио/видео файлы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Settings Row */}
              <div className="flex flex-wrap items-center gap-6">
                {/* Language Selection */}
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap text-sm">Язык:</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger className="w-40" data-testid="language-select">
                      <SelectValue placeholder="Выберите язык" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reasoning Effort Selection */}
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap text-sm">Режим GPT-5.2:</Label>
                  <Select value={selectedReasoningEffort} onValueChange={setSelectedReasoningEffort}>
                    <SelectTrigger className="w-48" data-testid="reasoning-select">
                      <SelectValue placeholder="Выберите режим" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasoningEffortOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dropzone */}
              <div
                className={`dropzone border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragActive ? 'active border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                data-testid="file-dropzone"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <FileAudio className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium mb-2">
                  Перетащите файл сюда или{' '}
                  <label className="text-indigo-600 hover:text-indigo-700 cursor-pointer">
                    выберите вручную
                    <input
                      type="file"
                      className="hidden"
                      accept="audio/*,video/*"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      data-testid="file-input"
                    />
                  </label>
                </p>
                <p className="text-sm text-muted-foreground">Максимальный размер: 500MB</p>
                {uploading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        {project?.status !== 'new' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="sticky top-[73px] z-40 bg-slate-50 py-2 -mx-6 px-6 flex items-center justify-between">
              <TabsList className="bg-white border p-1 shadow-sm">
                <TabsTrigger value="transcript" className="gap-2" data-testid="transcript-tab">
                  <FileText className="w-4 h-4" />
                  Транскрипт
                </TabsTrigger>
                <TabsTrigger value="processed" className="gap-2" data-testid="processed-tab">
                  <CheckCircle2 className="w-4 h-4" />
                  Обработанный текст
                </TabsTrigger>
                <TabsTrigger value="review" className="gap-2" data-testid="review-tab">
                  <AlertCircle className="w-4 h-4" />
                  Проверка
                  {pendingFragments.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                      {pendingFragments.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="speakers" className="gap-2" data-testid="speakers-tab">
                  <Users className="w-4 h-4" />
                  Спикеры
                </TabsTrigger>
                <TabsTrigger value="analysis" className="gap-2" data-testid="analysis-tab">
                  <Sparkles className="w-4 h-4" />
                  Анализ
                </TabsTrigger>
              </TabsList>
              
              {/* Process Button with Reasoning Selector */}
              <div className="flex items-center gap-3">
                <Select value={selectedReasoningEffort} onValueChange={setSelectedReasoningEffort}>
                  <SelectTrigger className="w-44 h-9 text-xs" data-testid="tab-reasoning-select">
                    <SelectValue placeholder="Режим GPT" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasoningEffortOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="text-xs">{opt.label} — {opt.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleProcessWithGPT}
                  disabled={processing || !getTranscript('raw')}
                  className="gap-2"
                  data-testid="process-btn"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Обработать
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Transcript Tab - Raw */}
            <TabsContent value="transcript">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Исходный транскрипт</CardTitle>
                    <CardDescription>
                      Результат распознавания от Deepgram (без обработки)
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {getTranscript('raw') ? (
                    <ScrollArea className="h-[500px] rounded-lg border p-6 bg-white">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans" data-testid="raw-transcript-content">
                        {applySpeakerNames(getTranscript('raw').content, speakers)}
                      </pre>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                      <p>Транскрибация в процессе...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Processed Tab */}
            <TabsContent value="processed">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Обработанный текст</CardTitle>
                    <CardDescription>
                      Результат обработки мастер-промптом через GPT-5.2
                    </CardDescription>
                  </div>
                  {getTranscript('processed') && !isEditingProcessed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleStartEditProcessed}
                      data-testid="edit-processed-btn"
                    >
                      <Pencil className="w-4 h-4" />
                      Редактировать
                    </Button>
                  )}
                  {isEditingProcessed && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEditProcessed}
                        data-testid="cancel-edit-processed-btn"
                      >
                        Отмена
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={handleSaveProcessed}
                        disabled={savingProcessed}
                        data-testid="save-processed-btn"
                      >
                        {savingProcessed ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Сохранить
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {getTranscript('processed') ? (
                    isEditingProcessed ? (
                      <Textarea
                        value={editProcessedText}
                        onChange={(e) => setEditProcessedText(e.target.value)}
                        className="min-h-[500px] font-sans text-sm leading-relaxed"
                        data-testid="edit-processed-textarea"
                      />
                    ) : (
                      <ScrollArea ref={processedScrollRef} className="h-[500px] rounded-lg border p-6 bg-white">
                        <div className="prose prose-sm max-w-none" data-testid="processed-transcript-content">
                          <Markdown>{prepareForMarkdown(applySpeakerNames(getTranscript('processed').content, speakers))}</Markdown>
                        </div>
                      </ScrollArea>
                    )
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Текст ещё не обработан</h3>
                      <p className="mb-6 max-w-md mx-auto">
                        Нажмите кнопку "Обработать" чтобы отправить транскрипт на обработку с вашим мастер-промптом
                      </p>
                      <Button
                        onClick={handleProcessWithGPT}
                        disabled={processing || !getTranscript('raw')}
                        className="gap-2"
                      >
                        {processing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Обработать текст
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Review Tab */}
            <TabsContent value="review">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Проверка сомнительных мест
                  </CardTitle>
                  <CardDescription>
                    Проверьте слова, в которых могут быть ошибки распознавания. 
                    {pendingFragments.length > 0 && (
                      <span className="font-medium text-orange-600"> Осталось проверить: {pendingFragments.length}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {fragments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-4 text-green-500" />
                      <p>Нет сомнительных фрагментов для проверки</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg text-sm">
                        <span>Всего: <strong>{fragments.length}</strong></span>
                        <span className="text-green-600">Проверено: <strong>{fragments.filter(f => f.status === 'confirmed').length}</strong></span>
                        {fragments.filter(f => f.status === 'auto_corrected').length > 0 && (
                          <span className="text-blue-600">Исправлено AI: <strong>{fragments.filter(f => f.status === 'auto_corrected').length}</strong></span>
                        )}
                        <span className="text-orange-600">Ожидает: <strong>{fragments.filter(f => f.status === 'pending').length}</strong></span>
                      </div>
                      
                      {/* Fragment cards */}
                      <div className="space-y-3">
                        {fragments.map((fragment, index) => {
                          const fullSentence = extractFullSentence(
                            getTranscript('processed')?.content || '',
                            fragment.original_text
                          );
                          return (
                          <Card 
                            key={fragment.id} 
                            className={`transition-all ${
                              fragment.status === 'confirmed' 
                                ? 'bg-green-50/50 border-green-200' 
                                : fragment.status === 'auto_corrected'
                                ? 'bg-blue-50/50 border-blue-200 hover:border-blue-300'
                                : 'bg-orange-50/50 border-orange-200 hover:border-orange-300'
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                {/* Header row */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                                    <Badge 
                                      variant={fragment.status === 'confirmed' ? 'default' : fragment.status === 'auto_corrected' ? 'secondary' : 'destructive'}
                                      className={
                                        fragment.status === 'confirmed' ? 'bg-green-600' 
                                        : fragment.status === 'auto_corrected' ? 'bg-blue-500 text-white' 
                                        : ''
                                      }
                                    >
                                      {fragment.status === 'confirmed' ? 'Проверено' 
                                        : fragment.status === 'auto_corrected' ? 'Исправлено AI' 
                                        : 'Требует проверки'}
                                    </Badge>
                                  </div>
                                  {fragment.status === 'auto_corrected' && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-8 bg-blue-600 hover:bg-blue-700 gap-1"
                                        onClick={() => handleConfirmFragment(fragment, fragment.corrected_text || fragment.original_text)}
                                        data-testid={`confirm-auto-${fragment.id}`}
                                      >
                                        <Check className="w-3 h-3" />
                                        Подтвердить
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => setEditingFragment(fragment)}
                                        data-testid={`edit-fragment-${fragment.id}`}
                                      >
                                        Изменить
                                      </Button>
                                    </div>
                                  )}
                                  {fragment.status === 'pending' && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => handleConfirmFragment(fragment, fragment.original_text)}
                                        data-testid={`confirm-as-is-${fragment.id}`}
                                      >
                                        <Check className="w-3 h-3 mr-1" />
                                        Оставить как есть
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => setEditingFragment(fragment)}
                                        data-testid={`edit-fragment-${fragment.id}`}
                                      >
                                        Исправить
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Auto-corrected notice */}
                                {fragment.status === 'auto_corrected' && (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-100/60 rounded-lg text-sm text-blue-800">
                                    <Sparkles className="w-4 h-4 shrink-0" />
                                    <span>
                                      {fragment.corrected_text ? (
                                        <>AI уже исправил <code className="bg-blue-200/60 px-1.5 py-0.5 rounded text-blue-900">{fragment.original_text}</code> на <code className="bg-green-200/60 px-1.5 py-0.5 rounded text-green-900 font-medium">{fragment.corrected_text}</code> в тексте</>
                                      ) : (
                                        <>AI уже исправил <code className="bg-blue-200/60 px-1.5 py-0.5 rounded text-blue-900">{fragment.original_text}</code> в тексте — проверьте контекст ниже</>
                                      )}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Full sentence with highlighted word */}
                                <div className="bg-white rounded-lg p-4 border">
                                  <p className="text-sm leading-relaxed">
                                    {renderContextWithHighlight(
                                      fullSentence || fragment.context, 
                                      fragment.status === 'auto_corrected' && fragment.corrected_text 
                                        ? fragment.corrected_text 
                                        : fragment.original_text
                                    )}
                                  </p>
                                </div>
                                
                                {/* Current word and correction */}
                                {fragment.status !== 'auto_corrected' && (
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-muted-foreground">Сомнительное слово:</span>
                                  <code className="bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium">
                                    {fragment.original_text}
                                  </code>
                                  {fragment.corrected_text && fragment.corrected_text !== fragment.original_text && (
                                    <>
                                      <span className="text-muted-foreground">→</span>
                                      <code className="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                                        {fragment.corrected_text}
                                      </code>
                                    </>
                                  )}
                                </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Speakers Tab */}
            <TabsContent value="speakers">
              <Card>
                <CardHeader>
                  <CardTitle>Разметка спикеров</CardTitle>
                  <CardDescription>
                    Назначьте имена участникам встречи
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {speakers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-4" />
                      <p>Спикеры будут определены после транскрибации</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {speakers.map((speaker, index) => (
                        <Card key={speaker.id} className={`speaker-${(index % 4) + 1}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold">
                                  {speaker.speaker_name[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <p className="font-medium">{speaker.speaker_name}</p>
                                  <p className="text-xs text-muted-foreground">{speaker.speaker_label}</p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingSpeaker(speaker)}
                                data-testid={`edit-speaker-${speaker.id}`}
                              >
                                Изменить
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Analysis Form */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Анализ встречи
                    </CardTitle>
                    <CardDescription>
                      Выберите промпт и запустите анализ с помощью AI
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Промпт для анализа</Label>
                      <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                        <SelectTrigger data-testid="prompt-select">
                          <SelectValue placeholder="Выберите промпт" />
                        </SelectTrigger>
                        <SelectContent>
                          {prompts.filter(p => p.prompt_type !== 'master').map((prompt) => (
                            <SelectItem key={prompt.id} value={prompt.id}>
                              {prompt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Дополнительные указания (опционально)</Label>
                      <Textarea
                        placeholder="Например: обрати особое внимание на технические риски..."
                        value={additionalText}
                        onChange={(e) => setAdditionalText(e.target.value)}
                        rows={4}
                        data-testid="additional-text-input"
                      />
                    </div>
                    <Button
                      onClick={handleAnalyze}
                      disabled={analyzing || !selectedPrompt || project?.status === 'needs_review'}
                      className="w-full gap-2"
                      data-testid="analyze-btn"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Анализ...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Запустить анализ
                        </>
                      )}
                    </Button>
                    {project?.status === 'needs_review' && (
                      <p className="text-xs text-orange-600">
                        Сначала подтвердите транскрипт на вкладке "Проверка"
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Chat History */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      История анализов
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chatHistory.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-4" />
                        <p>Пока нет результатов анализа</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-4">
                          {chatHistory.map((chat) => (
                            <Card key={chat.id} className="bg-slate-50">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">
                                    {prompts.find(p => p.id === chat.prompt_id)?.name || 'Промпт'}
                                  </Badge>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(chat.created_at), { addSuffix: true, locale: ru })}
                                    </span>
                                    {editingChatId !== chat.id && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleStartEditChat(chat)}
                                        data-testid={`edit-chat-${chat.id}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {chat.additional_text && (
                                  <p className="text-sm text-muted-foreground mb-2 italic">
                                    + {chat.additional_text}
                                  </p>
                                )}
                                {editingChatId === chat.id ? (
                                  <div className="space-y-3">
                                    <Textarea
                                      value={editChatText}
                                      onChange={(e) => setEditChatText(e.target.value)}
                                      className="min-h-[200px] font-sans text-sm leading-relaxed"
                                      data-testid="edit-chat-textarea"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" size="sm" onClick={handleCancelEditChat}>
                                        Отмена
                                      </Button>
                                      <Button size="sm" className="gap-2" onClick={handleSaveChat} disabled={savingChat} data-testid="save-chat-btn">
                                        {savingChat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Сохранить
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="prose prose-sm max-w-none" data-testid={`chat-response-${chat.id}`}>
                                    <Markdown>{chat.response_text}</Markdown>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Processing/Transcribing Status */}
        {(project?.status === 'transcribing' || project?.status === 'processing') && (
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-500" />
              <h3 className="text-lg font-semibold mb-2">
                {project.status === 'transcribing' ? 'Транскрибация...' : 'Обработка текста...'}
              </h3>
              <p className="text-muted-foreground">
                Это может занять несколько минут в зависимости от длительности записи
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Edit Fragment Dialog */}
      <Dialog open={!!editingFragment} onOpenChange={() => setEditingFragment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Исправить фрагмент</DialogTitle>
            <DialogDescription>
              Введите правильный вариант слова или фразы
            </DialogDescription>
          </DialogHeader>
          {editingFragment && (
            <EditFragmentForm
              fragment={editingFragment}
              onSave={(text) => handleConfirmFragment(editingFragment, text)}
              onCancel={() => setEditingFragment(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Speaker Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить имя спикера</DialogTitle>
            <DialogDescription>
              Введите имя участника встречи
            </DialogDescription>
          </DialogHeader>
          {editingSpeaker && (
            <EditSpeakerForm
              speaker={editingSpeaker}
              onSave={(name) => handleUpdateSpeaker(editingSpeaker, name)}
              onCancel={() => setEditingSpeaker(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper Components
function EditFragmentForm({ fragment, onSave, onCancel }) {
  const [text, setText] = useState(fragment.original_text);

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Исходный текст</Label>
        <code className="block bg-slate-100 p-2 rounded">{fragment.original_text}</code>
      </div>
      <div className="space-y-2">
        <Label>Исправленный текст</Label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Введите правильный вариант"
          data-testid="edit-fragment-input"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(text)} data-testid="save-fragment-btn">Сохранить</Button>
      </div>
    </div>
  );
}

function EditSpeakerForm({ speaker, onSave, onCancel }) {
  const [name, setName] = useState(speaker.speaker_name);

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Метка</Label>
        <code className="block bg-slate-100 p-2 rounded">{speaker.speaker_label}</code>
      </div>
      <div className="space-y-2">
        <Label>Имя участника</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Антон"
          data-testid="edit-speaker-input"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(name)} data-testid="save-speaker-btn">Сохранить</Button>
      </div>
    </div>
  );
}

function applySpeakerNames(content, speakers) {
  if (!content || !speakers?.length) return content || '';
  let result = content;
  speakers.forEach((s) => {
    if (s.speaker_name && s.speaker_name !== s.speaker_label) {
      const escaped = s.speaker_label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped + ':', 'g'), s.speaker_name + ':');
    }
  });
  return result;
}

function prepareForMarkdown(content) {
  if (!content) return '';
  // Escape [word?] markers so Markdown doesn't treat [] as link syntax
  return content.replace(/\[+([^\[\]]+?)\?+\]+/g, '`[$1?]`');
}

function extractFullSentence(content, word) {
  if (!content || !word) return null;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\[+${escaped}\\?+\\]+|${escaped}`, 'i');
  const match = content.match(pattern);
  if (!match) return null;
  const pos = match.index;
  // Find sentence boundaries: newline or Speaker label
  let start = pos;
  while (start > 0 && content[start - 1] !== '\n') start--;
  let end = pos + match[0].length;
  while (end < content.length && content[end] !== '\n') end++;
  return content.slice(start, end).trim();
}

function renderContextWithHighlight(context, word) {
  if (!context || !word) return context;
  
  // Escape special regex characters in the word
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Try to find the word with brackets first
  const bracketPattern = new RegExp(`\\[+${escapedWord}\\?+\\]+`, 'gi');
  const plainPattern = new RegExp(`(${escapedWord})`, 'gi');
  
  let parts = [];
  let lastIndex = 0;
  let match;
  
  // First try bracket pattern
  let hasMatch = false;
  const testBracket = context.match(bracketPattern);
  const testPlain = context.match(plainPattern);
  
  const pattern = testBracket ? bracketPattern : plainPattern;
  const contextCopy = context;
  
  while ((match = pattern.exec(contextCopy)) !== null) {
    hasMatch = true;
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>{contextCopy.slice(lastIndex, match.index)}</span>
      );
    }
    // Add highlighted match
    parts.push(
      <mark key={`mark-${match.index}`} className="bg-orange-200 text-orange-900 px-1 rounded font-medium">
        {testBracket ? word : match[0]}
      </mark>
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < contextCopy.length) {
    parts.push(
      <span key={`text-end`}>{contextCopy.slice(lastIndex)}</span>
    );
  }
  
  return hasMatch ? parts : context;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
