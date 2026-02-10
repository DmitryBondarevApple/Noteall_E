import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { speakerDirectoryApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Users, Plus, Search, Pencil, Trash2, ArrowLeft, User, Building,
  Mail, Loader2, Phone, Tag, MoreHorizontal, X, Filter, SortAsc, SortDesc,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function SpeakerDirectoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Dialogs
  const [editDialog, setEditDialog] = useState({ open: false, speaker: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, speaker: null });
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState({ name: '', email: '', company: '', role: '', phone: '', telegram: '', whatsapp: '', comment: '', tags: '' });

  const loadSpeakers = useCallback(async () => {
    try {
      const res = await speakerDirectoryApi.list();
      setSpeakers(res.data);
    } catch { toast.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSpeakers(); }, [loadSpeakers]);

  // Derived data
  const allCompanies = useMemo(() => {
    const set = new Set(speakers.map(s => s.company).filter(Boolean));
    return [...set].sort();
  }, [speakers]);

  const allTags = useMemo(() => {
    const set = new Set(speakers.flatMap(s => s.tags || []));
    return [...set].sort();
  }, [speakers]);

  const filtered = useMemo(() => {
    let list = [...speakers];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.company || '').toLowerCase().includes(q) ||
        (s.role || '').toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterCompany) list = list.filter(s => s.company === filterCompany);
    if (filterTag) list = list.filter(s => (s.tags || []).includes(filterTag));

    list.sort((a, b) => {
      const av = (a[sortField] || '').toLowerCase();
      const bv = (b[sortField] || '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [speakers, searchQuery, filterCompany, filterTag, sortField, sortDir]);

  // CRUD
  const openCreate = () => {
    setForm({ name: '', email: '', company: '', role: '', phone: '', telegram: '', whatsapp: '', comment: '', tags: '' });
    setEditDialog({ open: true, speaker: null });
  };

  const openEdit = (speaker) => {
    setForm({
      name: speaker.name || '',
      email: speaker.email || '',
      company: speaker.company || '',
      role: speaker.role || '',
      phone: speaker.phone || '',
      telegram: speaker.telegram || '',
      whatsapp: speaker.whatsapp || '',
      comment: speaker.comment || '',
      tags: (speaker.tags || []).join(', '),
    });
    setEditDialog({ open: true, speaker });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const data = { ...form, tags };
    try {
      if (editDialog.speaker) {
        await speakerDirectoryApi.update(editDialog.speaker.id, data);
        toast.success('Спикер обновлён');
      } else {
        await speakerDirectoryApi.create(data);
        toast.success('Спикер добавлен');
      }
      setEditDialog({ open: false, speaker: null });
      loadSpeakers();
    } catch { toast.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog.speaker) return;
    try {
      await speakerDirectoryApi.delete(deleteDialog.speaker.id);
      toast.success('Спикер удалён');
      setDeleteDialog({ open: false, speaker: null });
      loadSpeakers();
    } catch { toast.error('Ошибка'); }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />;
  };

  const hasActiveFilters = filterCompany || filterTag;

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/meetings')} data-testid="back-to-meetings">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="speakers-title">
                <Users className="w-5 h-5" /> Справочник спикеров
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {speakers.length} {speakers.length === 1 ? 'контакт' : speakers.length < 5 ? 'контакта' : 'контактов'}
              </p>
            </div>
            <Button className="gap-1.5" size="sm" onClick={openCreate} data-testid="add-speaker-btn">
              <Plus className="w-4 h-4" /> Добавить
            </Button>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Поиск по имени, компании, тегу..." className="pl-9 h-8 text-sm" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} data-testid="speaker-search" />
          </div>

          {/* Company filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={filterCompany ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1.5" data-testid="filter-company-btn">
                <Building className="w-3.5 h-3.5" />
                {filterCompany || 'Компания'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
              {filterCompany && (
                <DropdownMenuItem onClick={() => setFilterCompany('')}>
                  <X className="w-3.5 h-3.5 mr-1.5 text-red-400" /> Сбросить
                </DropdownMenuItem>
              )}
              {allCompanies.map(c => (
                <DropdownMenuItem key={c} onClick={() => setFilterCompany(c)}>
                  {c}
                </DropdownMenuItem>
              ))}
              {allCompanies.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Нет компаний</div>}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tag filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={filterTag ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1.5" data-testid="filter-tag-btn">
                <Tag className="w-3.5 h-3.5" />
                {filterTag || 'Тег'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
              {filterTag && (
                <DropdownMenuItem onClick={() => setFilterTag('')}>
                  <X className="w-3.5 h-3.5 mr-1.5 text-red-400" /> Сбросить
                </DropdownMenuItem>
              )}
              {allTags.map(t => (
                <DropdownMenuItem key={t} onClick={() => setFilterTag(t)}>
                  {t}
                </DropdownMenuItem>
              ))}
              {allTags.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Нет тегов</div>}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400" onClick={() => { setFilterCompany(''); setFilterTag(''); }}>
              Сбросить фильтры
            </Button>
          )}

          <span className="text-xs text-slate-400 ml-auto">{filtered.length} из {speakers.length}</span>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-6 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : speakers.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-medium text-slate-500 mb-1">Справочник пуст</p>
              <p className="text-xs text-slate-400 mb-4">Добавьте первого спикера</p>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="w-4 h-4" /> Добавить спикера
              </Button>
            </div>
          ) : (
            <table className="w-full" data-testid="speakers-table">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-2.5 cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">Имя <SortIcon field="name" /></span>
                  </th>
                  <th className="px-4 py-2.5 cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort('company')}>
                    <span className="flex items-center gap-1">Компания <SortIcon field="company" /></span>
                  </th>
                  <th className="px-4 py-2.5 cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort('role')}>
                    <span className="flex items-center gap-1">Должность <SortIcon field="role" /></span>
                  </th>
                  <th className="px-4 py-2.5">Контакты</th>
                  <th className="px-4 py-2.5">Теги</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(speaker => (
                  <tr key={speaker.id} className="group hover:bg-slate-50 transition-colors" data-testid={`speaker-row-${speaker.id}`}>
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {speaker.photo_url ? (
                          <img src={speaker.photo_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-medium text-slate-500">{speaker.name[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <span className="text-sm font-medium truncate max-w-[200px]">{speaker.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 truncate max-w-[160px]">{speaker.company || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 truncate max-w-[160px]">{speaker.role || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {speaker.email && <Mail className="w-3.5 h-3.5 text-slate-400" title={speaker.email} />}
                        {speaker.phone && <Phone className="w-3.5 h-3.5 text-slate-400" title={speaker.phone} />}
                        {speaker.telegram && <span className="text-[10px] text-blue-500 font-medium" title={speaker.telegram}>TG</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(speaker.tags || []).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5 cursor-pointer hover:bg-slate-200"
                            onClick={() => setFilterTag(tag)}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => openEdit(speaker)}>
                            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ open: true, speaker })}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-sm text-slate-400">Ничего не найдено</td></tr>
                )}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, speaker: null })}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.speaker ? 'Редактировать спикера' : 'Новый спикер'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Имя *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Имя Фамилия" data-testid="speaker-name-input" />
              </div>
              <div>
                <Label className="text-xs">Компания</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="ООО Компания" data-testid="speaker-company-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Должность</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Менеджер" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Телефон</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7..." />
              </div>
              <div>
                <Label className="text-xs">Telegram</Label>
                <Input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="@username" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Теги (через запятую)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="руководство, техотдел, партнёр" data-testid="speaker-tags-input" />
            </div>
            <div>
              <Label className="text-xs">Заметка</Label>
              <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Любая дополнительная информация" rows={2} className="text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditDialog({ open: false, speaker: null })}>Отмена</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()} data-testid="speaker-save-btn">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editDialog.speaker ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, speaker: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить спикера?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.speaker?.name} будет удалён из справочника.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
