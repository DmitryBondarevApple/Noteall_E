import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { promptsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  ArrowLeft,
  Plus,
  BookOpen,
  Globe,
  User,
  FolderOpen,
  Wand2,
  MoreVertical,
  Edit2,
  Trash2,
  Mic
} from 'lucide-react';
import { toast } from 'sonner';

const promptTypeConfig = {
  master: { label: 'Мастер', icon: Wand2, color: 'bg-purple-100 text-purple-700' },
  thematic: { label: 'Тематический', icon: Globe, color: 'bg-blue-100 text-blue-700' },
  personal: { label: 'Личный', icon: User, color: 'bg-green-100 text-green-700' },
  project: { label: 'Проектный', icon: FolderOpen, color: 'bg-orange-100 text-orange-700' }
};

export function PromptsContent() {
  const { user, isAdmin } = useAuth();
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const response = await promptsApi.list();
      setPrompts(response.data);
    } catch (error) {
      toast.error('Ошибка загрузки промптов');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompt = async (promptId) => {
    if (!window.confirm('Удалить промпт?')) return;
    
    try {
      await promptsApi.delete(promptId);
      setPrompts(prompts.filter(p => p.id !== promptId));
      toast.success('Промпт удален');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const filterPrompts = (type) => {
    if (type === 'all') return prompts;
    if (type === 'public') return prompts.filter(p => p.is_public);
    if (type === 'my') return prompts.filter(p => p.user_id === user?.id);
    return prompts.filter(p => p.prompt_type === type);
  };

  const filteredPrompts = filterPrompts(activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div />
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full" data-testid="create-prompt-btn">
                <Plus className="w-4 h-4" />
                Новый промпт
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Создать промпт</DialogTitle>
                <DialogDescription>
                  Создайте собственный промпт для анализа встреч
                </DialogDescription>
              </DialogHeader>
              <PromptForm
                onSave={async (data) => {
                  try {
                    const response = await promptsApi.create(data);
                    setPrompts([response.data, ...prompts]);
                    setCreateDialogOpen(false);
                    toast.success('Промпт создан');
                  } catch (error) {
                    toast.error('Ошибка создания');
                  }
                }}
                onCancel={() => setCreateDialogOpen(false)}
                isAdmin={isAdmin()}
              />
            </DialogContent>
          </Dialog>
      </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border p-1 mb-6">
            <TabsTrigger value="all" data-testid="tab-all">Все</TabsTrigger>
            <TabsTrigger value="public" data-testid="tab-public">Общие</TabsTrigger>
            <TabsTrigger value="my" data-testid="tab-my">Мои</TabsTrigger>
            <TabsTrigger value="thematic" data-testid="tab-thematic">Тематические</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-slate-200 rounded w-3/4" />
                      <div className="h-4 bg-slate-200 rounded w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-20 bg-slate-200 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPrompts.length === 0 ? (
              <Card className="text-center py-16">
                <CardContent>
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Нет промптов</h3>
                  <p className="text-muted-foreground mb-6">
                    Создайте первый промпт для анализа встреч
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Создать промпт
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
                {filteredPrompts.map((prompt) => {
                  const config = promptTypeConfig[prompt.prompt_type] || promptTypeConfig.personal;
                  const Icon = config.icon;
                  const canEdit = prompt.user_id === user?.id || (isAdmin() && prompt.is_public);
                  
                  return (
                    <Card key={prompt.id} className="group hover:shadow-md transition-shadow" data-testid={`prompt-card-${prompt.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`${config.color} gap-1`}>
                                <Icon className="w-3 h-3" />
                                {config.label}
                              </Badge>
                              {prompt.is_public && (
                                <Badge variant="outline" className="gap-1">
                                  <Globe className="w-3 h-3" />
                                  Общий
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-lg">{prompt.name}</CardTitle>
                          </div>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingPrompt(prompt)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Редактировать
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeletePrompt(prompt.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Удалить
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                          {prompt.content}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={() => setEditingPrompt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать промпт</DialogTitle>
          </DialogHeader>
          {editingPrompt && (
            <PromptForm
              initialData={editingPrompt}
              onSave={async (data) => {
                try {
                  const response = await promptsApi.update(editingPrompt.id, data);
                  setPrompts(prompts.map(p => p.id === editingPrompt.id ? response.data : p));
                  setEditingPrompt(null);
                  toast.success('Промпт обновлен');
                } catch (error) {
                  toast.error('Ошибка сохранения');
                }
              }}
              onCancel={() => setEditingPrompt(null)}
              isAdmin={isAdmin()}
              isEditing
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}

function PromptForm({ initialData, onSave, onCancel, isAdmin, isEditing }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    content: initialData?.content || '',
    prompt_type: initialData?.prompt_type || 'personal',
    is_public: initialData?.is_public || false
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.content.trim()) return;
    
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Название</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Например: Резюме встречи"
          required
          data-testid="prompt-name-input"
        />
      </div>
      
      {!isEditing && (
        <div className="space-y-2">
          <Label>Тип промпта</Label>
          <Select
            value={formData.prompt_type}
            onValueChange={(value) => setFormData({ ...formData, prompt_type: value })}
          >
            <SelectTrigger data-testid="prompt-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Личный</SelectItem>
              {isAdmin && <SelectItem value="thematic">Тематический (общий)</SelectItem>}
              {isAdmin && <SelectItem value="master">Мастер промпт</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="space-y-2">
        <Label>Содержание промпта</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Опишите, что должен сделать AI с транскриптом..."
          rows={6}
          required
          data-testid="prompt-content-input"
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={saving} data-testid="save-prompt-btn">
          {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
