import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { speakersApi } from '../../lib/api';
import { SpeakerCombobox } from './SpeakerCombobox';
import { AttachmentsPanel } from './AttachmentsPanel';

const SPEAKER_COLORS = [
  { bg: 'bg-sky-100 hover:bg-sky-200', text: 'text-sky-800', border: 'border-sky-200' },
  { bg: 'bg-pink-100 hover:bg-pink-200', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-emerald-100 hover:bg-emerald-200', text: 'text-emerald-800', border: 'border-emerald-200' },
  { bg: 'bg-amber-100 hover:bg-amber-200', text: 'text-amber-800', border: 'border-amber-200' },
  { bg: 'bg-violet-100 hover:bg-violet-200', text: 'text-violet-800', border: 'border-violet-200' },
  { bg: 'bg-rose-100 hover:bg-rose-200', text: 'text-rose-800', border: 'border-rose-200' },
];

function getSpeakerColor(index) {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

/** Build display name — always use speaker_name which stores full format */
function formatSpeakerDisplay(speaker) {
  if (!speaker) return '';
  return speaker.speaker_name || speaker.speaker_label;
}

/** Parse "Имя Фамилия (Компания)" into parts */
function parseSpeakerInput(input) {
  const trimmed = input.trim();
  const companyMatch = trimmed.match(/^(.+?)\s*\((.+?)\)\s*$/);
  
  let namePart, company;
  if (companyMatch) {
    namePart = companyMatch[1].trim();
    company = companyMatch[2].trim();
  } else {
    namePart = trimmed;
    company = null;
  }
  
  const nameParts = namePart.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || null;
  
  return { firstName, lastName, company, displayName: trimmed };
}

export function TranscriptTab({ transcript, speakers, projectId, onSpeakersUpdate }) {
  const [editingSpeaker, setEditingSpeaker] = useState(null);

  // Build speaker color map by label
  const speakerColorMap = useMemo(() => {
    const map = {};
    speakers.forEach((s, i) => {
      map[s.speaker_label] = { ...s, color: getSpeakerColor(i), index: i };
    });
    return map;
  }, [speakers]);

  const handleUpdateSpeaker = async (speaker, newName) => {
    if (!newName.trim()) {
      toast.error('Введите имя спикера');
      return;
    }

    const parsed = parseSpeakerInput(newName);

    try {
      await speakersApi.update(projectId, speaker.id, {
        speaker_label: speaker.speaker_label,
        speaker_name: parsed.displayName,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        company: parsed.company,
      });
      const updatedSpeakers = speakers.map(s =>
        s.id === speaker.id
          ? { ...s, speaker_name: parsed.displayName, first_name: parsed.firstName, last_name: parsed.lastName, company: parsed.company }
          : s
      );
      onSpeakersUpdate(updatedSpeakers);
      setEditingSpeaker(null);
      toast.success('Спикер обновлен');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  /** Render transcript with clickable speaker badges */
  const renderedContent = useMemo(() => {
    if (!transcript?.content) return null;

    const content = transcript.content;
    // Match "Speaker N:" patterns at the start of lines
    const regex = /(Speaker \d+):/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Text before the speaker label
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.slice(lastIndex, match.index), key: `t-${lastIndex}` });
      }

      const label = match[1];
      const speakerData = speakerColorMap[label];
      parts.push({
        type: 'speaker',
        label,
        speaker: speakerData,
        key: `s-${match.index}`,
      });

      lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.slice(lastIndex), key: `t-${lastIndex}` });
    }

    return parts;
  }, [transcript, speakerColorMap]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="shrink-0">
            <CardTitle>Исходный транскрипт</CardTitle>
            <CardDescription>
              Результат распознавания от Deepgram (без обработки)
            </CardDescription>
          </div>
          {speakers.length > 0 && (
            <div className="flex flex-col items-end gap-1.5 max-w-sm" data-testid="speakers-summary">
              <div className="flex flex-wrap justify-end items-center gap-1.5">
                {speakers.map((s, i) => {
                  const color = getSpeakerColor(i);
                  const isUnnamed = s.speaker_name.startsWith('Speaker ');
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border cursor-pointer transition-colors duration-150 ${color.bg} ${color.text} ${color.border} ${isUnnamed ? 'border-dashed opacity-70' : ''}`}
                      onClick={() => setEditingSpeaker(s)}
                      data-testid={`speaker-summary-${s.id}`}
                    >
                      {s.speaker_name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Нажмите на имя, чтобы назначить спикера</p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {transcript ? (
            <ScrollArea className="h-[500px] rounded-lg border p-6 bg-white">
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans" data-testid="raw-transcript-content">
                {renderedContent?.map((part) => {
                  if (part.type === 'text') {
                    return <span key={part.key}>{part.value}</span>;
                  }
                  if (part.type === 'speaker') {
                    const color = part.speaker?.color || getSpeakerColor(0);
                    const displayName = part.speaker
                      ? formatSpeakerDisplay(part.speaker)
                      : part.label;
                    return (
                      <button
                        key={part.key}
                        type="button"
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border cursor-pointer transition-colors duration-150 ${color.bg} ${color.text} ${color.border}`}
                        onClick={() => part.speaker && setEditingSpeaker(part.speaker)}
                        data-testid={`speaker-badge-${part.label.replace(' ', '-')}`}
                      >
                        {displayName}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Транскрибация в процессе...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <AttachmentsPanel projectId={projectId} />
        </CardContent>
      </Card>

      {/* Edit Speaker Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить имя спикера</DialogTitle>
            <DialogDescription>
              Выберите из справочника или введите в формате: Имя Фамилия (Компания)
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
    </>
  );
}

function EditSpeakerForm({ speaker, onSave, onCancel }) {
  const [name, setName] = useState(formatSpeakerDisplay(speaker));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(name);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Метка в транскрипте</Label>
        <code className="block bg-slate-50 p-2 rounded-lg text-sm border">{speaker.speaker_label}</code>
      </div>

      <div className="space-y-1.5">
        <Label>Имя участника</Label>
        <SpeakerCombobox
          value={name}
          onChange={setName}
          placeholder="Имя Фамилия (Компания)"
        />
        <p className="text-xs text-muted-foreground">
          Формат: Имя Фамилия (Компания) — компания в скобках опционально
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-full">
          Отмена
        </Button>
        <Button type="submit" className="rounded-full" data-testid="save-speaker-btn">
          Сохранить
        </Button>
      </div>
    </form>
  );
}
