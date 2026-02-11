import React, { useState, useEffect } from 'react';
import { billingApi } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  Building2, Users, History, BarChart3, Loader2, Zap,
  ArrowUpRight, ArrowDownRight, Plus, TrendingUp, Hash, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const ROLE_LABELS = { superadmin: 'Суперадмин', org_admin: 'Админ', user: 'Юзер', admin: 'Админ' };

function Metric({ label, value, sub }) {
  return (
    <div className="text-center p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-lg font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniBarChart({ data, maxVal }) {
  if (!data.length) return null;
  const max = maxVal || Math.max(...data.map(d => d.credits), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-emerald-500/80 rounded-t-sm transition-all min-h-[2px]"
            style={{ height: `${Math.max(2, (d.credits / max) * 80)}px` }}
          />
          <span className="text-[8px] text-muted-foreground leading-none">{d.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function OrgDetailModal({ orgId, open, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDesc, setTopupDesc] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !open) return;
    setLoading(true);
    setTab('info');
    billingApi.adminOrgDetail(orgId)
      .then(res => setData(res.data))
      .catch(() => toast.error('Ошибка загрузки данных организации'))
      .finally(() => setLoading(false));
  }, [orgId, open]);

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) { toast.error('Укажите сумму > 0'); return; }
    setTopupLoading(true);
    try {
      const res = await billingApi.adminTopup(orgId, amount, topupDesc || undefined);
      toast.success(res.data.message);
      setTopupAmount('');
      setTopupDesc('');
      // Refresh
      const refreshed = await billingApi.adminOrgDetail(orgId);
      setData(refreshed.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка пополнения');
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {data?.org?.name || 'Организация'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded-lg overflow-hidden divide-x">
              <Metric
                label="Баланс"
                value={data.balance.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                sub="кредитов"
              />
              <Metric
                label="Всего оплачено"
                value={data.total_topups.toLocaleString('ru-RU')}
                sub="кредитов"
              />
              <Metric
                label="Потрачено"
                value={data.total_credits_spent.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                sub={`${data.total_requests} запросов`}
              />
              <Metric
                label="Ср. расход/мес"
                value={data.avg_monthly_spend.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                sub="кредитов"
              />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full border p-0.5">
                <TabsTrigger value="info" className="flex-1 gap-1.5 text-xs" data-testid="org-detail-info-tab">
                  <BarChart3 className="w-3.5 h-3.5" /> Статистика
                </TabsTrigger>
                <TabsTrigger value="users" className="flex-1 gap-1.5 text-xs" data-testid="org-detail-users-tab">
                  <Users className="w-3.5 h-3.5" /> Пользователи
                </TabsTrigger>
                <TabsTrigger value="txns" className="flex-1 gap-1.5 text-xs" data-testid="org-detail-txns-tab">
                  <History className="w-3.5 h-3.5" /> Транзакции
                </TabsTrigger>
                <TabsTrigger value="topup" className="flex-1 gap-1.5 text-xs" data-testid="org-detail-topup-tab">
                  <Plus className="w-3.5 h-3.5" /> Пополнить
                </TabsTrigger>
              </TabsList>

              {/* Stats Tab */}
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <Hash className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">AI-запросов</p>
                      <p className="text-xl font-bold">{data.total_requests.toLocaleString('ru-RU')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <Zap className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Токенов</p>
                      <p className="text-xl font-bold">{data.total_tokens.toLocaleString('ru-RU')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                      <DollarSign className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Ср. стоимость запроса</p>
                      <p className="text-xl font-bold">{data.avg_request_cost} кр.</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Chart */}
                {data.monthly_chart.length > 0 && (
                  <Card>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground mb-3">Помесячная динамика расходов (кредиты)</p>
                      <MiniBarChart data={data.monthly_chart} />
                      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                        {data.monthly_chart.map(d => (
                          <span key={d.month} className="flex-1 text-center">{d.credits.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top Users */}
                {data.top_users.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Топ пользователей по расходам</p>
                    <div className="space-y-1.5">
                      {data.top_users.map((u, i) => {
                        const maxCredits = data.top_users[0].credits || 1;
                        return (
                          <div key={u.user_id} className="flex items-center gap-3" data-testid={`top-user-${i}`}>
                            <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}.</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm font-medium">{u.name}</span>
                                <span className="text-xs tabular-nums">{u.credits.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} кр.</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1">
                                <div
                                  className="bg-slate-800 h-1 rounded-full"
                                  style={{ width: `${(u.credits / maxCredits) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Лимит</TableHead>
                      <TableHead>Регистрация</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map(u => (
                      <TableRow key={u.id} data-testid={`org-user-${u.id}`}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{ROLE_LABELS[u.role] || u.role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {u.monthly_token_limit ? u.monthly_token_limit.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {u.created_at ? format(new Date(u.created_at), 'dd.MM.yyyy', { locale: ru }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.users.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет пользователей</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="txns" className="mt-4">
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.map(txn => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(txn.created_at), 'dd.MM.yy HH:mm', { locale: ru })}
                          </TableCell>
                          <TableCell>
                            {txn.type === 'topup'
                              ? <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                              : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                          </TableCell>
                          <TableCell className="text-sm">{txn.description}</TableCell>
                          <TableCell className={`text-right font-medium tabular-nums text-sm ${txn.type === 'topup' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {txn.type === 'topup' ? '+' : '-'}{txn.amount.toLocaleString('ru-RU', { maximumFractionDigits: 4 })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.transactions.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Нет транзакций</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Topup Tab */}
              <TabsContent value="topup" className="mt-4">
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Ручное пополнение баланса</p>
                      <p className="text-xs text-muted-foreground">Кредиты будут начислены организации немедленно</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Сумма (кредитов)</label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Например: 500"
                          value={topupAmount}
                          onChange={e => setTopupAmount(e.target.value)}
                          data-testid="admin-topup-amount"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Комментарий (необязательно)</label>
                        <Input
                          placeholder="Причина пополнения"
                          value={topupDesc}
                          onChange={e => setTopupDesc(e.target.value)}
                          data-testid="admin-topup-desc"
                        />
                      </div>
                      <Button
                        onClick={handleTopup}
                        disabled={topupLoading || !topupAmount}
                        className="w-full gap-2"
                        data-testid="admin-topup-btn"
                      >
                        {topupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                        Пополнить баланс
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Текущий баланс: <span className="font-medium text-foreground">{data.balance.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} кредитов</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
