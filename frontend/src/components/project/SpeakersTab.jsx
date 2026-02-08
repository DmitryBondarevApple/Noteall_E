import React, { useState } from 'react';
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
import { Users, ExternalLink, Sparkles, Pencil, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { speakersApi } from '../../lib/api';
import { SpeakerCombobox } from './SpeakerCombobox';

const SPEAKER_COLORS = [
  { border: 'border-l-sky-400', bg: 'bg-sky-50', avatar: 'bg-sky-100 text-sky-700' },
  { border: 'border-l-pink-400', bg: 'bg-pink-50', avatar: 'bg-pink-100 text-pink-700' },
  { border: 'border-l-emerald-400', bg: 'bg-emerald-50', avatar: 'bg-emerald-100 text-emerald-700' },
  { border: 'border-l-amber-400', bg: 'bg-amber-50', avatar: 'bg-amber-100 text-amber-700' },
];

export function SpeakersTab({ speakers, projectId, aiHints, onSpeakersUpdate }) {
  const [editingSpeaker, setEditingSpeaker] = useState(null);

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

  const getAiHint = (speakerLabel) => {
    if (!aiHints) return null;
    return aiHints[speakerLabel] || null;
  };

  const getColor = (index) => SPEAKER_COLORS[index % SPEAKER_COLORS.length];

  return (
    <>
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between px-0 pt-0">
          <div>
            <CardTitle className="text-xl tracking-tight" data-testid="speakers-title">
              Разметка спикеров
            </CardTitle>
            <CardDescription className="mt-1">
              {speakers.length > 0
                ? `${speakers.length} ${speakers.length === 1 ? 'участник' : speakers.length < 5 ? 'участника' : 'участников'} определено`
                : 'Назначьте имена участникам встречи'}
            </CardDescription>
          </div>
          <Link to="/speakers">
            <Button variant="outline" size="sm" className="gap-2 rounded-full" data-testid="open-directory-btn">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Справочник</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {speakers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl" data-testid="speakers-empty-state">
              <Users className="w-10 h-10 mx-auto mb-4 opacity-40" />
              <p className="text-sm">Спикеры будут определены после транскрибации</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="speakers-list">
              {speakers.map((speaker, index) => {
                const hint = getAiHint(speaker.speaker_label);
                const color = getColor(index);
                const isRenamed = !speaker.speaker_name.startsWith('Speaker');

                return (
                  <div
                    key={speaker.id}
                    className={`group relative rounded-xl border ${color.border} border-l-4 bg-white p-5 transition-all duration-200 hover:shadow-md`}
                    data-testid={`speaker-card-${speaker.id}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full ${color.avatar} flex items-center justify-center font-semibold text-lg shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                        {speaker.speaker_name[0]?.toUpperCase() || '?'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-base truncate" data-testid={`speaker-name-${speaker.id}`}>
                            {speaker.speaker_name}
                          </span>
                          {isRenamed && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal opacity-70">
                              {speaker.speaker_label}
                            </Badge>
                          )}
                        </div>

                        {!isRenamed && (
                          <p className="text-xs text-muted-foreground">{speaker.speaker_label}</p>
                        )}

                        {/* AI Hints as inline tags */}
                        {hint && (hint.possible_name || hint.gender || hint.role) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2" data-testid={`speaker-hints-${speaker.id}`}>
                            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                            {hint.gender && (
                              <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 font-normal border-slate-200 text-slate-600">
                                {hint.gender === 'м' ? 'Муж.' : hint.gender === 'ж' ? 'Жен.' : '—'}
                              </Badge>
                            )}
                            {hint.possible_name && (
                              <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 font-normal border-indigo-200 text-indigo-600 bg-indigo-50/50">
                                <User className="w-3 h-3 mr-1" />
                                {hint.possible_name}
                              </Badge>
                            )}
                            {hint.role && (
                              <Badge variant="outline" className="text-[11px] px-2 py-0 h-5 font-normal border-amber-200 text-amber-700 bg-amber-50/50">
                                <Briefcase className="w-3 h-3 mr-1" />
                                <span className="truncate max-w-[200px] sm:max-w-[300px]">{hint.role}</span>
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Edit button — icon on mobile, text on desktop */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 h-9 w-9 p-0 sm:h-8 sm:w-auto sm:px-3"
                        onClick={() => setEditingSpeaker(speaker)}
                        data-testid={`edit-speaker-${speaker.id}`}
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground sm:hidden" />
                        <span className="hidden sm:inline text-xs text-muted-foreground">Изменить</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Speaker Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent className="sm:max-w-md">
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

function EditSpeakerForm({ speaker, hint, onSave, onCancel }) {
  const [name, setName] = useState(speaker.speaker_name);

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
      
      {/* AI Hint in dialog */}
      {hint && (hint.possible_name || hint.gender || hint.role) && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-sm text-indigo-700">
            AI-подсказка:
            {hint.gender && (hint.gender === 'м' ? ' мужчина' : hint.gender === 'ж' ? ' женщина' : '')}
            {hint.possible_name && `, возможно "${hint.possible_name}"`}
            {hint.role && ` (${hint.role})`}
          </span>
        </div>
      )}
      
      <div className="space-y-1.5">
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
