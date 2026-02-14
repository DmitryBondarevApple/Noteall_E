import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { docFoldersApi, docProjectsApi, orgApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '../components/ui/context-menu';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Tabs, TabsList, TabsTrigger,
} from '../components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  FolderOpen, FolderClosed, FileText, MoreHorizontal, Trash2, Edit2,
  ChevronRight, ChevronDown, Search, FolderPlus, FilePlus, Loader2,
  FolderInput, Share2, Lock, Globe, RotateCcw, User, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '../lib/utils';
import AppLayout from '../components/layout/AppLayout';

const statusLabels = {
  draft: { label: 'Черновик', color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'В работе', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Готов', color: 'bg-green-100 text-green-700' },
};

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('documents_tab') || 'private');
  const [folders, setFolders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('documents_expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [searchQuery, setSearchQuery] = useState('');

  const [folderDialog, setFolderDialog] = useState({ open: false, parentId: null, editId: null, name: '', description: '', visibility: 'private', accessType: 'readonly' });
  const [projectDialog, setProjectDialog] = useState({ open: false, folderId: null, name: '', description: '' });
  const [moveDialog, setMoveDialog] = useState({ open: false, itemType: null, itemId: null, itemName: '' });
  const [shareDialog, setShareDialog] = useState({ open: false, folderId: null, folderName: '', accessType: 'readonly', sharedWith: [], isManage: false });
  const [saving, setSaving] = useState(false);
  const [orgMembers, setOrgMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersRes, projectsRes] = await Promise.all([
        docFoldersApi.list({ tab: activeTab }),
        docProjectsApi.list({ tab: activeTab }),
      ]);
      setFolders(foldersRes.data);
      setProjects(projectsRes.data);
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTabChange = (tab) => {
    setFolders([]);
    setProjects([]);
    setActiveTab(tab);
    localStorage.setItem('documents_tab', tab);
    setSearchQuery('');
  };

  const getRootFolders = () => folders.filter(f => !f.parent_id);
  const getChildFolders = (parentId) => folders.filter(f => f.parent_id === parentId);
  const getFolderProjects = (folderId) => projects.filter(p => p.folder_id === folderId);
  const orphanProjects = projects.filter(p => !p.folder_id);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      localStorage.setItem('documents_expanded', JSON.stringify([...next]));
      return next;
    });
  };

  // --- Folder CRUD ---
  const openFolderDialog = (parentId = null, editFolder = null) => {
    setFolderDialog({
      open: true, parentId,
      editId: editFolder?.id || null,
      name: editFolder?.name || '',
      description: editFolder?.description || '',
      visibility: activeTab === 'public' ? 'public' : 'private',
      accessType: editFolder?.access_type || 'readonly',
    });
  };

  const handleSaveFolder = async () => {
    if (!folderDialog.name.trim()) return;
    setSaving(true);
    try {
      if (folderDialog.editId) {
        await docFoldersApi.update(folderDialog.editId, {
          name: folderDialog.name, description: folderDialog.description || null,
        });
        toast.success('Папка обновлена');
      } else {
        await docFoldersApi.create({
          name: folderDialog.name,
          parent_id: folderDialog.parentId,
          description: folderDialog.description || null,
          visibility: folderDialog.visibility,
          shared_with: folderDialog.visibility === 'public' ? [] : null,
          access_type: folderDialog.accessType,
        });
        toast.success('Папка создана');
      }
      setFolderDialog({ open: false, parentId: null, editId: null, name: '', description: '', visibility: 'private', accessType: 'readonly' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally { setSaving(false); }
  };

  const handleDeleteFolder = async (folderId) => {
    if (activeTab === 'trash') {
      if (!window.confirm('Удалить папку навсегда? Это действие нельзя отменить.')) return;
      try {
        await docFoldersApi.permanentDelete(folderId);
        toast.success('Папка удалена навсегда');
        loadData();
      } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
    } else {
      if (!window.confirm('Переместить папку в корзину?')) return;
      try {
        await docFoldersApi.delete(folderId);
        toast.success('Папка перемещена в корзину');
        loadData();
      } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
    }
  };

  const handleRestoreFolder = async (folderId) => {
    try {
      await docFoldersApi.restore(folderId);
      toast.success('Папка восстановлена');
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
  };

  // --- Sharing ---
  const openShareDialog = async (folder, isManage = false) => {
    setShareDialog({
      open: true, folderId: folder.id, folderName: folder.name,
      accessType: folder.access_type || 'readonly',
      sharedWith: folder.shared_with || [],
      isManage,
    });
    setMemberSearch('');
    try {
      const res = await orgApi.getMembers();
      setOrgMembers(res.data);
    } catch { setOrgMembers([]); }
  };

  const toggleMember = (userId) => {
    setShareDialog(prev => {
      const current = prev.sharedWith.filter(id => id !== 'all');
      const exists = current.includes(userId);
      return { ...prev, sharedWith: exists ? current.filter(id => id !== userId) : [...current, userId] };
    });
  };

  const handleShare = async () => {
    setSaving(true);
    try {
      await docFoldersApi.share(shareDialog.folderId, {
        shared_with: shareDialog.sharedWith.length > 0 ? shareDialog.sharedWith : [],
        access_type: shareDialog.accessType,
      });
      toast.success(shareDialog.isManage ? 'Доступы обновлены' : 'Папка расшарена');
      setShareDialog({ open: false, folderId: null, folderName: '', accessType: 'readonly', sharedWith: [], isManage: false });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
    finally { setSaving(false); }
  };

  const handleUnshare = async (folderId) => {
    if (!window.confirm('Сделать папку приватной?')) return;
    try {
      await docFoldersApi.unshare(folderId);
      toast.success('Папка стала приватной');
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
  };

  // --- Project CRUD ---
  const openProjectDialog = (folderId) => {
    setProjectDialog({ open: true, folderId, name: '', description: '' });
  };

  const handleCreateProject = async () => {
    if (!projectDialog.name.trim()) return;
    setSaving(true);
    try {
      const res = await docProjectsApi.create({
        name: projectDialog.name,
        folder_id: projectDialog.folderId,
        description: projectDialog.description || null,
      });
      toast.success('Проект создан');
      setProjectDialog({ open: false, folderId: null, name: '', description: '' });
      navigate(`/documents/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally { setSaving(false); }
  };

  const handleDeleteProject = async (projectId) => {
    if (activeTab === 'trash') {
      if (!window.confirm('Удалить проект навсегда?')) return;
      try {
        await docProjectsApi.permanentDelete(projectId);
        toast.success('Проект удалён навсегда');
        loadData();
      } catch { toast.error('Ошибка'); }
    } else {
      if (!window.confirm('Переместить проект в корзину?')) return;
      try {
        await docProjectsApi.delete(projectId);
        toast.success('Проект перемещён в корзину');
        loadData();
      } catch { toast.error('Ошибка'); }
    }
  };

  const handleRestoreProject = async (projectId) => {
    try {
      await docProjectsApi.restore(projectId);
      toast.success('Проект восстановлен');
      loadData();
    } catch { toast.error('Ошибка'); }
  };

  // --- Move ---
  const openMoveDialog = (type, id, name) => {
    setMoveDialog({ open: true, itemType: type, itemId: id, itemName: name });
  };

  const handleMove = async (targetId) => {
    if (!moveDialog.itemId) return;
    try {
      if (moveDialog.itemType === 'project') {
        await docProjectsApi.move(moveDialog.itemId, targetId || null);
      } else {
        await docFoldersApi.move(moveDialog.itemId, targetId || null);
      }
      toast.success('Перемещено');
      setMoveDialog({ open: false, itemType: null, itemId: null, itemName: '' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка перемещения'); }
  };

  // --- Search ---
  const matchesSearch = (name) => name.toLowerCase().includes(searchQuery.toLowerCase());
  const folderHasMatch = (folderId) => {
    if (!searchQuery) return true;
    const folder = folders.find(f => f.id === folderId);
    if (folder && matchesSearch(folder.name)) return true;
    if (getChildFolders(folderId).some(cf => folderHasMatch(cf.id))) return true;
    return getFolderProjects(folderId).some(p => matchesSearch(p.name));
  };

  // Move dialog: load private folders
  const [moveFolders, setMoveFolders] = useState([]);
  useEffect(() => {
    if (moveDialog.open) {
      docFoldersApi.list({ tab: 'private' }).then(res => setMoveFolders(res.data)).catch(() => {});
    }
  }, [moveDialog.open]);

  // --- Render Folder ---
  const renderFolder = (folder, depth = 0) => {
    if (searchQuery && !folderHasMatch(folder.id)) return null;
    const isExpanded = expandedFolders.has(folder.id);
    const children = getChildFolders(folder.id);
    const folderProjects = getFolderProjects(folder.id);
    const hasContent = children.length > 0 || folderProjects.length > 0;
    const isTrash = activeTab === 'trash';
    const isPublic = folder.visibility === 'public';

    return (
      <div key={folder.id} data-testid={`folder-${folder.id}`}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              className="group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-slate-100"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => !isTrash && toggleFolder(folder.id)}
            >
              {!isTrash && (
                <button className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-400">
                  {hasContent ? (
                    isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                  ) : <span className="w-3.5" />}
                </button>
              )}
              {isExpanded && !isTrash ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <FolderClosed className="w-4 h-4 text-amber-500 shrink-0" />}
              <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
              {isPublic && !isTrash && <Globe className="w-3 h-3 text-blue-400 shrink-0" />}
              {!isTrash && folderProjects.length > 0 && <span className="text-xs text-slate-400 mr-1">{folderProjects.length}</span>}
              {isTrash && folder.deleted_at && (
                <span className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(folder.deleted_at), { addSuffix: true, locale: ru })}
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-opacity">
                    <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isTrash ? (
                    <>
                      <DropdownMenuItem onClick={() => handleRestoreFolder(folder.id)}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Восстановить
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Удалить навсегда
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
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
                      <DropdownMenuItem onClick={() => openMoveDialog('folder', folder.id, folder.name)}>
                        <FolderInput className="w-4 h-4 mr-2" /> Переместить
                      </DropdownMenuItem>
                      {isPublic ? (
                        <>
                          <DropdownMenuItem onClick={() => openShareDialog(folder, true)}>
                            <Users className="w-4 h-4 mr-2" /> Доступы
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUnshare(folder.id)}>
                            <Lock className="w-4 h-4 mr-2" /> Сделать приватной
                          </DropdownMenuItem>
                        </>
                      ) : (folder.shared_with && folder.shared_with.length > 0) ? (
                        <DropdownMenuItem onClick={() => openShareDialog(folder, true)}>
                          <Users className="w-4 h-4 mr-2" /> Доступы
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => openShareDialog(folder)}>
                          <Share2 className="w-4 h-4 mr-2" /> Расшарить
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> В корзину
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {isTrash ? (
              <>
                <ContextMenuItem onClick={() => handleRestoreFolder(folder.id)}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Восстановить
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleDeleteFolder(folder.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Удалить навсегда
                </ContextMenuItem>
              </>
            ) : (
              <>
                {folder.owner_name && activeTab === 'public' && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Владелец: {folder.owner_name}
                    </div>
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem onClick={() => openFolderDialog(folder.id)}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Вложенная папка
                </ContextMenuItem>
                <ContextMenuItem onClick={() => openProjectDialog(folder.id)}>
                  <FilePlus className="w-4 h-4 mr-2" /> Новый проект
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        {isExpanded && !isTrash && (
          <div>
            {children.map(child => renderFolder(child, depth + 1))}
            {folderProjects.map(p => renderProject(p, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // --- Render Project ---
  const renderProject = (project, depth = 0) => {
    if (searchQuery && !matchesSearch(project.name)) return null;
    const st = statusLabels[project.status] || statusLabels.draft;
    const isTrash = activeTab === 'trash';

    return (
      <div
        key={project.id}
        className="group flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-indigo-50"
        style={{ paddingLeft: `${depth * 16 + (isTrash ? 12 : 28)}px` }}
        onClick={() => !isTrash && navigate(`/documents/${project.id}`)}
        data-testid={`doc-project-${project.id}`}
      >
        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-sm truncate flex-1">{project.name}</span>
        {!isTrash && (
          <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', st.color)}>{st.label}</Badge>
        )}
        {isTrash && project.deleted_at && (
          <span className="text-xs text-slate-400">
            {formatDistanceToNow(new Date(project.deleted_at), { addSuffix: true, locale: ru })}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-opacity">
              <MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {isTrash ? (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestoreProject(project.id); }}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Восстановить
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}>
                  <Trash2 className="w-4 h-4 mr-2" /> Удалить навсегда
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/documents/${project.id}`); }}>
                  <Edit2 className="w-4 h-4 mr-2" /> Открыть
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openMoveDialog('project', project.id, project.name); }}>
                  <FolderInput className="w-4 h-4 mr-2" /> Переместить
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}>
                  <Trash2 className="w-4 h-4 mr-2" /> В корзину
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const isEmpty = folders.length === 0 && projects.length === 0;

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        <header className="bg-white border-b px-6 py-4 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="documents-title">Документ-Агент</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Анализ документов с помощью AI</p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab !== 'trash' && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openFolderDialog()} data-testid="create-folder-btn">
                  <FolderPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Папка</span>
                </Button>
              )}
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-3">
            <TabsList className="bg-slate-100/70 h-9">
              <TabsTrigger value="private" className="gap-1.5 text-xs px-3" data-testid="doc-tab-private">
                <Lock className="w-3.5 h-3.5" /> Приватные
              </TabsTrigger>
              <TabsTrigger value="public" className="gap-1.5 text-xs px-3" data-testid="doc-tab-public">
                <Globe className="w-3.5 h-3.5" /> Публичные
              </TabsTrigger>
              <TabsTrigger value="trash" className="gap-1.5 text-xs px-3" data-testid="doc-tab-trash">
                <Trash2 className="w-3.5 h-3.5" /> Корзина
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col px-6 py-4">
            {activeTab !== 'trash' && (
              <div className="relative mb-3 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Поиск..." className="pl-9 h-9" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} data-testid="doc-search-input" />
              </div>
            )}

            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : isEmpty ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    {activeTab === 'trash' ? <Trash2 className="w-8 h-8 text-slate-400" /> : <FileText className="w-8 h-8 text-slate-400" />}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {activeTab === 'trash' ? 'Корзина пуста' : activeTab === 'public' ? 'Нет публичных папок' : 'Начните работу'}
                  </h3>
                  <p className="text-muted-foreground mb-6 text-sm max-w-sm mx-auto">
                    {activeTab === 'trash'
                      ? 'Удалённые папки и проекты появятся здесь.'
                      : activeTab === 'public'
                      ? 'Расшарьте папку из приватного раздела, чтобы она появилась здесь.'
                      : 'Создайте папку для организации проектов, затем добавьте проекты анализа.'}
                  </p>
                  {activeTab === 'private' && (
                    <Button onClick={() => openFolderDialog()} className="rounded-full gap-2" data-testid="empty-create-folder-btn">
                      <FolderPlus className="w-4 h-4" /> Создать папку
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="pr-4">
                  {getRootFolders().map(folder => renderFolder(folder))}
                  {orphanProjects.map(project => renderProject(project))}
                </div>
              </ScrollArea>
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
              onKeyDown={(e) => e.key === 'Enter' && handleSaveFolder()} autoFocus data-testid="folder-name-input" />
            <Input placeholder="Описание (опционально)" value={folderDialog.description}
              onChange={(e) => setFolderDialog({ ...folderDialog, description: e.target.value })} data-testid="folder-desc-input" />
            {!folderDialog.editId && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Видимость:</label>
                <Select value={folderDialog.visibility} onValueChange={(v) => setFolderDialog({ ...folderDialog, visibility: v })}>
                  <SelectTrigger className="w-40 h-8" data-testid="folder-visibility-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private"><span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Приватная</span></SelectItem>
                    <SelectItem value="public"><span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> Публичная</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {!folderDialog.editId && folderDialog.visibility === 'public' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Доступ:</label>
                <Select value={folderDialog.accessType} onValueChange={(v) => setFolderDialog({ ...folderDialog, accessType: v })}>
                  <SelectTrigger className="w-48 h-8" data-testid="folder-access-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="readonly">Только чтение</SelectItem>
                    <SelectItem value="readwrite">Чтение + создание</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setFolderDialog({ ...folderDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleSaveFolder} disabled={saving || !folderDialog.name.trim()} data-testid="folder-save-btn">
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
          <DialogHeader><DialogTitle>Новый проект</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Название проекта" value={projectDialog.name}
              onChange={(e) => setProjectDialog({ ...projectDialog, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()} autoFocus data-testid="project-name-input" />
            <Input placeholder="Описание (опционально)" value={projectDialog.description}
              onChange={(e) => setProjectDialog({ ...projectDialog, description: e.target.value })} data-testid="project-desc-input" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setProjectDialog({ ...projectDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleCreateProject} disabled={saving || !projectDialog.name.trim()} data-testid="project-save-btn">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialog.open} onOpenChange={(open) => !open && setShareDialog({ ...shareDialog, open: false })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Расшарить папку</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Папка <span className="font-medium text-foreground">"{shareDialog.folderName}"</span> станет доступна всем в организации.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <label className="text-sm">Уровень доступа:</label>
            <Select value={shareDialog.accessType} onValueChange={(v) => setShareDialog({ ...shareDialog, accessType: v })}>
              <SelectTrigger className="w-48 h-8" data-testid="share-access-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readonly">Только чтение</SelectItem>
                <SelectItem value="readwrite">Чтение + создание</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setShareDialog({ ...shareDialog, open: false })}>Отмена</Button>
            <Button size="sm" onClick={handleShare} disabled={saving} data-testid="share-confirm-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              <Share2 className="w-4 h-4 mr-1" /> Расшарить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveDialog.open} onOpenChange={(open) => !open && setMoveDialog({ open: false, itemType: null, itemId: null, itemName: '' })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Переместить {moveDialog.itemType === 'folder' ? 'папку' : 'проект'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Выберите место для <span className="font-medium text-foreground">"{moveDialog.itemName}"</span>
          </p>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {moveDialog.itemType === 'folder' && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-100 transition-colors text-left"
                onClick={() => handleMove(null)}
                data-testid="move-to-root"
              >
                <FolderOpen className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">Корень (без родителя)</span>
              </button>
            )}
            {moveFolders.filter(f => f.id !== moveDialog.itemId).map(f => (
              <button
                key={f.id}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-100 transition-colors text-left"
                style={{ paddingLeft: `${(f.parent_id ? 32 : 12)}px` }}
                onClick={() => handleMove(f.id)}
                data-testid={`move-to-folder-${f.id}`}
              >
                <FolderClosed className="w-4 h-4 text-amber-500" />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
