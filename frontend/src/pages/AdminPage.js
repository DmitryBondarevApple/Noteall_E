import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi, promptsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  ArrowLeft,
  Shield,
  Users,
  BookOpen,
  Search,
  UserCog,
  Cpu,
  RefreshCw,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  // Model management state
  const [modelInfo, setModelInfo] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      toast.error('Доступ запрещен');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, promptsRes, modelRes] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listAllPrompts(),
        adminApi.getModel().catch(() => ({ data: null })),
      ]);
      setUsers(usersRes.data);
      setPrompts(promptsRes.data);
      if (modelRes.data) setModelInfo(modelRes.data);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckModels = async () => {
    setChecking(true);
    try {
      const res = await adminApi.checkModels();
      setCheckResult(res.data);
      setModelInfo(prev => ({ ...prev, active_model: res.data.active_model, last_check: res.data.last_check }));
      if (res.data.newer_models?.length > 0) {
        toast.success(`Найдено ${res.data.newer_models.length} новых моделей`);
      } else {
        toast.info('Новых моделей не обнаружено');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка проверки');
    } finally {
      setChecking(false);
    }
  };

  const handleSwitchModel = async (model) => {
    setSwitching(true);
    try {
      const res = await adminApi.switchModel(model);
      setModelInfo(prev => ({ ...prev, active_model: res.data.active_model }));
      setCheckResult(prev => prev ? { ...prev, newer_models: prev.newer_models?.filter(m => m !== model) } : null);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка переключения');
    } finally {
      setSwitching(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminApi.updateRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Роль обновлена');
    } catch (error) {
      toast.error('Ошибка обновления роли');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const publicPrompts = prompts.filter(p => p.is_public);

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Доступ запрещен</h2>
            <p className="text-muted-foreground mb-4">
              Эта страница доступна только администраторам
            </p>
            <Link to="/dashboard">
              <Button>Вернуться на главную</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">Админ-панель</span>
          </div>
          <Badge className="bg-purple-100 text-purple-700">Администратор</Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border p-1 mb-6">
            <TabsTrigger value="users" className="gap-2" data-testid="admin-users-tab">
              <Users className="w-4 h-4" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="prompts" className="gap-2" data-testid="admin-prompts-tab">
              <BookOpen className="w-4 h-4" />
              Общие промпты
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-2" data-testid="admin-models-tab">
              <Cpu className="w-4 h-4" />
              Модели
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Пользователи</CardTitle>
                    <CardDescription>
                      Управление пользователями и их ролями
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="search-users-input"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Дата регистрации</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {u.name[0]?.toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge className={u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}>
                            {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(u.created_at), 'dd MMM yyyy', { locale: ru })}
                        </TableCell>
                        <TableCell>
                          {u.id !== user?.id && (
                            <Select
                              value={u.role}
                              onValueChange={(value) => handleRoleChange(u.id, value)}
                            >
                              <SelectTrigger className="w-32" data-testid={`role-select-${u.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Пользователь</SelectItem>
                                <SelectItem value="admin">Админ</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Пользователи не найдены
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts">
            <Card>
              <CardHeader>
                <CardTitle>Общие промпты</CardTitle>
                <CardDescription>
                  Промпты, доступные всем пользователям
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Содержание</TableHead>
                      <TableHead>Обновлен</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publicPrompts.map((prompt) => (
                      <TableRow key={prompt.id} data-testid={`prompt-row-${prompt.id}`}>
                        <TableCell className="font-medium">{prompt.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {prompt.prompt_type === 'master' ? 'Мастер' : 'Тематический'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {prompt.content}
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(prompt.updated_at), 'dd MMM yyyy', { locale: ru })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {publicPrompts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет общих промптов
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Управление моделями</CardTitle>
                    <CardDescription>
                      Текущая модель и проверка обновлений OpenAI
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleCheckModels}
                    disabled={checking}
                    data-testid="check-models-btn"
                  >
                    {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Проверить обновления
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current model */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Активная модель</div>
                    <div className="text-lg font-semibold" data-testid="active-model-name">
                      {modelInfo?.active_model || 'gpt-5.2'}
                    </div>
                  </div>
                  {modelInfo?.last_check && (
                    <div className="ml-auto text-sm text-muted-foreground">
                      Последняя проверка: {format(new Date(modelInfo.last_check), 'dd MMM yyyy HH:mm', { locale: ru })}
                    </div>
                  )}
                </div>

                {/* Check results */}
                {checkResult && (
                  <div className="space-y-3">
                    {checkResult.newer_models?.length > 0 && (
                      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                        <div className="font-medium text-amber-800 mb-2">
                          Доступны новые модели:
                        </div>
                        <div className="space-y-2">
                          {checkResult.newer_models.map((model) => (
                            <div key={model} className="flex items-center justify-between p-2 rounded bg-white border">
                              <span className="font-mono text-sm">{model}</span>
                              <Button
                                size="sm"
                                onClick={() => handleSwitchModel(model)}
                                disabled={switching}
                                data-testid={`switch-model-${model}`}
                              >
                                {switching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                Переключить
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-4 rounded-lg border bg-slate-50">
                      <div className="font-medium mb-2">Все доступные GPT модели ({checkResult.available_models?.length || 0}):</div>
                      <div className="flex flex-wrap gap-2">
                        {checkResult.available_models?.map((model) => (
                          <Badge
                            key={model}
                            variant={model === modelInfo?.active_model ? 'default' : 'outline'}
                            className={model === modelInfo?.active_model ? 'bg-emerald-600' : 'cursor-pointer hover:bg-slate-100'}
                            onClick={() => model !== modelInfo?.active_model && handleSwitchModel(model)}
                          >
                            {model}
                            {model === modelInfo?.active_model && ' (активна)'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!checkResult && (
                  <div className="text-center py-6 text-muted-foreground">
                    Нажмите "Проверить обновления" для получения списка моделей
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </AppLayout>
  );
}
