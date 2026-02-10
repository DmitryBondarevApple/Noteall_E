import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { docProjectsApi, docAttachmentsApi, docStreamsApi, docPinsApi, docTemplatesApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  ArrowLeft, FileText, Upload, Link2, Trash2, Paperclip, File, Image, FileType,
  Globe, Loader2, Plus, MessageSquare, Send, MoreHorizontal, Edit2,
  Pin, FileOutput, GripVertical, ChevronRight, Sparkles, Copy,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const fileTypeIcons = { pdf: FileType, image: Image, text: FileText, url: Globe, other: File };

// ============ Materials Panel ============
function MaterialsPanel({ projectId, attachments, uploading, onUpload, onAddUrl, onDelete }) {
  return (
    <div className="w-60 border-r bg-white flex flex-col shrink-0">
      <div className="px-3 py-2.5 border-b">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Материалы
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

// ============ Final Document Panel ============
function FinalDocPanel({ pins, streams, onDeletePin, onUpdatePin, onReorder, onCopyAll }) {
  const getStreamName = (streamId) => streams.find(s => s.id === streamId)?.name || 'Поток';

  const movePin = (index, direction) => {
    const newPins = [...pins];
    const target = index + direction;
    if (target < 0 || target >= newPins.length) return;
    [newPins[index], newPins[target]] = [newPins[target], newPins[index]];
    onReorder(newPins.map(p => p.id));
  };

  return (
    <div className="w-80 border-l bg-white flex flex-col shrink-0">
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <FileOutput className="w-3.5 h-3.5" />
          Итоговый документ
        </h2>
        {pins.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={onCopyAll} data-testid="copy-final-doc-btn">
            <Copy className="w-3 h-3" /> Копировать
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {pins.length === 0 ? (
            <div className="text-center py-10 px-3">
              <Pin className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-xs text-slate-400 leading-relaxed">
                Закрепляйте ответы AI из потоков, чтобы собрать итоговый документ
              </p>
            </div>
          ) : pins.map((pin, idx) => (
            <div key={pin.id} className="group bg-slate-50 rounded-lg p-2.5 border border-slate-100 hover:border-slate-200 transition-colors"
              data-testid={`pin-${pin.id}`}>
              <div className="flex items-center gap-1 mb-1.5">
                <div className="flex items-center gap-0.5">
                  <button className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30" disabled={idx === 0}
                    onClick={() => movePin(idx, -1)} data-testid={`pin-up-${pin.id}`}>
                    <ChevronRight className="w-3 h-3 -rotate-90" />
                  </button>
                  <button className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30" disabled={idx === pins.length - 1}
                    onClick={() => movePin(idx, 1)} data-testid={`pin-down-${pin.id}`}>
                    <ChevronRight className="w-3 h-3 rotate-90" />
                  </button>
                </div>
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{getStreamName(pin.stream_id)}</Badge>
                <div className="flex-1" />
                <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-opacity"
                  onClick={() => onDeletePin(pin.id)} data-testid={`pin-delete-${pin.id}`}>
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
              <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-6">{pin.content}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
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

  // Streams
  const [streams, setStreams] = useState([]);
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [streamDialog, setStreamDialog] = useState({ open: false, name: '', systemPrompt: '', editId: null });
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Pins
  const [pins, setPins] = useState([]);

  // Templates
  const [templates, setTemplates] = useState([]);

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

  const loadStreams = useCallback(async () => {
    try {
      const res = await docStreamsApi.list(projectId);
      setStreams(res.data);
      if (res.data.length > 0 && !activeStreamId) {
        setActiveStreamId(res.data[0].id);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  const loadPins = useCallback(async () => {
    try {
      const res = await docPinsApi.list(projectId);
      setPins(res.data);
    } catch { /* ignore */ }
  }, [projectId]);

  const loadTemplates = useCallback(async () => {
    try {
      // Seed defaults if needed
      await docTemplatesApi.seed();
      const res = await docTemplatesApi.list();
      setTemplates(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadProject();
    loadStreams();
    loadPins();
    loadTemplates();
  }, [loadProject, loadStreams, loadPins, loadTemplates]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streams, activeStreamId]);

  const activeStream = streams.find(s => s.id === activeStreamId);

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
    catch { toast.error('Ошибка удаления'); }
  };

  // Stream CRUD
  const handleSaveStream = async () => {
    if (!streamDialog.name.trim()) return;
    try {
      if (streamDialog.editId) {
        await docStreamsApi.update(projectId, streamDialog.editId, {
          name: streamDialog.name, system_prompt: streamDialog.systemPrompt || null,
        });
        loadStreams();
      } else {
        const res = await docStreamsApi.create(projectId, {
          name: streamDialog.name, system_prompt: streamDialog.systemPrompt || null,
        });
        setStreams(prev => [...prev, res.data]);
        setActiveStreamId(res.data.id);
      }
      setStreamDialog({ open: false, name: '', systemPrompt: '', editId: null });
    } catch { toast.error('Ошибка'); }
  };

  const handleCreateFromTemplate = (tmpl) => {
    setStreamDialog({
      open: true,
      name: tmpl.name,
      systemPrompt: tmpl.system_prompt || '',
      editId: null,
    });
  };

  const handleDeleteStream = async (streamId) => {
    if (!window.confirm('Удалить поток и всю историю?')) return;
    try {
      await docStreamsApi.delete(projectId, streamId);
      setStreams(prev => prev.filter(s => s.id !== streamId));
      if (activeStreamId === streamId) {
        setActiveStreamId(streams.find(s => s.id !== streamId)?.id || null);
      }
    } catch { toast.error('Ошибка'); }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeStreamId || sending) return;
    const text = messageInput.trim();
    setMessageInput('');
    setSending(true);
    const tempUserMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setStreams(prev => prev.map(s =>
      s.id === activeStreamId ? { ...s, messages: [...(s.messages || []), tempUserMsg] } : s
    ));
    try {
      const res = await docStreamsApi.sendMessage(projectId, activeStreamId, text);
      setStreams(prev => prev.map(s => {
        if (s.id !== activeStreamId) return s;
        const msgs = [...(s.messages || [])];
        msgs.pop();
        msgs.push(res.data.user_message, res.data.assistant_message);
        return { ...s, messages: msgs };
      }));
    } catch {
      toast.error('Ошибка отправки');
      setStreams(prev => prev.map(s =>
        s.id === activeStreamId ? { ...s, messages: (s.messages || []).slice(0, -1) } : s
      ));
      setMessageInput(text);
    } finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  // Pin message
  const handlePinMessage = async (streamId, msgIndex, content) => {
    try {
      const res = await docPinsApi.create(projectId, { stream_id: streamId, message_index: msgIndex, content });
      setPins(prev => [...prev, res.data]);
      toast.success('Закреплено');
    } catch { toast.error('Ошибка'); }
  };

  const handleDeletePin = async (pinId) => {
    try { await docPinsApi.delete(projectId, pinId); setPins(prev => prev.filter(p => p.id !== pinId)); }
    catch { toast.error('Ошибка'); }
  };

  const handleReorderPins = async (pinIds) => {
    const reordered = pinIds.map((id, i) => ({ ...pins.find(p => p.id === id), order: i }));
    setPins(reordered);
    try { await docPinsApi.reorder(projectId, pinIds); }
    catch { loadPins(); }
  };

  const handleCopyFinalDoc = () => {
    const text = pins.map(p => p.content).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    toast.success('Скопировано в буфер обмена');
  };

  if (loading) {
    return <AppLayout><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }
  if (!project) return null;

  const attachments = project.attachments || [];
  const messages = activeStream?.messages || [];

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
              {project.status === 'draft' ? 'Черновик' : project.status === 'in_progress' ? 'В работе' : 'Готов'}
            </Badge>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Materials */}
          <MaterialsPanel projectId={projectId} attachments={attachments} uploading={uploading}
            onUpload={handleFileUpload}
            onAddUrl={() => setUrlDialog({ open: true, url: '', name: '' })}
            onDelete={handleDeleteAttachment} />

          {/* Center: Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Stream tabs */}
            <div className="bg-white border-b px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
              {streams.map(s => (
                <button key={s.id} onClick={() => setActiveStreamId(s.id)}
                  className={cn(
                    'group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 max-w-[180px]',
                    s.id === activeStreamId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  )}
                  data-testid={`stream-tab-${s.id}`}>
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{s.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <span className="opacity-0 group-hover:opacity-100 ml-auto cursor-pointer">
                        <MoreHorizontal className="w-3 h-3" />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation();
                        setStreamDialog({ open: true, name: s.name, systemPrompt: s.system_prompt || '', editId: s.id }); }}>
                        <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Настройки
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteStream(s.id); }}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </button>
              ))}

              {/* New stream button with template dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 shrink-0 text-slate-400 hover:text-slate-700"
                    data-testid="create-stream-btn">
                    <Plus className="w-3.5 h-3.5" /> Поток
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => setStreamDialog({ open: true, name: '', systemPrompt: '', editId: null })}>
                    <Plus className="w-3.5 h-3.5 mr-2" /> Пустой поток
                  </DropdownMenuItem>
                  {templates.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1"><span className="text-[10px] font-semibold text-slate-400 uppercase">Шаблоны</span></div>
                      {templates.map(t => (
                        <DropdownMenuItem key={t.id} onClick={() => handleCreateFromTemplate(t)} data-testid={`template-${t.id}`}>
                          <Sparkles className="w-3.5 h-3.5 mr-2 text-amber-500" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{t.name}</div>
                            {t.description && <div className="text-[10px] text-slate-400 truncate">{t.description}</div>}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages */}
            {!activeStream ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                  <p className="text-sm font-medium text-slate-500 mb-1">Создайте поток анализа</p>
                  <p className="text-xs text-slate-400 mb-4 max-w-xs">
                    Каждый поток — независимый чат с AI для анализа конкретного аспекта документа
                  </p>
                  <Button size="sm" className="gap-1.5"
                    onClick={() => setStreamDialog({ open: true, name: '', systemPrompt: '', editId: null })}
                    data-testid="empty-create-stream-btn">
                    <Plus className="w-4 h-4" /> Новый поток
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="max-w-3xl mx-auto space-y-3">
                    {messages.length === 0 && (
                      <div className="text-center py-12 text-xs text-slate-400">
                        <p>Начните диалог. AI имеет доступ к загруженным материалам.</p>
                        {activeStream.system_prompt && (
                          <p className="mt-1 text-indigo-400 max-w-md mx-auto">Инструкция: {activeStream.system_prompt.slice(0, 120)}{activeStream.system_prompt.length > 120 ? '...' : ''}</p>
                        )}
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : 'bg-slate-100 text-slate-800 rounded-bl-md'
                        )} data-testid={`message-${i}`}>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                          {msg.role === 'assistant' && (
                            <button
                              className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-indigo-50"
                              onClick={() => handlePinMessage(activeStreamId, i, msg.content)}
                              title="Закрепить в итоговый документ"
                              data-testid={`pin-message-${i}`}
                            >
                              <Pin className="w-3.5 h-3.5 text-indigo-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs">Генерация ответа...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="border-t bg-white px-4 py-3">
                  <div className="max-w-3xl mx-auto flex items-end gap-2">
                    <Textarea value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Введите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
                      className="resize-none min-h-[40px] max-h-[120px] text-sm" rows={1} disabled={sending}
                      data-testid="message-input" />
                    <Button size="icon" className="h-10 w-10 shrink-0" disabled={!messageInput.trim() || sending}
                      onClick={handleSendMessage} data-testid="send-message-btn">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Final Document */}
          <FinalDocPanel pins={pins} streams={streams}
            onDeletePin={handleDeletePin} onUpdatePin={() => {}} onReorder={handleReorderPins} onCopyAll={handleCopyFinalDoc} />
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

      {/* Stream Dialog */}
      <Dialog open={streamDialog.open} onOpenChange={(open) => !open && setStreamDialog({ ...streamDialog, open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{streamDialog.editId ? 'Настройки потока' : 'Новый поток анализа'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Название потока (напр. Резюме, Риски, Ключевые факты)"
              value={streamDialog.name} onChange={(e) => setStreamDialog({ ...streamDialog, name: e.target.value })}
              autoFocus data-testid="stream-name-input" />
            <Textarea placeholder="Системный промпт (опционально) — инструкция для AI в этом потоке"
              value={streamDialog.systemPrompt} onChange={(e) => setStreamDialog({ ...streamDialog, systemPrompt: e.target.value })}
              rows={3} className="text-sm" data-testid="stream-prompt-input" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setStreamDialog({ ...streamDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleSaveStream} disabled={!streamDialog.name.trim()} data-testid="stream-save-btn">
                {streamDialog.editId ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
