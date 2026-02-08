import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, Sparkles, Undo2, FileEdit } from 'lucide-react';
import { applySpeakerNames, extractFullSentence, renderContextWithHighlight } from './utils';

export function FragmentCard({ 
  fragment, 
  index, 
  processedContent,
  speakers,
  onConfirm, 
  onEdit,
  onRevert,
  onEditContext
}) {
  const fullSentence = extractFullSentence(processedContent, fragment.original_text);
  
  const getStatusStyles = () => {
    if (fragment.status === 'confirmed') {
      return 'bg-green-50/50 border-green-200';
    }
    if (fragment.status === 'auto_corrected') {
      return 'bg-blue-50/50 border-blue-200 hover:border-blue-300';
    }
    return 'bg-orange-50/50 border-orange-200 hover:border-orange-300';
  };

  const getStatusBadge = () => {
    if (fragment.status === 'confirmed') {
      return <Badge variant="default" className="bg-green-600">Проверено</Badge>;
    }
    if (fragment.status === 'auto_corrected') {
      return <Badge variant="secondary" className="bg-blue-500 text-white">Исправлено AI</Badge>;
    }
    return <Badge variant="destructive">Требует проверки</Badge>;
  };

  // Prepare context with speaker names applied
  const contextWithSpeakers = applySpeakerNames(fullSentence || fragment.context, speakers);
  
  // Determine which word to highlight
  const highlightWord = fragment.status === 'auto_corrected' && fragment.corrected_text 
    ? fragment.corrected_text 
    : fragment.original_text;

  // Get highlight parts or fallback to plain text
  const highlightParts = renderContextWithHighlight(contextWithSpeakers, highlightWord);

  return (
    <Card className={`transition-all ${getStatusStyles()}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
              {getStatusBadge()}
            </div>
            
            {/* Confirmed fragment actions */}
            {fragment.status === 'confirmed' && (
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 sm:h-8 gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 text-xs sm:text-sm px-2 sm:px-3"
                  onClick={() => onRevert?.()}
                  data-testid={`revert-fragment-${fragment.id}`}
                >
                  <Undo2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Отменить</span>
                </Button>
              </div>
            )}
            
            {/* Auto-corrected fragment actions */}
            {fragment.status === 'auto_corrected' && (
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 sm:h-8 bg-blue-600 hover:bg-blue-700 gap-1 text-xs sm:text-sm px-2 sm:px-3"
                  onClick={() => onConfirm(fragment.corrected_text || fragment.original_text)}
                  data-testid={`confirm-auto-${fragment.id}`}
                >
                  <Check className="w-3 h-3" />
                  <span className="hidden xs:inline">OK</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                  onClick={() => onEdit()}
                  data-testid={`edit-fragment-${fragment.id}`}
                >
                  <span className="hidden sm:inline">Изменить</span>
                  <span className="sm:hidden">✏️</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 sm:h-8 text-slate-600 px-2"
                  onClick={() => onEditContext?.()}
                  data-testid={`edit-context-${fragment.id}`}
                  title="Редактировать окружающий текст"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            
            {/* Pending fragment actions */}
            {fragment.status === 'pending' && (
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                  onClick={() => onConfirm(fragment.original_text)}
                  data-testid={`confirm-as-is-${fragment.id}`}
                >
                  <Check className="w-3 h-3 sm:mr-1" />
                  <span className="hidden sm:inline">Оставить</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                  onClick={() => onEdit()}
                  data-testid={`edit-fragment-${fragment.id}`}
                >
                  <span className="hidden sm:inline">Исправить</span>
                  <span className="sm:hidden">✏️</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 sm:h-8 text-slate-600 px-2"
                  onClick={() => onEditContext?.()}
                  data-testid={`edit-context-${fragment.id}`}
                  title="Редактировать окружающий текст"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Confirmed notice */}
          {fragment.status === 'confirmed' && fragment.corrected_text && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-100/60 rounded-lg text-sm text-green-800">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                Исправлено: <code className="bg-red-200/60 px-1.5 py-0.5 rounded text-red-900 line-through">{fragment.original_text}</code> → <code className="bg-green-200/60 px-1.5 py-0.5 rounded text-green-900 font-medium">{fragment.corrected_text}</code>
              </span>
            </div>
          )}
          
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
              {highlightParts ? (
                highlightParts.map(part => 
                  part.type === 'highlight' ? (
                    <mark key={part.key} className="bg-orange-200 text-orange-900 px-1 rounded font-medium">
                      {part.value}
                    </mark>
                  ) : (
                    <span key={part.key}>{part.value}</span>
                  )
                )
              ) : (
                contextWithSpeakers
              )}
            </p>
          </div>
          
          {/* Current word and correction for pending */}
          {fragment.status === 'pending' && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Сомнительное слово:</span>
              <code className="bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium">
                {fragment.original_text}
              </code>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
