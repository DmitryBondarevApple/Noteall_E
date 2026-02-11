import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import {
  projectsApi,
  transcriptsApi,
  fragmentsApi,
  speakersApi,
  chatApi,
  promptsApi
} from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Wand2,
  Archive
} from 'lucide-react';
import { toast } from 'sonner';

// Import refactored components
import {
  UploadSection,
  TranscriptTab,
  ProcessedTab,
  ReviewTab,
  FullAnalysisTab,
  ResultsTab,
  statusConfig,
  reasoningEffortOptions
} from '../components/project';

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data state
  const [project, setProject] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [fragments, setFragments] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript');
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState('high');

  // Helper to get transcript by type
  const getTranscript = (type) => transcripts.find(t => t.version_type === type);
  const pendingFragments = fragments.filter(f => f.status === 'pending' || f.status === 'auto_corrected');
  const status = statusConfig[project?.status] || statusConfig.new;

  // Load all project data
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
      navigate('/meetings');
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
      const wasProcessing = project?.status === 'processing';
      const interval = setInterval(async () => {
        try {
          const res = await projectsApi.get(projectId);
          setProject(res.data);
          if (res.data.status !== 'transcribing' && res.data.status !== 'processing') {
            setProcessing(false);
            loadData();
            if (wasProcessing && (res.data.status === 'ready' || res.data.status === 'needs_review')) {
              toast.success('Обработка завершена');
              setActiveTab('processed');
            } else if (!wasProcessing) {
              toast.success('Транскрибация завершена');
              setActiveTab('transcript');
            }
          }
        } catch (e) {}
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.status, projectId, loadData]);

  // Handlers
  const handleUploadStart = () => {
    setProject(prev => ({ ...prev, status: 'transcribing' }));
  };

  const handleProcessWithGPT = async () => {
    setProcessing(true);
    try {
      await transcriptsApi.process(projectId);
      toast.success('Обработка запущена. Ожидайте завершения...');
      setProject(prev => ({ ...prev, status: 'processing' }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка запуска обработки');
      setProcessing(false);
    }
  };

  const handleTranscriptUpdate = (content) => {
    setTranscripts(transcripts.map(t =>
      t.version_type === 'processed' ? { ...t, content } : t
    ));
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <AppLayout>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link to="/meetings">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="back-to-dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight truncate" data-testid="project-title">{project?.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">{project?.description || 'Без описания'}</p>
            </div>
          </div>
          <Badge className={`${status.color} shrink-0 text-xs`}>{status.label}</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Upload Section - Show only for new projects */}
        {project?.status === 'new' && (
          <UploadSection 
            projectId={projectId} 
            onUploadStart={handleUploadStart} 
          />
        )}

        {/* Main Content Tabs */}
        {project?.status !== 'new' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <div className="sticky top-[73px] z-40 bg-slate-50 py-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
              {/* Mobile: scrollable tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <TabsList className="bg-white border p-1 shadow-sm inline-flex min-w-max">
                    <TabsTrigger value="transcript" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="transcript-tab">
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Транскрипт</span>
                    </TabsTrigger>
                    <TabsTrigger value="review" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="review-tab">
                      <AlertCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Проверка</span>
                      {pendingFragments.length > 0 && (
                        <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {pendingFragments.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="processed" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="processed-tab">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Обработанный</span>
                    </TabsTrigger>
                    <TabsTrigger value="full-analysis" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="full-analysis-tab">
                      <Wand2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Анализ</span>
                    </TabsTrigger>
                    <TabsTrigger value="results" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3" data-testid="results-tab">
                      <Archive className="w-4 h-4" />
                      <span className="hidden sm:inline">Результаты</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              
              {/* Process Button with Reasoning Selector */}
                {/* Process controls - hidden on very small screens, shown below tabs */}
                <div className="hidden sm:flex items-center gap-3">
                  <Select value={selectedReasoningEffort} onValueChange={setSelectedReasoningEffort}>
                    <SelectTrigger className="w-36 lg:w-44 h-9 text-xs" data-testid="tab-reasoning-select">
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
                    size="sm"
                    data-testid="process-btn"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden lg:inline">Обработка...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden lg:inline">Обработать</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Mobile process controls */}
              <div className="sm:hidden flex items-center gap-2 mt-2">
                <Select value={selectedReasoningEffort} onValueChange={setSelectedReasoningEffort}>
                  <SelectTrigger className="flex-1 h-9 text-xs" data-testid="tab-reasoning-select-mobile">
                    <SelectValue placeholder="Режим GPT" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasoningEffortOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="text-xs">{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleProcessWithGPT}
                  disabled={processing || !getTranscript('raw')}
                  size="sm"
                  data-testid="process-btn-mobile"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Transcript Tab */}
            <TabsContent value="transcript">
              <TranscriptTab 
                transcript={getTranscript('raw')} 
                speakers={speakers}
                projectId={projectId}
                onSpeakersUpdate={setSpeakers}
              />
            </TabsContent>

            {/* Review Tab */}
            <TabsContent value="review">
              <ReviewTab
                fragments={fragments}
                speakers={speakers}
                processedTranscript={getTranscript('processed')}
                projectId={projectId}
                onFragmentsUpdate={setFragments}
                onTranscriptUpdate={handleTranscriptUpdate}
                onProjectStatusUpdate={(newStatus) => setProject(prev => ({ ...prev, status: newStatus }))}
              />
            </TabsContent>

            {/* Processed Tab */}
            <TabsContent value="processed">
              <ProcessedTab
                transcript={getTranscript('processed')}
                speakers={speakers}
                projectId={projectId}
                processing={processing}
                hasRawTranscript={!!getTranscript('raw')}
                onProcess={handleProcessWithGPT}
                onUpdate={handleTranscriptUpdate}
              />
            </TabsContent>

            {/* Analysis (Wizard) Tab */}
            <TabsContent value="full-analysis" forceMount className="data-[state=inactive]:hidden">
              <FullAnalysisTab
                projectId={projectId}
                processedTranscript={getTranscript('processed') || getTranscript('raw')}
                onSaveResult={(result) => {
                  loadData();
                  toast.success('Анализ сохранён в результаты');
                }}
              />
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results">
              <ResultsTab
                projectId={projectId}
                selectedReasoningEffort={selectedReasoningEffort}
              />
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
    </div>
    </AppLayout>
  );
}
