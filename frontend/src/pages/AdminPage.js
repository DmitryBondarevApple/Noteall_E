import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi, orgApi, billingApi, invitationsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Shield, Users, Search, Cpu, RefreshCw, Check, Loader2,
  Building2, UserPlus, Trash2, Settings2, DollarSign, Plus, X,
  Link2, Copy, Ban, Clock, CheckCircle2, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import OrgDetailModal from '../components/billing/OrgDetailModal';
import { ru } from 'date-fns/locale';

const ROLE_LABELS = {
  superadmin: { label: 'Суперадмин', color: 'bg-red-100 text-red-700' },
  org_admin: { label: 'Админ орг.', color: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Админ', color: 'bg-purple-100 text-purple-700' },
  user: { label: 'Пользователь', color: 'bg-slate-100 text-slate-700' },
};

function RoleBadge({ role }) {
  const info = ROLE_LABELS[role] || ROLE_LABELS.user;
  return <Badge className={info.color}>{info.label}</Badge>;
}

export default function AdminPage() {
  const { user, isAdmin, isSuperadmin, isOrgAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('org');
  const [loading, setLoading] = useState(true);

  // Org data
  const [org, setOrg] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [editingOrgName, setEditingOrgName] = useState(null);
  const [savingOrgName, setSavingOrgName] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Superadmin data
  const [allUsers, setAllUsers] = useState([]);
  const [allOrgs, setAllOrgs] = useState([]);

  // Model state
  const [modelInfo, setModelInfo] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Limit dialog
  const [limitDialog, setLimitDialog] = useState(null);
  const [limitValue, setLimitValue] = useState('');

  // Markup tiers
  const [markupTiers, setMarkupTiers] = useState([]);
  const [editingTiers, setEditingTiers] = useState(null);
  const [savingTiers, setSavingTiers] = useState(false);

  // Cost settings
  const [costSettings, setCostSettings] = useState(null);
  const [editingCost, setEditingCost] = useState(null);
  const [savingCost, setSavingCost] = useState(false);
  const [runningStorageCalc, setRunningStorageCalc] = useState(false);

  // Trash settings
  const [trashRetention, setTrashRetention] = useState(30);
  const [editingTrash, setEditingTrash] = useState(null);
  const [savingTrash, setSavingTrash] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  // Invitations
  const [invitations, setInvitations] = useState([]);
  const [inviteNote, setInviteNote] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);

  useEffect(() => {
    if (!isAdmin()) return;
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const promises = [
        orgApi.getMy().catch(() => ({ data: null })),
        orgApi.getMyUsers().catch(() => ({ data: [] })),
        invitationsApi.list().catch(() => ({ data: [] })),
      ];
      if (isSuperadmin()) {
        promises.push(
          adminApi.listUsers().catch(() => ({ data: [] })),
          orgApi.listAll().catch(() => ({ data: [] })),
          adminApi.getModel().catch(() => ({ data: null })),
          billingApi.getMarkupTiers().catch(() => ({ data: [] })),
          billingApi.getCostSettings().catch(() => ({ data: null })),
          adminApi.getTrashSettings().catch(() => ({ data: { retention_days: 30 } })),
        );
      }
      const results = await Promise.all(promises);
      setOrg(results[0].data);
      setOrgUsers(results[1].data || []);
      setInvitations(results[2].data || []);
      if (isSuperadmin()) {
        setAllUsers(results[3].data || []);
        setAllOrgs(results[4].data || []);
        if (results[5].data) setModelInfo(results[5].data);
        setMarkupTiers(results[6].data || []);
        if (results[7].data) setCostSettings(results[7].data);
        setTrashRetention(results[8]?.data?.retention_days ?? 30);
      }
    } catch (err) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrgName = async () => {
    if (!editingOrgName?.trim()) return;
    setSavingOrgName(true);
    try {
      const res = await orgApi.updateMy(editingOrgName.trim());
      setOrg(res.data);
      setEditingOrgName(null);
      toast.success('Название организации обновлено');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingOrgName(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await orgApi.inviteUser(inviteEmail.trim());
      toast.success(res.data.message);
      setInviteEmail('');
      const usersRes = await orgApi.getMyUsers();
      setOrgUsers(usersRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка приглашения');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await orgApi.removeUser(userId);
      setOrgUsers(orgUsers.filter(u => u.id !== userId));
      toast.success('Пользователь удалён из организации');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const handleOrgRoleChange = async (userId, role) => {
    try {
      await orgApi.updateUserRole(userId, role);
      setOrgUsers(orgUsers.map(u => u.id === userId ? { ...u, role } : u));
      toast.success('Роль обновлена');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleSuperadminRoleChange = async (userId, role) => {
    try {
      await adminApi.updateRole(userId, role);
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role } : u));
      toast.success('Роль обновлена');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleSetLimit = async () => {
    if (!limitDialog) return;
    try {
      await orgApi.setUserLimit(limitDialog.id, parseInt(limitValue) || 0);
      setOrgUsers(orgUsers.map(u => u.id === limitDialog.id ? { ...u, monthly_token_limit: parseInt(limitValue) || 0 } : u));
      toast.success('Лимит обновлён');
      setLimitDialog(null);
    } catch (err) {
      toast.error('Ошибка обновления лимита');
    }
  };

  const handleSaveMarkupTiers = async () => {
    if (!editingTiers) return;
    setSavingTiers(true);
    try {
      await billingApi.updateMarkupTiers(editingTiers);
      setMarkupTiers(editingTiers);
      setEditingTiers(null);
      toast.success('Таблица наценок обновлена');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingTiers(false);
    }
  };

  const handleAddTier = () => {
    const tiers = editingTiers || [...markupTiers];
    const lastMax = tiers.length > 0 ? tiers[tiers.length - 1].max_cost : 0;
    setEditingTiers([...tiers, { min_cost: lastMax, max_cost: lastMax * 10 || 1, multiplier: 2.0 }]);
  };

  const handleRemoveTier = (idx) => {
    const tiers = editingTiers || [...markupTiers];
    setEditingTiers(tiers.filter((_, i) => i !== idx));
  };

  const handleTierChange = (idx, field, value) => {
    const tiers = [...(editingTiers || markupTiers)];
    tiers[idx] = { ...tiers[idx], [field]: parseFloat(value) || 0 };
    setEditingTiers(tiers);
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const res = await invitationsApi.create(inviteNote.trim() || null);
      const link = `${window.location.origin}/invite/${res.data.token}`;
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка-приглашение скопирована в буфер обмена');
      setInviteNote('');
      const listRes = await invitationsApi.list();
      setInvitations(listRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка создания приглашения');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyLink = async (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success('Ссылка скопирована');
  };

  const handleRevokeInvite = async (id) => {
    try {
      await invitationsApi.revoke(id);
      setInvitations(invitations.map(inv =>
        inv.id === id ? { ...inv, is_revoked: true } : inv
      ));
      toast.success('Приглашение отозвано');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleSaveCostSettings = async () => {
    if (!editingCost) return;
    setSavingCost(true);
    try {
      const res = await billingApi.updateCostSettings(editingCost);
      setCostSettings(res.data);
      setEditingCost(null);
      toast.success('Настройки себестоимости обновлены');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingCost(false);
    }
  };

  const handleRunStorageCalc = async () => {
    setRunningStorageCalc(true);
    try {
      await billingApi.runStorageCalc();
      toast.success('Расчёт стоимости хранения выполнен');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка расчёта');
    } finally {
      setRunningStorageCalc(false);
    }
  };

  const handleSaveTrashSettings = async () => {
    if (editingTrash === null) return;
    setSavingTrash(true);
    try {
      const res = await adminApi.updateTrashSettings(editingTrash);
      setTrashRetention(res.data.retention_days);
      setEditingTrash(null);
      toast.success(res.data.message || 'Настройки корзины обновлены');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSavingTrash(false);
    }
  };

  const handleCheckModels = async () => {
    setChecking(true);
    try {
      const res = await adminApi.checkModels();
      setCheckResult(res.data);
      setModelInfo(prev => ({ ...prev, active_model: res.data.active_model, last_check: res.data.last_check }));
      if (res.data.newer_models?.length > 0) toast.success(`Найдено ${res.data.newer_models.length} новых моделей`);
      else toast.info('Новых моделей не обнаружено');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка проверки');
    } finally { setChecking(false); }
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
    } finally { setSwitching(false); }
  };

  const filteredAllUsers = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin()) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Доступ запрещен</h2>
              <Link to="/dashboard"><Button>На главную</Button></Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight">Панель управления</span>
                {org && <span className="text-sm text-muted-foreground ml-3">{org.name}</span>}
              </div>
            </div>
            <RoleBadge role={user?.role} />
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="org" className="gap-2" data-testid="admin-org-tab">
                <Building2 className="w-4 h-4" />
                Организация
              </TabsTrigger>
              {isSuperadmin() && (
                <>
                  <TabsTrigger value="all-users" className="gap-2" data-testid="admin-all-users-tab">
                    <Users className="w-4 h-4" />
                    Все пользователи
                  </TabsTrigger>
                  <TabsTrigger value="all-orgs" className="gap-2" data-testid="admin-all-orgs-tab">
                    <Building2 className="w-4 h-4" />
                    Все организации
                  </TabsTrigger>
                  <TabsTrigger value="models" className="gap-2" data-testid="admin-models-tab">
                    <Cpu className="w-4 h-4" />
                    Модели
                  </TabsTrigger>
                  <TabsTrigger value="markup" className="gap-2" data-testid="admin-markup-tab">
                    <DollarSign className="w-4 h-4" />
                    Наценки
                  </TabsTrigger>
                  <TabsTrigger value="costs" className="gap-2" data-testid="admin-costs-tab">
                    <Settings2 className="w-4 h-4" />
                    Себестоимость
                  </TabsTrigger>
                  <TabsTrigger value="system" className="gap-2" data-testid="admin-system-tab">
                    <Trash2 className="w-4 h-4" />
                    Корзина
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Organization Tab */}
            <TabsContent value="org">
              <div className="space-y-6">
                {/* Org Info */}
                {org && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          {editingOrgName !== null ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-5 h-5 shrink-0" />
                              <Input
                                value={editingOrgName}
                                onChange={e => setEditingOrgName(e.target.value)}
                                className="w-64 h-8 text-lg font-semibold"
                                data-testid="org-name-input"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSaveOrgName()}
                              />
                            </div>
                          ) : (
                            <CardTitle className="flex items-center gap-2">
                              <Building2 className="w-5 h-5" />
                              {org.name}
                            </CardTitle>
                          )}
                          <CardDescription>
                            Создана: {format(new Date(org.created_at), 'dd MMM yyyy', { locale: ru })}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {editingOrgName !== null ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setEditingOrgName(null)}>Отмена</Button>
                              <Button size="sm" onClick={handleSaveOrgName} disabled={savingOrgName} data-testid="save-org-name-btn" className="gap-1">
                                {savingOrgName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Сохранить
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setEditingOrgName(org.name)} data-testid="edit-org-name-btn" className="gap-1">
                              <Pencil className="w-3 h-3" />
                              Переименовать
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )}

                {/* Invite */}
                {isOrgAdmin() && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Добавить сотрудника</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Input
                          placeholder="email@example.com"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          data-testid="invite-email-input"
                          className="max-w-sm"
                        />
                        <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} data-testid="invite-btn" className="gap-2">
                          {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          Добавить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Magic Link Invitations */}
                {isOrgAdmin() && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        Пригласить по ссылке
                      </CardTitle>
                      <CardDescription>
                        Создайте одноразовую ссылку-приглашение. Сотрудник перейдёт по ней и зарегистрируется.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Заметка (необязательно)"
                          value={inviteNote}
                          onChange={e => setInviteNote(e.target.value)}
                          data-testid="invite-note-input"
                          className="max-w-sm"
                        />
                        <Button
                          onClick={handleCreateInvite}
                          disabled={creatingInvite}
                          data-testid="create-invite-link-btn"
                          className="gap-2"
                        >
                          {creatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                          Создать ссылку
                        </Button>
                      </div>

                      {invitations.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Статус</TableHead>
                              <TableHead>Заметка</TableHead>
                              <TableHead>Создал</TableHead>
                              <TableHead>Использовал</TableHead>
                              <TableHead>Дата</TableHead>
                              <TableHead>Действия</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invitations.map(inv => (
                              <TableRow key={inv.id} data-testid={`invitation-row-${inv.id}`}>
                                <TableCell>
                                  {inv.is_used ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Использовано
                                    </Badge>
                                  ) : inv.is_revoked ? (
                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1">
                                      <Ban className="w-3 h-3" />
                                      Отозвано
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                                      <Clock className="w-3 h-3" />
                                      Активно
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {inv.note || '—'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {inv.created_by_name}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {inv.is_used ? inv.used_by_name : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                  {format(new Date(inv.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {!inv.is_used && !inv.is_revoked && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleCopyLink(inv.token)}
                                          data-testid={`copy-invite-${inv.id}`}
                                          title="Копировать ссылку"
                                        >
                                          <Copy className="w-4 h-4 text-slate-500" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleRevokeInvite(inv.id)}
                                          data-testid={`revoke-invite-${inv.id}`}
                                          title="Отозвать"
                                        >
                                          <Ban className="w-4 h-4 text-red-500" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Org Users */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Сотрудники ({orgUsers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Имя</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Роль</TableHead>
                          <TableHead>Лимит токенов/мес</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgUsers.map(u => (
                          <TableRow key={u.id} data-testid={`org-user-${u.id}`}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell>
                              {u.id !== user?.id && isOrgAdmin() ? (
                                <Select value={u.role} onValueChange={v => handleOrgRoleChange(u.id, v)}>
                                  <SelectTrigger className="w-36" data-testid={`org-role-${u.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">Пользователь</SelectItem>
                                    <SelectItem value="org_admin">Админ орг.</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <RoleBadge role={u.role} />
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => { setLimitDialog(u); setLimitValue(String(u.monthly_token_limit || 0)); }}
                                data-testid={`set-limit-${u.id}`}
                              >
                                <Settings2 className="w-3 h-3" />
                                {u.monthly_token_limit > 0 ? u.monthly_token_limit.toLocaleString() : 'Без лимита'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              {u.id !== user?.id && isOrgAdmin() && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveUser(u.id)}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* All Users Tab (superadmin) */}
            {isSuperadmin() && (
              <TabsContent value="all-users">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Все пользователи ({allUsers.length})</CardTitle>
                        <CardDescription>Управление ролями на уровне платформы</CardDescription>
                      </div>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Поиск..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} data-testid="search-users-input" />
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
                        {filteredAllUsers.map(u => (
                          <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                  <span className="text-sm font-medium">{u.name?.[0]?.toUpperCase()}</span>
                                </div>
                                <span className="font-medium">{u.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell><RoleBadge role={u.role} /></TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(u.created_at), 'dd MMM yyyy', { locale: ru })}
                            </TableCell>
                            <TableCell>
                              {u.id !== user?.id && (
                                <Select value={u.role} onValueChange={v => handleSuperadminRoleChange(u.id, v)}>
                                  <SelectTrigger className="w-36" data-testid={`role-select-${u.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">Пользователь</SelectItem>
                                    <SelectItem value="org_admin">Админ орг.</SelectItem>
                                    <SelectItem value="superadmin">Суперадмин</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* All Orgs Tab (superadmin) */}
            {isSuperadmin() && (
              <TabsContent value="all-orgs">
                <Card>
                  <CardHeader>
                    <CardTitle>Все организации ({allOrgs.length})</CardTitle>
                    <CardDescription>Обзор зарегистрированных организаций</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Организация</TableHead>
                          <TableHead>Пользователей</TableHead>
                          <TableHead>Дата создания</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allOrgs.map(o => (
                          <TableRow
                            key={o.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => setSelectedOrgId(o.id)}
                            data-testid={`org-row-${o.id}`}
                          >
                            <TableCell className="font-medium">{o.name}</TableCell>
                            <TableCell>{o.user_count}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(o.created_at), 'dd MMM yyyy', { locale: ru })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Models Tab (superadmin) */}
            {isSuperadmin() && (
              <TabsContent value="models">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Управление моделями</CardTitle>
                        <CardDescription>Текущая модель и обновления OpenAI</CardDescription>
                      </div>
                      <Button variant="outline" className="gap-2" onClick={handleCheckModels} disabled={checking} data-testid="check-models-btn">
                        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Проверить
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Активная модель</div>
                        <div className="text-lg font-semibold" data-testid="active-model-name">{modelInfo?.active_model || 'gpt-5.2'}</div>
                      </div>
                      {modelInfo?.last_check && (
                        <div className="ml-auto text-sm text-muted-foreground">
                          Проверка: {format(new Date(modelInfo.last_check), 'dd MMM yyyy HH:mm', { locale: ru })}
                        </div>
                      )}
                    </div>
                    {checkResult?.newer_models?.length > 0 && (
                      <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
                        <div className="font-medium text-amber-800">Новые модели:</div>
                        {checkResult.newer_models.map(model => (
                          <div key={model} className="flex items-center justify-between p-2 rounded bg-white border">
                            <span className="font-mono text-sm">{model}</span>
                            <Button size="sm" onClick={() => handleSwitchModel(model)} disabled={switching}>
                              {switching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                              Переключить
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {checkResult?.available_models && (
                      <div className="p-4 rounded-lg border bg-slate-50">
                        <div className="font-medium mb-2">Все GPT модели ({checkResult.available_models.length}):</div>
                        <div className="flex flex-wrap gap-2">
                          {checkResult.available_models.map(model => (
                            <Badge key={model} variant={model === modelInfo?.active_model ? 'default' : 'outline'}
                              className={model === modelInfo?.active_model ? 'bg-emerald-600' : 'cursor-pointer hover:bg-slate-100'}
                              onClick={() => model !== modelInfo?.active_model && handleSwitchModel(model)}>
                              {model}{model === modelInfo?.active_model && ' (активна)'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Markup Tiers Tab (superadmin) */}
            {isSuperadmin() && (
              <TabsContent value="markup">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Таблица наценок</CardTitle>
                        <CardDescription>Наценка зависит от базовой стоимости AI-запроса (USD). Множитель применяется к стоимости от провайдера.</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {editingTiers ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setEditingTiers(null)}>Отмена</Button>
                            <Button size="sm" onClick={handleSaveMarkupTiers} disabled={savingTiers} data-testid="save-markup-btn" className="gap-1">
                              {savingTiers ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Сохранить
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setEditingTiers([...markupTiers])} data-testid="edit-markup-btn">
                            Редактировать
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>От (USD)</TableHead>
                          <TableHead>До (USD)</TableHead>
                          <TableHead>Множитель</TableHead>
                          <TableHead>Пример</TableHead>
                          {editingTiers && <TableHead className="w-12"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(editingTiers || markupTiers).map((tier, idx) => (
                          <TableRow key={idx} data-testid={`markup-tier-${idx}`}>
                            <TableCell>
                              {editingTiers ? (
                                <Input
                                  type="number" step="0.001" className="w-28"
                                  value={tier.min_cost} onChange={e => handleTierChange(idx, 'min_cost', e.target.value)}
                                />
                              ) : (
                                <span className="font-mono text-sm">${tier.min_cost}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingTiers ? (
                                <Input
                                  type="number" step="0.001" className="w-28"
                                  value={tier.max_cost} onChange={e => handleTierChange(idx, 'max_cost', e.target.value)}
                                />
                              ) : (
                                <span className="font-mono text-sm">${tier.max_cost}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingTiers ? (
                                <Input
                                  type="number" step="0.5" min="1" className="w-20"
                                  value={tier.multiplier} onChange={e => handleTierChange(idx, 'multiplier', e.target.value)}
                                />
                              ) : (
                                <Badge variant="secondary" className="font-mono">{tier.multiplier}x</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              ${tier.min_cost.toFixed(4)} &rarr; ${(tier.min_cost * tier.multiplier).toFixed(4)}
                            </TableCell>
                            {editingTiers && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveTier(idx)}>
                                  <X className="w-4 h-4 text-red-500" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {editingTiers && (
                      <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={handleAddTier} data-testid="add-tier-btn">
                        <Plus className="w-3 h-3" /> Добавить уровень
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Cost Settings Tab (superadmin) */}
            {isSuperadmin() && (
              <TabsContent value="costs">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Себестоимость сервисов</CardTitle>
                          <CardDescription>
                            Базовые расценки провайдеров и множители наценки для клиентов. Стоимость автоматически конвертируется в кредиты.
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {editingCost ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setEditingCost(null)}>Отмена</Button>
                              <Button size="sm" onClick={handleSaveCostSettings} disabled={savingCost} data-testid="save-cost-btn" className="gap-1">
                                {savingCost ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Сохранить
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setEditingCost({ ...(costSettings || {}) })} data-testid="edit-cost-btn">
                              Редактировать
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Transcription Cost */}
                      <div className="p-4 rounded-lg border bg-slate-50 space-y-3">
                        <div className="font-medium flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-blue-600" />
                          Транскрибация (Deepgram Nova-3)
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-muted-foreground block mb-1">Базовая стоимость ($/мин)</label>
                            {editingCost ? (
                              <Input
                                type="number" step="0.0001" min="0" className="w-40"
                                value={editingCost.transcription_cost_per_minute_usd ?? ''}
                                onChange={e => setEditingCost({ ...editingCost, transcription_cost_per_minute_usd: parseFloat(e.target.value) || 0 })}
                                data-testid="transcription-base-cost-input"
                              />
                            ) : (
                              <span className="font-mono text-sm" data-testid="transcription-base-cost">
                                ${(costSettings?.transcription_cost_per_minute_usd ?? 0.0043).toFixed(4)}/мин
                              </span>
                            )}
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground block mb-1">Множитель для клиента</label>
                            {editingCost ? (
                              <Input
                                type="number" step="0.5" min="1" className="w-40"
                                value={editingCost.transcription_cost_multiplier ?? ''}
                                onChange={e => setEditingCost({ ...editingCost, transcription_cost_multiplier: parseFloat(e.target.value) || 1 })}
                                data-testid="transcription-multiplier-input"
                              />
                            ) : (
                              <Badge variant="secondary" className="font-mono" data-testid="transcription-multiplier">
                                {(costSettings?.transcription_cost_multiplier ?? 3.0)}x
                              </Badge>
                            )}
                          </div>
                        </div>
                        {costSettings && (
                          <div className="text-sm text-muted-foreground">
                            Пример: 10 мин аудио = ${(10 * (costSettings.transcription_cost_per_minute_usd || 0.0043)).toFixed(4)} себестоимость
                            {' '}&rarr; ${(10 * (costSettings.transcription_cost_per_minute_usd || 0.0043) * (costSettings.transcription_cost_multiplier || 3)).toFixed(4)} для клиента
                            {' '}= {(10 * (costSettings.transcription_cost_per_minute_usd || 0.0043) * (costSettings.transcription_cost_multiplier || 3) / 0.02).toFixed(2)} кредитов
                          </div>
                        )}
                      </div>

                      {/* S3 Storage Cost */}
                      <div className="p-4 rounded-lg border bg-slate-50 space-y-3">
                        <div className="font-medium flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-emerald-600" />
                          Хранение файлов (S3)
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-muted-foreground block mb-1">Базовая стоимость ($/ГБ/мес)</label>
                            {editingCost ? (
                              <Input
                                type="number" step="0.001" min="0" className="w-40"
                                value={editingCost.s3_storage_cost_per_gb_month_usd ?? ''}
                                onChange={e => setEditingCost({ ...editingCost, s3_storage_cost_per_gb_month_usd: parseFloat(e.target.value) || 0 })}
                                data-testid="storage-base-cost-input"
                              />
                            ) : (
                              <span className="font-mono text-sm" data-testid="storage-base-cost">
                                ${(costSettings?.s3_storage_cost_per_gb_month_usd ?? 0.025).toFixed(3)}/ГБ/мес
                              </span>
                            )}
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground block mb-1">Множитель для клиента</label>
                            {editingCost ? (
                              <Input
                                type="number" step="0.5" min="1" className="w-40"
                                value={editingCost.s3_storage_cost_multiplier ?? ''}
                                onChange={e => setEditingCost({ ...editingCost, s3_storage_cost_multiplier: parseFloat(e.target.value) || 1 })}
                                data-testid="storage-multiplier-input"
                              />
                            ) : (
                              <Badge variant="secondary" className="font-mono" data-testid="storage-multiplier">
                                {(costSettings?.s3_storage_cost_multiplier ?? 3.0)}x
                              </Badge>
                            )}
                          </div>
                        </div>
                        {costSettings && (
                          <div className="text-sm text-muted-foreground">
                            Пример: 1 ГБ/мес = ${(costSettings.s3_storage_cost_per_gb_month_usd || 0.025).toFixed(3)} себестоимость
                            {' '}&rarr; ${((costSettings.s3_storage_cost_per_gb_month_usd || 0.025) * (costSettings.s3_storage_cost_multiplier || 3)).toFixed(3)} для клиента
                            {' '}= {((costSettings.s3_storage_cost_per_gb_month_usd || 0.025) * (costSettings.s3_storage_cost_multiplier || 3) / 0.02).toFixed(2)} кредитов/мес
                          </div>
                        )}
                      </div>

                      {/* Info block */}
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
                        <strong>Как это работает:</strong>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          <li>Транскрибация — списание после каждой успешной транскрибации аудио</li>
                          <li>Хранение — ежедневное списание в 3:05 МСК за текущий объём файлов в S3</li>
                          <li>1 кредит = $0.02. Формула: (базовая цена × множитель) / $0.02 = кредиты</li>
                        </ul>
                      </div>

                      {/* Manual trigger */}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRunStorageCalc}
                          disabled={runningStorageCalc}
                          data-testid="run-storage-calc-btn"
                          className="gap-2"
                        >
                          {runningStorageCalc ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Запустить расчёт хранения вручную
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Применит текущие настройки ко всем организациям
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            {/* System / Trash Tab (superadmin) */}
            {isSuperadmin() && (
              <TabsContent value="system">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Trash2 className="w-5 h-5" />
                          Настройки корзины
                        </CardTitle>
                        <CardDescription>
                          Удалённые папки и проекты хранятся в корзине указанное количество дней, после чего удаляются навсегда.
                          Очистка запускается автоматически каждый день в 3:10 МСК.
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {editingTrash !== null ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setEditingTrash(null)}>Отмена</Button>
                            <Button size="sm" onClick={handleSaveTrashSettings} disabled={savingTrash} data-testid="save-trash-settings-btn" className="gap-1">
                              {savingTrash ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Сохранить
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setEditingTrash(trashRetention)} data-testid="edit-trash-settings-btn">
                            Редактировать
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg border bg-slate-50 space-y-3">
                      <div className="font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        Срок хранения в корзине
                      </div>
                      <div className="flex items-center gap-3">
                        {editingTrash !== null ? (
                          <>
                            <Input
                              type="number" min="1" max="365" className="w-24"
                              value={editingTrash}
                              onChange={e => setEditingTrash(parseInt(e.target.value) || 1)}
                              data-testid="trash-retention-input"
                            />
                            <span className="text-sm text-muted-foreground">дней</span>
                          </>
                        ) : (
                          <span className="text-lg font-semibold" data-testid="trash-retention-value">
                            {trashRetention} {trashRetention === 1 ? 'день' : trashRetention < 5 ? 'дня' : 'дней'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                      <strong>Внимание:</strong> При уменьшении срока хранения, элементы, которые уже просрочены, будут удалены при следующей очистке.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </main>

        {/* Limit Dialog */}
        <Dialog open={!!limitDialog} onOpenChange={() => setLimitDialog(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Лимит токенов на месяц</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Пользователь: {limitDialog?.name}. Введите 0 для снятия лимита.
              </p>
              <Input
                type="number"
                value={limitValue}
                onChange={e => setLimitValue(e.target.value)}
                placeholder="0 = без лимита"
                data-testid="limit-input"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLimitDialog(null)}>Отмена</Button>
              <Button onClick={handleSetLimit} data-testid="save-limit-btn">Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <OrgDetailModal
          orgId={selectedOrgId}
          open={!!selectedOrgId}
          onClose={() => setSelectedOrgId(null)}
        />
      </div>
    </AppLayout>
  );
}
