import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { fragmentsApi, transcriptsApi } from '../../lib/api';
import { FragmentCard } from './FragmentCard';

export function ReviewTab({ 
  fragments, 
  speakers,
  processedTranscript,
  projectId,
  onFragmentsUpdate,
  onTranscriptUpdate,
  onProjectStatusUpdate
}) {
  const [editingFragment, setEditingFragment] = useState(null);
  
  const pendingFragments = fragments.filter(f => f.status === 'pending' || f.status === 'auto_corrected');
  const confirmedFragments = fragments.filter(f => f.status === 'confirmed');

  const handleConfirmFragment = async (fragment, correctedText) => {
    try {
      await fragmentsApi.update(projectId, fragment.id, {
        corrected_text: correctedText,
        status: 'confirmed'
      });
      
      // Update fragments list
      const updatedFragments = fragments.map(f => 
        f.id === fragment.id ? { ...f, corrected_text: correctedText, status: 'confirmed' } : f
      );
      onFragmentsUpdate(updatedFragments);
      setEditingFragment(null);

      // Apply correction to processed transcript
      if (processedTranscript) {
        const word = fragment.original_text;
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\[+${escaped}\\?+\\]+`, 'g');
        const updatedContent = processedTranscript.content.replace(pattern, correctedText);
        if (updatedContent !== processedTranscript.content) {
          onTranscriptUpdate(updatedContent);
          transcriptsApi.updateContent(projectId, 'processed', updatedContent).catch(() => {});
        }
      }

      toast.success('Фрагмент подтвержден');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleRevertFragment = async (fragment) => {
    try {
      const response = await fragmentsApi.revert(projectId, fragment.id);
      const revertedFragment = response.data;
      
      // Update fragments list with reverted status
      const updatedFragments = fragments.map(f => 
        f.id === fragment.id ? { ...f, status: revertedFragment.status } : f
      );
      onFragmentsUpdate(updatedFragments);

      // Reload transcript to get updated content with restored [word?] marker
      try {
        const transcriptsRes = await transcriptsApi.list(projectId);
        const processed = transcriptsRes.data.find(t => t.version_type === 'processed');
        if (processed) {
          onTranscriptUpdate(processed.content);
        }
      } catch (e) {
        // Ignore transcript reload error
      }

      toast.success('Подтверждение отменено');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка отмены');
    }
  };

  return (
    <>
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
                <span className="text-green-600">Проверено: <strong>{confirmedFragments.length}</strong></span>
                {fragments.filter(f => f.status === 'auto_corrected').length > 0 && (
                  <span className="text-blue-600">Исправлено AI: <strong>{fragments.filter(f => f.status === 'auto_corrected').length}</strong></span>
                )}
                <span className="text-orange-600">Ожидает: <strong>{fragments.filter(f => f.status === 'pending').length}</strong></span>
              </div>
              
              {/* Fragment cards */}
              <div className="space-y-3">
                {fragments.map((fragment, index) => (
                  <FragmentCard
                    key={fragment.id}
                    fragment={fragment}
                    index={index}
                    processedContent={processedTranscript?.content || ''}
                    speakers={speakers}
                    onConfirm={(text) => handleConfirmFragment(fragment, text)}
                    onEdit={() => setEditingFragment(fragment)}
                    onRevert={() => handleRevertFragment(fragment)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}

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
