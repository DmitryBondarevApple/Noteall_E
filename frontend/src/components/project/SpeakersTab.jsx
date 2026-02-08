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
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { speakersApi } from '../../lib/api';

export function SpeakersTab({ speakers, projectId, onSpeakersUpdate }) {
  const [editingSpeaker, setEditingSpeaker] = useState(null);

  const handleUpdateSpeaker = async (speaker, newName) => {
    try {
      await speakersApi.update(projectId, speaker.id, {
        speaker_label: speaker.speaker_label,
        speaker_name: newName
      });
      const updatedSpeakers = speakers.map(s =>
        s.id === speaker.id ? { ...s, speaker_name: newName } : s
      );
      onSpeakersUpdate(updatedSpeakers);
      setEditingSpeaker(null);
      toast.success('Спикер обновлен');
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Разметка спикеров</CardTitle>
          <CardDescription>
            Назначьте имена участникам встречи
          </CardDescription>
        </CardHeader>
        <CardContent>
          {speakers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-4" />
              <p>Спикеры будут определены после транскрибации</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {speakers.map((speaker, index) => (
                <Card key={speaker.id} className={`speaker-${(index % 4) + 1}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold">
                          {speaker.speaker_name[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{speaker.speaker_name}</p>
                          <p className="text-xs text-muted-foreground">{speaker.speaker_label}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSpeaker(speaker)}
                        data-testid={`edit-speaker-${speaker.id}`}
                      >
                        Изменить
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
              Введите имя участника встречи
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
  const [name, setName] = useState(speaker.speaker_name);

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Метка</Label>
        <code className="block bg-slate-100 p-2 rounded">{speaker.speaker_label}</code>
      </div>
      <div className="space-y-2">
        <Label>Имя участника</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Антон"
          data-testid="edit-speaker-input"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Отмена</Button>
        <Button onClick={() => onSave(name)} data-testid="save-speaker-btn">Сохранить</Button>
      </div>
    </div>
  );
}
