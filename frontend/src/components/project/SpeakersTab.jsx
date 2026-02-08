import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Users, ExternalLink, MessageSquare, Sparkles, User, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { speakersApi } from '../../lib/api';
import { SpeakerCombobox } from './SpeakerCombobox';

// Extract sample utterances for a speaker from transcript
function extractSpeakerUtterances(transcript, speakerLabel, minLength = 100, maxCount = 3) {
  if (!transcript) return [];
  
  const lines = transcript.split('\n');
  const utterances = [];
  let currentUtterance = '';
  let isCurrentSpeaker = false;
  
  // Normalize speaker label for matching (e.g., "Speaker 1" matches "Speaker 1:")
  const labelPattern = new RegExp(`^\\*{0,2}${speakerLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*{0,2}:?\\s*`, 'i');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if line starts with any speaker label
    const speakerMatch = trimmed.match(/^\*{0,2}(Speaker\s*\d+|[А-Яа-яA-Za-z\s]+)\*{0,2}:\s*/i);
    
    if (speakerMatch) {
      // Save previous utterance if it was from our speaker
      if (isCurrentSpeaker && currentUtterance.trim()) {
        utterances.push(currentUtterance.trim());
      }
      
      // Check if this is our speaker
      isCurrentSpeaker = labelPattern.test(trimmed);
      currentUtterance = isCurrentSpeaker ? trimmed.replace(labelPattern, '') : '';
    } else if (isCurrentSpeaker) {
      // Continue current speaker's utterance
      currentUtterance += ' ' + trimmed;
    }
  }
  
  // Don't forget the last utterance
  if (isCurrentSpeaker && currentUtterance.trim()) {
    utterances.push(currentUtterance.trim());
  }
  
  // Sort by length (longest first)
  utterances.sort((a, b) => b.length - a.length);
  
  // Filter by minimum length, but if none match, take the longest ones
  const longEnough = utterances.filter(u => u.length >= minLength);
  const result = longEnough.length >= maxCount 
    ? longEnough.slice(0, maxCount)
    : utterances.slice(0, maxCount);
  
  return result;
}

export function SpeakersTab({ speakers, projectId, rawTranscript, aiHints, onSpeakersUpdate }) {
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [expandedSpeakers, setExpandedSpeakers] = useState(new Set());

  // Extract utterances for all speakers
  const speakerUtterances = useMemo(() => {
    const result = {};
    speakers.forEach(speaker => {
      result[speaker.id] = extractSpeakerUtterances(rawTranscript, speaker.speaker_label);
    });
    return result;
  }, [speakers, rawTranscript]);

  const toggleExpanded = (speakerId) => {
    setExpandedSpeakers(prev => {
      const next = new Set(prev);
      if (next.has(speakerId)) {
        next.delete(speakerId);
      } else {
        next.add(speakerId);
      }
      return next;
    });
  };

  const handleUpdateSpeaker = async (speaker, newName) => {
    if (!newName.trim()) {
      toast.error('Введите имя спикера');
      return;
    }
    
    try {
      await speakersApi.update(projectId, speaker.id, {
        speaker_label: speaker.speaker_label,
        speaker_name: newName.trim()
      });
      const updatedSpeakers = speakers.map(s =>
        s.id === speaker.id ? { ...s, speaker_name: newName.trim() } : s
      );
      onSpeakersUpdate(updatedSpeakers);
      setEditingSpeaker(null);
      toast.success('Спикер обновлен');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const applyAiHint = (speaker, hint) => {
    if (hint?.possible_name) {
      handleUpdateSpeaker(speaker, hint.possible_name);
    }
  };

  const getAiHint = (speakerLabel) => {
    if (!aiHints) return null;
    return aiHints[speakerLabel] || null;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Разметка спикеров</CardTitle>
            <CardDescription>
              Назначьте имена участникам встречи
            </CardDescription>
          </div>
          <Link to="/speakers">
            <Button variant="outline" size="sm" className="gap-2" data-testid="open-directory-btn">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Справочник</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {speakers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-4" />
              <p>Спикеры будут определены после транскрибации</p>
            </div>
          ) : (
            <div className="space-y-4">
              {speakers.map((speaker, index) => {
                const utterances = speakerUtterances[speaker.id] || [];
                const hint = getAiHint(speaker.speaker_label);
                const isExpanded = expandedSpeakers.has(speaker.id);
                
                return (
                  <Card key={speaker.id} className={`speaker-${(index % 4) + 1} overflow-hidden`}>
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold shrink-0">
                            {speaker.speaker_name[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{speaker.speaker_name}</p>
                            <p className="text-xs text-muted-foreground">{speaker.speaker_label}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingSpeaker(speaker)}
                          data-testid={`edit-speaker-${speaker.id}`}
                        >
                          <span className="hidden sm:inline">Изменить</span>
                          <span className="sm:hidden">✏️</span>
                        </Button>
                      </div>
                      
                      {/* AI Hint */}
                      {hint && (hint.possible_name || hint.gender) && (
                        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-indigo-50 rounded-lg">
                          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="text-sm text-indigo-700">
                            {hint.gender && (
                              <Badge variant="outline" className="mr-2 text-xs">
                                {hint.gender === 'м' ? '👨 Муж.' : hint.gender === 'ж' ? '👩 Жен.' : '❓'}
                              </Badge>
                            )}
                            {hint.possible_name && `Возможно: "${hint.possible_name}"`}
                            {hint.role && ` (${hint.role})`}
                          </span>
                          {hint.possible_name && speaker.speaker_name.startsWith('Speaker') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs ml-auto"
                              onClick={() => applyAiHint(speaker, hint)}
                            >
                              Применить
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {/* Sample Utterances */}
                      {utterances.length > 0 && (
                        <div className="space-y-2">
                          <button
                            onClick={() => toggleExpanded(speaker.id)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Примеры реплик ({utterances.length})</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                          </button>
                          
                          {isExpanded && (
                            <div className="space-y-2 pl-6 border-l-2 border-slate-200">
                              {utterances.map((text, i) => (
                                <p key={i} className="text-sm text-muted-foreground italic">
                                  "{text.length > 150 ? text.slice(0, 150) + '...' : text}"
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Speaker Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить имя спикера</DialogTitle>
            <DialogDescription>
              Выберите из справочника или введите новое имя
            </DialogDescription>
          </DialogHeader>
          {editingSpeaker && (
            <EditSpeakerForm
              speaker={editingSpeaker}
              hint={getAiHint(editingSpeaker.speaker_label)}
              onSave={(name) => handleUpdateSpeaker(editingSpeaker, name)}
              onCancel={() => setEditingSpeaker(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditSpeakerForm({ speaker, onSave, onCancel }) {
  const [name, setName] = useState(speaker.speaker_name);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(name);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Метка в транскрипте</Label>
        <code className="block bg-slate-100 p-2 rounded">{speaker.speaker_label}</code>
      </div>
      <div className="space-y-2">
        <Label>Имя участника</Label>
        <SpeakerCombobox
          value={name}
          onChange={setName}
          placeholder="Начните вводить имя..."
        />
        <p className="text-xs text-muted-foreground">
          Начните вводить для поиска в справочнике или введите новое имя
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" data-testid="save-speaker-btn">
          Сохранить
        </Button>
      </div>
    </form>
  );
}
