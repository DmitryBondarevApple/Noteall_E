import React, { useState, useEffect, useRef, useCallback } from 'react';
import { aiChatApi } from '../../lib/api';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  Bot,
  Send,
  ImagePlus,
  X,
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

function ChatMessage({ msg, onApplyPipeline }) {
  const isUser = msg.role === 'user';

  // Parse assistant messages for JSON code blocks
  const renderContent = (text) => {
    if (!text || isUser) return <span>{text}</span>;

    const parts = [];
    let remaining = text;
    let idx = 0;

    while (remaining.length > 0) {
      const jsonStart = remaining.indexOf('```json');
      const codeStart = jsonStart === -1 ? remaining.indexOf('```') : jsonStart;

      if (codeStart === -1) {
        if (remaining.trim()) parts.push(<span key={idx++}>{remaining}</span>);
        break;
      }

      // Text before code block
      if (codeStart > 0) {
        parts.push(<span key={idx++}>{remaining.slice(0, codeStart)}</span>);
      }

      // Find end of code block
      const afterStart = remaining.indexOf('\n', codeStart) + 1;
      const codeEnd = remaining.indexOf('```', afterStart);
      if (codeEnd === -1) {
        parts.push(<span key={idx++}>{remaining.slice(codeStart)}</span>);
        break;
      }

      const codeContent = remaining.slice(afterStart, codeEnd).trim();
      remaining = remaining.slice(codeEnd + 3);

      // Try to parse as pipeline JSON
      let isPipeline = false;
      try {
        const parsed = JSON.parse(codeContent);
        if (parsed && parsed.nodes) {
          isPipeline = true;
          parts.push(
            <div key={idx++} className="my-2 rounded-lg border border-cyan-200 bg-cyan-50/50 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-cyan-700">
                  Сценарий: {parsed.name || 'Без названия'}
                </span>
                <span className="text-xs text-cyan-600">{parsed.nodes?.length || 0} узлов</span>
              </div>
              {parsed.description && (
                <p className="text-xs text-slate-600 mb-2">{parsed.description}</p>
              )}
              {onApplyPipeline && (
                <button
                  onClick={() => onApplyPipeline(parsed)}
                  className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded-md transition-colors"
                  data-testid="apply-pipeline-btn"
                >
                  Применить сценарий
                </button>
              )}
            </div>
          );
        }
      } catch {}

      if (!isPipeline) {
        parts.push(
          <pre key={idx++} className="my-1.5 text-xs bg-slate-800 text-slate-200 rounded-md p-2 overflow-x-auto">
            <code>{codeContent}</code>
          </pre>
        );
      }
    }

    return <>{parts}</>;
  };

  return (
    <div
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
      data-testid={`chat-msg-${msg.role}`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
          isUser ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'
        }`}
      >
        {isUser ? 'Вы' : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-slate-100 text-slate-800 rounded-tl-sm'
        }`}
      >
        {msg.image_url && (
          <img
            src={msg.image_url}
            alt="Вложение"
            className="rounded-lg mb-2 max-w-full max-h-48 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(msg.image_url, '_blank')}
            data-testid="chat-msg-image"
          />
        )}
        {msg.content && (
          <div className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</div>
        )}
      </div>
    </div>
  );
}

