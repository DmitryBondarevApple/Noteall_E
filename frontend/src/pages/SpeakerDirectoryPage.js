import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { speakerDirectoryApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../components/ui/toggle-group';
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
  Loader2,
  Phone,
  Camera,
  Upload,
  LayoutGrid,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';

// Telegram icon component
const TelegramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

// WhatsApp icon component
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function SpeakerDirectoryPage() {
  const { user } = useAuth();
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [deletingSpeaker, setDeletingSpeaker] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'company'

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

  // Group speakers by company
  const groupedSpeakers = useMemo(() => {
    const groups = {};
    speakers.forEach(speaker => {
      const company = speaker.company || 'Без компании';
      if (!groups[company]) {
        groups[company] = [];
      }
      groups[company].push(speaker);
    });
    
    // Sort companies alphabetically, but "Без компании" goes last
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Без компании') return 1;
      if (b === 'Без компании') return -1;
      return a.localeCompare(b);
    });
    
    return sortedKeys.map(company => ({
      company,
      speakers: groups[company].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [speakers]);

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

  const handleUpdateSpeaker = async (data, photoFile) => {
    try {
      const res = await speakerDirectoryApi.update(editingSpeaker.id, data);
      let updatedSpeaker = res.data;
      
      if (photoFile) {
        const photoRes = await speakerDirectoryApi.uploadPhoto(editingSpeaker.id, photoFile);
        updatedSpeaker = { ...updatedSpeaker, photo_url: photoRes.data.photo_url };
      }
      
      setSpeakers(speakers.map(s => s.id === editingSpeaker.id ? updatedSpeaker : s).sort((a, b) => a.name.localeCompare(b.name)));
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
    <AppLayout>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5" />
                Справочник спикеров
              </h1>
              <p className="text-sm text-muted-foreground">
                {speakers.length} {speakers.length === 1 ? 'контакт' : speakers.length < 5 ? 'контакта' : 'контактов'}
                {viewMode === 'company' && groupedSpeakers.length > 0 && (
                  <span> • {groupedSpeakers.length} {groupedSpeakers.length === 1 ? 'компания' : groupedSpeakers.length < 5 ? 'компании' : 'компаний'}</span>
                )}
              </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2" data-testid="add-speaker-btn">
            <Plus className="w-4 h-4" />
            Добавить спикера
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Search and View Toggle */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="speaker-search-input"
            />
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)}>
            <ToggleGroupItem value="list" aria-label="Списком" data-testid="view-list-btn">
              <LayoutGrid className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="company" aria-label="По компаниям" data-testid="view-company-btn">
              <Building2 className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Speakers */}
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
        ) : viewMode === 'list' ? (
          // List View
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {speakers.map((speaker) => (
              <SpeakerCard
                key={speaker.id}
                speaker={speaker}
                onEdit={() => setEditingSpeaker(speaker)}
                onDelete={() => setDeletingSpeaker(speaker)}
              />
            ))}
          </div>
        ) : (
          // Grouped by Company View
          <div className="space-y-8">
            {groupedSpeakers.map(({ company, speakers: companySpeakers }) => (
              <div key={company}>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg font-semibold">{company}</h2>
                  <span className="text-sm text-muted-foreground">
                    ({companySpeakers.length})
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {companySpeakers.map((speaker) => (
                    <SpeakerCard
                      key={speaker.id}
                      speaker={speaker}
                      onEdit={() => setEditingSpeaker(speaker)}
                      onDelete={() => setDeletingSpeaker(speaker)}
                      hideCompany
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Speaker Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              allowPhoto
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
    </AppLayout>
  );
}

// Speaker Card Component
function SpeakerCard({ speaker, onEdit, onDelete, hideCompany = false }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {speaker.photo_url ? (
              <img 
                src={speaker.photo_url} 
                alt={speaker.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="w-6 h-6 text-indigo-600" />
              </div>
            )}
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
              onClick={onEdit}
              data-testid={`edit-speaker-${speaker.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
              data-testid={`delete-speaker-${speaker.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Contact info */}
        {((!hideCompany && speaker.company) || speaker.email || speaker.phone || speaker.telegram || speaker.whatsapp) && (
          <div className="mt-3 pt-3 border-t space-y-1.5">
            {!hideCompany && speaker.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{speaker.company}</span>
              </div>
            )}
            {speaker.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{speaker.email}</span>
              </div>
            )}
            {speaker.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{speaker.phone}</span>
              </div>
            )}
            {(speaker.telegram || speaker.whatsapp) && (
              <div className="flex items-center gap-3 pt-1">
                {speaker.telegram && (
                  <a 
                    href={`https://t.me/${speaker.telegram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
                  >
                    <TelegramIcon className="w-4 h-4" />
                    <span>{speaker.telegram}</span>
                  </a>
                )}
                {speaker.whatsapp && (
                  <a 
                    href={`https://wa.me/${speaker.whatsapp.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-green-500 hover:text-green-600"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>{speaker.whatsapp}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Comment */}
        {speaker.comment && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground line-clamp-2">{speaker.comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Speaker Form Component
function SpeakerForm({ speaker, onSave, onCancel, allowPhoto = false }) {
  const [name, setName] = useState(speaker?.name || '');
  const [email, setEmail] = useState(speaker?.email || '');
  const [company, setCompany] = useState(speaker?.company || '');
  const [role, setRole] = useState(speaker?.role || '');
  const [phone, setPhone] = useState(speaker?.phone || '');
  const [telegram, setTelegram] = useState(speaker?.telegram || '');
  const [whatsapp, setWhatsapp] = useState(speaker?.whatsapp || '');
  const [comment, setComment] = useState(speaker?.comment || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(speaker?.photo_url || null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Выберите изображение');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

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
        role: role.trim() || null,
        phone: phone.trim() || null,
        telegram: telegram.trim() || null,
        whatsapp: whatsapp.trim() || null,
        comment: comment.trim() || null
      }, photoFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {/* Photo upload */}
      {allowPhoto && (
        <div className="flex items-center gap-4">
          <div 
            className="relative w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-200 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8 text-slate-400" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? 'Изменить фото' : 'Загрузить фото'}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG до 5MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
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
        
        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
            data-testid="speaker-phone-input"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="telegram">Telegram</Label>
          <Input
            id="telegram"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="@username"
            data-testid="speaker-telegram-input"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+7 999 123-45-67"
            data-testid="speaker-whatsapp-input"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="comment">Комментарий</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Заметки о спикере..."
          rows={3}
          data-testid="speaker-comment-input"
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
