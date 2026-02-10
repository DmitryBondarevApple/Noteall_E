import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { projectsApi, meetingFoldersApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '../components/ui/context-menu';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Plus, FolderOpen, FolderClosed, Mic, MoreHorizontal, Trash2, Edit2,
  ChevronRight, ChevronDown, Search, FolderPlus, FilePlus, Loader2,
  Users, Clock, FolderInput,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '../lib/utils';
import AppLayout from '../components/layout/AppLayout';

const statusMap = {
  new: { label: 'Новый', color: 'bg-slate-100 text-slate-600' },
  uploading: { label: 'Загрузка', color: 'bg-blue-100 text-blue-700' },
  transcribing: { label: 'Транскрибация', color: 'bg-amber-100 text-amber-700' },
  processing: { label: 'Обработка', color: 'bg-purple-100 text-purple-700' },
  ready: { label: 'Готов', color: 'bg-green-100 text-green-700' },
  error: { label: 'Ошибка', color: 'bg-red-100 text-red-700' },
};

export default function MeetingsPage() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const [folderDialog, setFolderDialog] = useState({ open: false, parentId: null, editId: null, name: '', description: '' });
  const [projectDialog, setProjectDialog] = useState({ open: false, folderId: null, name: '', description: '' });
  const [moveDialog, setMoveDialog] = useState({ open: false, projectId: null, projectName: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [foldersRes, projectsRes] = await Promise.all([
        meetingFoldersApi.list(),
        projectsApi.list(),
      ]);
      setFolders(foldersRes.data);
      setProjects(projectsRes.data);
      if (foldersRes.data.length > 0 && expandedFolders.size === 0) {
        setExpandedFolders(new Set(foldersRes.data.map(f => f.id)));
      }
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getRootFolders = () => folders.filter(f => !f.parent_id);
  const getChildFolders = (parentId) => folders.filter(f => f.parent_id === parentId);
  const getFolderProjects = (folderId) => projects.filter(p => p.folder_id === folderId);
  const orphanProjects = projects.filter(p => !p.folder_id);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  };

  // Folder CRUD
  const openFolderDialog = (parentId = null, editFolder = null) => {
    setFolderDialog({
      open: true, parentId,
      editId: editFolder?.id || null,
      name: editFolder?.name || '',
      description: editFolder?.description || '',
    });
  };

  const handleSaveFolder = async () => {
    if (!folderDialog.name.trim()) return;
    setSaving(true);
    try {
      if (folderDialog.editId) {
        await meetingFoldersApi.update(folderDialog.editId, {
          name: folderDialog.name, description: folderDialog.description || null,
        });
        toast.success('Папка обновлена');
      } else {
        await meetingFoldersApi.create({
          name: folderDialog.name, parent_id: folderDialog.parentId, description: folderDialog.description || null,
        });
        toast.success('Папка создана');
      }
      setFolderDialog({ open: false, parentId: null, editId: null, name: '', description: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally { setSaving(false); }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Удалить папку? Она должна быть пустой.')) return;
    try {
      await meetingFoldersApi.delete(folderId);
      toast.success('Удалено');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  // Project CRUD
  const openProjectDialog = (folderId) => {
    setProjectDialog({ open: true, folderId, name: '', description: '' });
  };

  const handleCreateProject = async () => {
    if (!projectDialog.name.trim()) return;
    setSaving(true);
    try {
      const res = await projectsApi.create({
        name: projectDialog.name,
        description: projectDialog.description || '',
        folder_id: projectDialog.folderId,
      });
      toast.success('Проект создан');
      setProjectDialog({ open: false, folderId: null, name: '', description: '' });
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally { setSaving(false); }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Удалить проект?')) return;
    try {
      await projectsApi.delete(projectId);
      toast.success('Удалено');
      loadData();
    } catch {
      toast.error('Ошибка');
    }
  };

  const handleMoveProject = async (targetFolderId) => {
    if (!moveDialog.projectId) return;
    try {
      await projectsApi.update(moveDialog.projectId, { folder_id: targetFolderId || null });
      toast.success('Проект перемещён');
      setMoveDialog({ open: false, projectId: null, projectName: '' });
      loadData();
    } catch {
      toast.error('Ошибка перемещения');
    }
  };

  // Search
  const matchesSearch = (name) => name.toLowerCase().includes(searchQuery.toLowerCase());
  const folderHasMatch = (folderId) => {
    if (!searchQuery) return true;
    const folder = folders.find(f => f.id === folderId);
    if (folder && matchesSearch(folder.name)) return true;
    if (getChildFolders(folderId).some(cf => folderHasMatch(cf.id))) return true;
    return getFolderProjects(folderId).some(p => matchesSearch(p.name));
  };

  const renderFolder = (folder, depth = 0) => {
    if (searchQuery && !folderHasMatch(folder.id)) return null;
    const isExpanded = expandedFolders.has(folder.id);
    const children = getChildFolders(folder.id);
    const folderProjects = getFolderProjects(folder.id);
    const hasContent = children.length > 0 || folderProjects.length > 0;

    return (
      <div key={folder.id} data-testid={`mfolder-${folder.id}`}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className="group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-slate-100"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => toggleFolder(folder.id)}
            >
              <button className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-400">
                {hasContent ? (
                  isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                ) : <span className="w-3.5" />}
              </button>
              {isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <FolderClosed className="w-4 h-4 text-amber-500 shrink-0" />}
              <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
              <span className="text-xs text-slate-400 mr-1">{folderProjects.length > 0 && folderProjects.length}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-opacity">
                    <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => openFolderDialog(folder.id)}>
                    <FolderPlus className="w-4 h-4 mr-2" /> Вложенная папка
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openProjectDialog(folder.id)}>
                    <FilePlus className="w-4 h-4 mr-2" /> Новый проект
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openFolderDialog(null, folder)}>
                    <Edit2 className="w-4 h-4 mr-2" /> Переименовать
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => openFolderDialog(folder.id)}>
              <FolderPlus className="w-4 h-4 mr-2" /> Вложенная папка
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openProjectDialog(folder.id)}>
              <FilePlus className="w-4 h-4 mr-2" /> Новый проект
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {isExpanded && (
          <div>
            {children.map(child => renderFolder(child, depth + 1))}
            {folderProjects.map(p => renderProject(p, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderProject = (project, depth = 0) => {
    if (searchQuery && !matchesSearch(project.name)) return null;
    const st = statusMap[project.status] || statusMap.new;
    return (
      <div
        key={project.id}
        className="group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-indigo-50"
        style={{ paddingLeft: `${depth * 16 + 28}px` }}
        onClick={() => navigate(`/projects/${project.id}`)}
        data-testid={`mproject-${project.id}`}
      >
        <Mic className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-sm truncate flex-1">{project.name}</span>
        <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', st.color)}>{st.label}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-opacity">
              <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}>
              <Edit2 className="w-4 h-4 mr-2" /> Открыть
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMoveDialog({ open: true, projectId: project.id, projectName: project.name }); }}>
              <FolderInput className="w-4 h-4 mr-2" /> Перенести в папку
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        <header className="bg-white border-b px-6 py-4 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="meetings-title">Встречи</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Транскрибация и анализ записей встреч</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/meetings/speakers">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="speakers-btn">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Спикеры</span>
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openFolderDialog()} data-testid="create-folder-btn">
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Папка</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-full max-w-2xl mx-auto p-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск проектов..." className="pl-9 h-9" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} data-testid="meeting-search-input" />
            </div>

            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : folders.length === 0 && projects.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Mic className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Начните работу</h3>
                  <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
                    Создайте папку для организации встреч, затем добавьте проекты транскрибации.
                  </p>
                  <Button onClick={() => openFolderDialog()} className="rounded-full gap-2" data-testid="empty-create-folder-btn">
                    <FolderPlus className="w-4 h-4" /> Создать папку
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ScrollArea className="max-h-[calc(100vh-220px)]">
                  <div className="p-2">
                    {getRootFolders().map(folder => renderFolder(folder))}
                    {orphanProjects.map(project => renderProject(project))}
                  </div>
                </ScrollArea>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Folder Dialog */}
      <Dialog open={folderDialog.open} onOpenChange={(open) => !open && setFolderDialog({ ...folderDialog, open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{folderDialog.editId ? 'Редактировать папку' : 'Новая папка'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Название папки" value={folderDialog.name}
              onChange={(e) => setFolderDialog({ ...folderDialog, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveFolder()} autoFocus data-testid="mfolder-name-input" />
            <Input placeholder="Описание (опционально)" value={folderDialog.description}
              onChange={(e) => setFolderDialog({ ...folderDialog, description: e.target.value })} data-testid="mfolder-desc-input" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setFolderDialog({ ...folderDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleSaveFolder} disabled={saving || !folderDialog.name.trim()} data-testid="mfolder-save-btn">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {folderDialog.editId ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={projectDialog.open} onOpenChange={(open) => !open && setProjectDialog({ ...projectDialog, open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Новый проект встречи</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Название проекта" value={projectDialog.name}
              onChange={(e) => setProjectDialog({ ...projectDialog, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} autoFocus data-testid="mproject-name-input" />
            <Input placeholder="Описание (опционально)" value={projectDialog.description}
              onChange={(e) => setProjectDialog({ ...projectDialog, description: e.target.value })} data-testid="mproject-desc-input" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setProjectDialog({ ...projectDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleCreateProject} disabled={saving || !projectDialog.name.trim()} data-testid="mproject-save-btn">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
