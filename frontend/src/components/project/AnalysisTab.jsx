import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Sparkles, MessageSquare, History, Loader2, Pencil, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { chatApi } from '../../lib/api';

export function AnalysisTab({ 
  prompts, 
  chatHistory, 
  projectId,
  projectStatus,
  selectedReasoningEffort,
  onChatHistoryUpdate
}) {
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [additionalText, setAdditionalText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editChatText, setEditChatText] = useState('');
  const [savingChat, setSavingChat] = useState(false);

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
      onChatHistoryUpdate([...chatHistory, response.data]);
      setAdditionalText('');
      toast.success('Анализ завершен');
    } catch (error) {
      toast.error('Ошибка анализа');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartEditChat = (chat) => {
    setEditingChatId(chat.id);
    setEditChatText(chat.response_text);
  };

  const handleSaveChat = async () => {
    setSavingChat(true);
    try {
      await chatApi.updateResponse(projectId, editingChatId, editChatText);
      const updatedHistory = chatHistory.map(c =>
        c.id === editingChatId ? { ...c, response_text: editChatText } : c
      );
      onChatHistoryUpdate(updatedHistory);
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

  // Filter out master prompts for the selector
  const analysisPrompts = prompts.filter(p => p.prompt_type !== 'master');

  return (
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
                {analysisPrompts.map((prompt) => (
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
            disabled={analyzing || !selectedPrompt || projectStatus === 'needs_review'}
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
          {projectStatus === 'needs_review' && (
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
  );
}