export default function AiChatPanel({ open, onClose, pipelineId, onPipelineGenerated, pipelineContext }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' | 'sessions'
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // Load sessions when panel opens
  useEffect(() => {
    if (!open) return;
    loadSessions();
  }, [open, pipelineId]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await aiChatApi.listSessions(pipelineId);
      setSessions(res.data);
      // Auto-select most recent session if available
      if (res.data.length > 0 && !activeSessionId) {
        await selectSession(res.data[0].id);
      }
    } catch (err) {
      // Silently fail on load
    } finally {
      setLoadingSessions(false);
    }
  };

  const selectSession = async (sessionId) => {
    try {
      const res = await aiChatApi.getSession(sessionId);
      setActiveSessionId(sessionId);
      setMessages(res.data.messages || []);
      setView('chat');
      scrollToBottom();
    } catch (err) {
      toast.error('Ошибка загрузки сессии');
    }
  };

  const createNewSession = async () => {
    try {
      const res = await aiChatApi.createSession(pipelineId);
      setActiveSessionId(res.data.id);
      setMessages([]);
      setSessions((prev) => [
        { id: res.data.id, pipeline_id: pipelineId, message_count: 0, created_at: res.data.created_at, updated_at: res.data.updated_at },
        ...prev,
      ]);
      setView('chat');
    } catch (err) {
      toast.error('Ошибка создания сессии');
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await aiChatApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
      toast.success('Сессия удалена');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 10 МБ)');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !imageFile) || sending) return;

    // Create session if none exists
    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const res = await aiChatApi.createSession(pipelineId);
        sessionId = res.data.id;
        setActiveSessionId(sessionId);
        setSessions((prev) => [
          { id: sessionId, pipeline_id: pipelineId, message_count: 0, created_at: res.data.created_at, updated_at: res.data.updated_at },
          ...prev,
        ]);
      } catch (err) {
        toast.error('Ошибка создания сессии');
        return;
      }
    }

    const userContent = input.trim();
    const userImage = imagePreview;

    // Optimistically add user message
    const tempUserMsg = {
      role: 'user',
      content: userContent,
      image_url: userImage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInput('');
    clearImage();
    setSending(true);
    scrollToBottom();

    try {
      const res = await aiChatApi.sendMessage(sessionId, userContent, imageFile, pipelineContext || null);
      const { user_message, assistant_message, pipeline_data } = res.data;

      // Replace optimistic user msg and add assistant msg
      setMessages((prev) => {
        const filtered = prev.slice(0, -1); // remove optimistic
        return [...filtered, user_message, assistant_message];
      });
      scrollToBottom();

      // If pipeline data was generated, notify parent
      if (pipeline_data && onPipelineGenerated) {
        onPipelineGenerated(pipeline_data);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки сообщения');
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div
      className="w-[400px] h-full border-l bg-white flex flex-col shrink-0"
      data-testid="ai-chat-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-600" />
          <span className="font-semibold text-sm">AI-ассистент</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setView(view === 'sessions' ? 'chat' : 'sessions')}
            title="История сессий"
            data-testid="chat-sessions-toggle"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={createNewSession}
            title="Новый чат"
            data-testid="chat-new-session-btn"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            data-testid="chat-close-btn"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Pipeline context indicator */}
      {pipelineContext && (
        <div className="px-4 py-2 bg-emerald-50 border-b flex items-center gap-2 shrink-0" data-testid="pipeline-context-badge">
          <Workflow className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs text-emerald-700 font-medium">
            Сценарий подключён ({pipelineContext.nodes?.length || 0} узлов)
          </span>
        </div>
      )}

      {view === 'sessions' ? (
        /* Sessions List */
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2 justify-start text-sm"
              onClick={createNewSession}
              data-testid="create-new-chat-btn"
            >
              <Plus className="w-4 h-4" />
              Новый чат
            </Button>
            {loadingSessions && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  s.id === activeSessionId
                    ? 'bg-cyan-50 border border-cyan-200'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
                onClick={() => selectSession(s.id)}
                data-testid={`chat-session-${s.id}`}
              >
                <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-slate-700">
                    {s.last_message_preview || 'Новый чат'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.message_count} сообщ.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
            {!loadingSessions && sessions.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Нет сессий чата
              </p>
            )}
          </div>
        </ScrollArea>
      ) : (
        /* Chat View */
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 px-3">
            <div className="py-3 space-y-4">
              {messages.length === 0 && !sending && (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium mb-1">Чем могу помочь?</p>
                  <p className="text-xs">
                    Опишите сценарий анализа или загрузите скриншот ошибки
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatMessage key={i} msg={msg} onApplyPipeline={onPipelineGenerated} />
              ))}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-cyan-100 text-cyan-700">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-slate-100 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" />
                      <span className="text-sm text-slate-500">Думаю...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Image Preview */}
          {imagePreview && (
            <div className="px-3 pb-1">
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-16 rounded-lg border"
                  data-testid="chat-image-preview"
                />
                <button
                  onClick={clearImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t px-3 py-2.5 shrink-0" data-testid="chat-input-area">
            <div className="flex items-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
                data-testid="chat-image-input"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Загрузить скриншот"
                data-testid="chat-attach-image-btn"
              >
                <ImagePlus className="w-4 h-4 text-slate-500" />
              </Button>
              <textarea
                ref={textareaRef}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[36px] max-h-[120px]"
                placeholder="Опишите задачу или спросите..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                rows={1}
                data-testid="chat-message-input"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSend}
                disabled={(!input.trim() && !imageFile) || sending}
                data-testid="chat-send-btn"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
