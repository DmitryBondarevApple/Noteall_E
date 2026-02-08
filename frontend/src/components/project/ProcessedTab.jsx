import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { FileText, Loader2, Pencil, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { transcriptsApi } from '../../lib/api';
import { applySpeakerNames } from './utils';

export function ProcessedTab({ 
  transcript, 
  speakers, 
  projectId, 
  processing, 
  hasRawTranscript,
  onProcess, 
  onUpdate 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

  const handleStartEdit = () => {
    if (transcript) {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      const innerScroll = viewport?.scrollTop || 0;
      setEditText(transcript.content);
      setIsEditing(true);
      requestAnimationFrame(() => {
        const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
        if (textarea) textarea.scrollTop = innerScroll;
      });
    }
  };

  const handleSave = async () => {
    const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
    const innerScroll = textarea?.scrollTop || 0;
    setSaving(true);
    try {
      await transcriptsApi.updateContent(projectId, 'processed', editText);
      onUpdate?.(editText);
      setIsEditing(false);
      toast.success('Текст сохранён');
      requestAnimationFrame(() => {
        const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = innerScroll;
      });
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
    const innerScroll = textarea?.scrollTop || 0;
    setIsEditing(false);
    setEditText('');
    requestAnimationFrame(() => {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = innerScroll;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Обработанный текст</CardTitle>
          <CardDescription>
            Результат обработки мастер-промптом через GPT-5.2
          </CardDescription>
        </div>
        {transcript && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleStartEdit}
            data-testid="edit-processed-btn"
          >
            <Pencil className="w-4 h-4" />
            Редактировать
          </Button>
        )}
        {isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              data-testid="cancel-edit-processed-btn"
            >
              Отмена
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleSave}
              disabled={saving}
              data-testid="save-processed-btn"
            >
              {saving ? (
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
        {transcript ? (
          isEditing ? (
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[500px] font-sans text-sm leading-relaxed"
              data-testid="edit-processed-textarea"
            />
          ) : (
            <ScrollArea ref={scrollRef} className="h-[500px] rounded-lg border p-6 bg-white">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans" data-testid="processed-transcript-content">
                {applySpeakerNames(transcript.content, speakers)}
              </pre>
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
              onClick={onProcess}
              disabled={processing || !hasRawTranscript}
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
  );
}
