import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { speakerDirectoryApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Users, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  ArrowLeft,
  User,
  Building,
  Mail,
  Briefcase,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function SpeakerDirectoryPage() {
  const { user } = useAuth();
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [deletingSpeaker, setDeletingSpeaker] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const loadSpeakers = useCallback(async (query = '') => {
    try {
      const res = await speakerDirectoryApi.list(query || null);
      setSpeakers(res.data);
    } catch (error) {
      toast.error('Ошибка загрузки справочника');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpeakers();
  }, [loadSpeakers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSpeakers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadSpeakers]);

  const handleAddSpeaker = async (data) => {
    try {
      const res = await speakerDirectoryApi.create(data);
      setSpeakers([...speakers, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setIsAddDialogOpen(false);
      toast.success('Спикер добавлен');
    } catch (error) {
      toast.error('Ошибка добавления');
    }
  };

  const handleUpdateSpeaker = async (data) => {
    try {
      const res = await speakerDirectoryApi.update(editingSpeaker.id, data);
      setSpeakers(speakers.map(s => s.id === editingSpeaker.id ? res.data : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingSpeaker(null);
      toast.success('Спикер обновлён');
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const handleDeleteSpeaker = async () => {
    try {
      await speakerDirectoryApi.delete(deletingSpeaker.id);
      setSpeakers(speakers.filter(s => s.id !== deletingSpeaker.id));
      setDeletingSpeaker(null);
      toast.success('Спикер удалён');
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" data-testid="back-to-dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5" />
                Справочник спикеров
              </h1>
              <p className="text-sm text-muted-foreground">
                {speakers.length} {speakers.length === 1 ? 'контакт' : speakers.length < 5 ? 'контакта' : 'контактов'}
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2" data-testid="add-speaker-btn">
            <Plus className="w-4 h-4" />
            Добавить спикера
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="speaker-search-input"
          />
        </div>

        {/* Speakers Grid */}
        {speakers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? 'Ничего не найдено' : 'Справочник пуст'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Добавьте спикеров для быстрого выбора при разметке транскриптов'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Добавить первого спикера
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {speakers.map((speaker) => (
              <Card key={speaker.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium truncate" data-testid={`speaker-name-${speaker.id}`}>
                          {speaker.name}
                        </h3>
                        {speaker.role && (
                          <p className="text-sm text-muted-foreground truncate">{speaker.role}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingSpeaker(speaker)}
                        data-testid={`edit-speaker-${speaker.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeletingSpeaker(speaker)}
                        data-testid={`delete-speaker-${speaker.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {(speaker.company || speaker.email) && (
                    <div className="mt-3 pt-3 border-t space-y-1">
                      {speaker.company && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building className="w-3.5 h-3.5" />
                          <span className="truncate">{speaker.company}</span>
                        </div>
                      )}
                      {speaker.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          <span className="truncate">{speaker.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add Speaker Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить спикера</DialogTitle>
            <DialogDescription>
              Заполните информацию о новом спикере
            </DialogDescription>
          </DialogHeader>
          <SpeakerForm
            onSave={handleAddSpeaker}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Speaker Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать спикера</DialogTitle>
            <DialogDescription>
              Измените информацию о спикере
            </DialogDescription>
          </DialogHeader>
          {editingSpeaker && (
            <SpeakerForm
              speaker={editingSpeaker}
              onSave={handleUpdateSpeaker}
              onCancel={() => setEditingSpeaker(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSpeaker} onOpenChange={() => setDeletingSpeaker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить спикера?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить <strong>{deletingSpeaker?.name}</strong> из справочника?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSpeaker}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-speaker"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SpeakerForm({ speaker, onSave, onCancel }) {
  const [name, setName] = useState(speaker?.name || '');
  const [email, setEmail] = useState(speaker?.email || '');
  const [company, setCompany] = useState(speaker?.company || '');
  const [role, setRole] = useState(speaker?.role || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Введите имя спикера');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || null,
        company: company.trim() || null,
        role: role.trim() || null
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Имя *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Иван Петров"
          data-testid="speaker-name-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Должность</Label>
        <Input
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Продукт-менеджер"
          data-testid="speaker-role-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company">Компания</Label>
        <Input
          id="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Corp"
          data-testid="speaker-company-input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ivan@example.com"
          data-testid="speaker-email-input"
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={saving} data-testid="save-speaker-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {speaker ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </form>
  );
}
