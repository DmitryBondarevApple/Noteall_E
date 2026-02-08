import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectsApi, seedData } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Plus,
  FolderOpen,
  Clock,
  MoreVertical,
  Trash2,
  Edit2,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Mic,
  LogOut,
  Settings,
  BookOpen,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusConfig = {
  new: { label: 'Новый', color: 'bg-slate-100 text-slate-700', icon: FolderOpen },
  transcribing: { label: 'Транскрибация', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  processing: { label: 'Обработка', color: 'bg-indigo-100 text-indigo-700', icon: Loader2 },
  needs_review: { label: 'Требует проверки', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  ready: { label: 'Готов', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  error: { label: 'Ошибка', color: 'bg-red-100 text-red-700', icon: AlertCircle }
};

export default function DashboardPage() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
    // Seed data on first load
    seedData().catch(() => {});
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectsApi.list();
      setProjects(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки проектов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    
    setCreating(true);
    try {
      const response = await projectsApi.create(newProject);
      setProjects([response.data, ...projects]);
      setCreateDialogOpen(false);
      setNewProject({ name: '', description: '' });
      toast.success('Проект создан');
      navigate(`/projects/${response.data.id}`);
    } catch (error) {
      toast.error('Ошибка создания проекта');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Удалить проект? Это действие нельзя отменить.')) return;
    
    try {
      await projectsApi.delete(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Проект удален');
    } catch (error) {
      toast.error('Ошибка удаления проекта');
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Voice Workspace</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/prompts">
              <Button variant="ghost" className="gap-2" data-testid="prompts-nav-btn">
                <BookOpen className="w-4 h-4" />
                Промпты
              </Button>
            </Link>
            
            <Link to="/speakers">
              <Button variant="ghost" className="gap-2" data-testid="speakers-nav-btn">
                <Settings className="w-4 h-4" />
                Спикеры
              </Button>
            </Link>
            
            {isAdmin() && (
              <Link to="/admin">
                <Button variant="ghost" className="gap-2" data-testid="admin-nav-btn">
                  <Shield className="w-4 h-4" />
                  Админ
                </Button>
              </Link>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2" data-testid="user-menu-btn">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-sm font-medium">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="hidden sm:inline">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-muted-foreground">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Мои проекты</h1>
            <p className="text-muted-foreground mt-1">Управляйте записями встреч и транскрипциями</p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full h-11 px-6" data-testid="create-project-btn">
                <Plus className="w-4 h-4" />
                Новый проект
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать проект</DialogTitle>
                <DialogDescription>
                  Проект — это контейнер для одной записи встречи
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Название</Label>
                  <Input
                    id="project-name"
                    data-testid="project-name-input"
                    placeholder="Например: Планирование спринта 15.01"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-desc">Описание (опционально)</Label>
                  <Input
                    id="project-desc"
                    data-testid="project-desc-input"
                    placeholder="Краткое описание встречи"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={creating} data-testid="create-project-submit-btn">
                    {creating ? 'Создание...' : 'Создать'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск проектов..."
            className="pl-10 max-w-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="search-projects-input"
          />
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileAudio className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'Ничего не найдено' : 'Нет проектов'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? 'Попробуйте изменить запрос' : 'Создайте первый проект для начала работы'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setCreateDialogOpen(true)} className="rounded-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Создать проект
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {filteredProjects.map((project) => {
              const status = statusConfig[project.status] || statusConfig.new;
              const StatusIcon = status.icon;
              
              return (
                <Card
                  key={project.id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-transparent hover:border-slate-200"
                  data-testid={`project-card-${project.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Link to={`/projects/${project.id}`} className="flex-1">
                        <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors">
                          {project.name}
                        </CardTitle>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/projects/${project.id}`}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Открыть
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteProject(project.id)}
                            data-testid={`delete-project-${project.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {project.description || 'Без описания'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge className={`${status.color} gap-1`}>
                        <StatusIcon className={`w-3 h-3 ${project.status === 'transcribing' || project.status === 'processing' ? 'animate-spin' : ''}`} />
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true, locale: ru })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
