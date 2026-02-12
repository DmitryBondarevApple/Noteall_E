import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { FileText, Loader2, Pencil, Save, Sparkles, CloudOff, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { transcriptsApi } from '../../lib/api';
import { applySpeakerNames } from './utils';

const DRAFT_KEY_PREFIX = 'voice_workspace_draft_';
const AUTOSAVE_DELAY = 2000; // 2 seconds

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
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const scrollRef = useRef(null);
  const autosaveTimerRef = useRef(null);

  const draftKey = `${DRAFT_KEY_PREFIX}processed_${projectId}`;

  // Check for existing draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft && transcript) {
      try {
        const draft = JSON.parse(savedDraft);
        // Only show draft if it's different from current content
        if (draft.content && draft.content !== transcript.content) {
          setHasDraft(true);
        }
      } catch (e) {
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey, transcript]);

  // Autosave draft
  const saveDraft = useCallback((text) => {
    if (text && transcript && text !== transcript.content) {
      localStorage.setItem(draftKey, JSON.stringify({
        content: text,
        savedAt: new Date().toISOString()
      }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 1500);
    }
  }, [draftKey, transcript]);

  // Handle text change with autosave
  const handleTextChange = (e) => {
    const newText = e.target.value;
    setEditText(newText);
    
    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    
    // Set new autosave timer
    autosaveTimerRef.current = setTimeout(() => {
      saveDraft(newText);
    }, AUTOSAVE_DELAY);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

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

  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setEditText(draft.content);
        setIsEditing(true);
        setHasDraft(false);
        toast.success('Черновик восстановлен');
      } catch (e) {
        toast.error('Ошибка восстановления черновика');
      }
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftKey);
    setHasDraft(false);
    toast.success('Черновик удалён');
  };

  const handleSave = async () => {
    const textarea = document.querySelector('[data-testid="edit-processed-textarea"]');
    const innerScroll = textarea?.scrollTop || 0;
    setSaving(true);
    try {
      await transcriptsApi.updateContent(projectId, 'processed', editText);
      onUpdate?.(editText);
      setIsEditing(false);
      // Clear draft on successful save
      localStorage.removeItem(draftKey);
      setHasDraft(false);
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
    
    // Save draft before canceling if content changed
    if (editText && transcript && editText !== transcript.content) {
      saveDraft(editText);
      setHasDraft(true);
      toast.info('Черновик сохранён');
    }
    
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
            Результат обработки мастер-промптом через AI-модель
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {/* Draft notification */}
          {hasDraft && !isEditing && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <CloudOff className="w-3 h-3 mr-1" />
                Есть черновик
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestoreDraft}
                data-testid="restore-draft-btn"
              >
                Восстановить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardDraft}
                className="text-muted-foreground"
              >
                Удалить
              </Button>
            </div>
          )}
          
          {/* Autosave indicator */}
          {isEditing && draftSaved && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Cloud className="w-3 h-3 mr-1" />
              Черновик сохранён
            </Badge>
          )}
          
          {transcript && !isEditing && !hasDraft && (
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
        </div>
      </CardHeader>
      <CardContent>
        {transcript ? (
          isEditing ? (
            <Textarea
              value={editText}
              onChange={handleTextChange}
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
