import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { billingApi } from '../lib/api';
import { Button } from '../components/ui/button';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  CreditCard, Wallet, ArrowUpRight, ArrowDownRight, History,
  Loader2, Building2, Zap, ShoppingCart, Users, BarChart3, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import OrgDetailModal from '../components/billing/OrgDetailModal';

function MetricCard({ label, value, sub, icon: Icon, color = 'bg-slate-50', iconColor = 'text-slate-600' }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const { user, isOrgAdmin, isSuperadmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [balance, setBalance] = useState(null);
  const [plans, setPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [myUsage, setMyUsage] = useState(null);
  const [orgUsersUsage, setOrgUsersUsage] = useState([]);

  // Superadmin
  const [adminBalances, setAdminBalances] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  // Purchase dialog
  const [purchaseDialog, setPurchaseDialog] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Custom topup state
  const [customCredits, setCustomCredits] = useState('');
  const [customCalc, setCustomCalc] = useState(null);
  const [showCustom, setShowCustom] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const promises = [
        billingApi.getBalance().catch(() => ({ data: null })),
        billingApi.getPlans().catch(() => ({ data: [] })),
        billingApi.getTransactions().catch(() => ({ data: { items: [], total: 0 } })),
        billingApi.getMyUsage().catch(() => ({ data: null })),
      ];
      if (isOrgAdmin()) {
        promises.push(billingApi.getOrgUsersUsage().catch(() => ({ data: [] })));
      }
      if (isSuperadmin()) {
        promises.push(
          billingApi.adminBalances().catch(() => ({ data: [] })),
          billingApi.adminSummary().catch(() => ({ data: null })),
        );
      }
      const results = await Promise.all(promises);
      setBalance(results[0].data);
      setPlans(results[1].data || []);
      const txnData = results[2].data;
      setTransactions(txnData?.items || txnData || []);
      setTxnTotal(txnData?.total || 0);
      setMyUsage(results[3].data);

      let idx = 4;
      if (isOrgAdmin()) {
        setOrgUsersUsage(results[idx]?.data || []);
        idx++;
      }
      if (isSuperadmin()) {
        setAdminBalances(results[idx]?.data || []);
        setAdminSummary(results[idx + 1]?.data);
      }
    } catch {
      toast.error('Ошибка загрузки данных биллинга');
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin, isSuperadmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async () => {
    if (!purchaseDialog) return;
    setPurchasing(true);
    try {
      const isCustom = purchaseDialog.isCustom;
      const res = await billingApi.topup(
        isCustom ? null : purchaseDialog.id,
        isCustom ? purchaseDialog.credits : null
      );
      toast.success(res.data.message);
      setPurchaseDialog(null);
      setShowCustom(false);
      setCustomCredits('');
      setCustomCalc(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка покупки');
    } finally {
      setPurchasing(false);
    }
  };

  const handleCustomCalc = async (val) => {
    const credits = parseInt(val);
    if (!credits || credits < 1000) {
      setCustomCalc(null);
      return;
    }
    try {
      const res = await billingApi.calculateCustom(credits);
      setCustomCalc(res.data);
    } catch {
      setCustomCalc(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
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
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight">Биллинг</span>
                {balance && <span className="text-sm text-muted-foreground ml-3">{balance.org_name}</span>}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white border p-1 mb-6">
              <TabsTrigger value="overview" className="gap-2" data-testid="billing-overview-tab">
                <Wallet className="w-4 h-4" />
                Обзор
              </TabsTrigger>
              {isOrgAdmin() && (
                <TabsTrigger value="team" className="gap-2" data-testid="billing-team-tab">
                  <Users className="w-4 h-4" />
                  Команда
                </TabsTrigger>
              )}
              <TabsTrigger value="history" className="gap-2" data-testid="billing-history-tab">
                <History className="w-4 h-4" />
                История
              </TabsTrigger>
              {isSuperadmin() && (
                <TabsTrigger value="platform" className="gap-2" data-testid="billing-platform-tab">
                  <BarChart3 className="w-4 h-4" />
                  Платформа
                </TabsTrigger>
              )}
            </TabsList>

            {/* ===== OVERVIEW TAB ===== */}
            <TabsContent value="overview">
              <div className="space-y-6">
                {/* Balance + Usage Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="md:col-span-2" data-testid="balance-card">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Баланс кредитов</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold tracking-tight" data-testid="credit-balance">
                              {(balance?.balance || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-lg text-muted-foreground">кредитов</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            ≈ ${((balance?.balance || 0) * 0.02).toFixed(2)} USD
                          </p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                          <Zap className="w-7 h-7 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <MetricCard
                    label="AI-запросов за месяц"
                    value={myUsage?.total_requests || 0}
                    sub={`${(myUsage?.total_tokens || 0).toLocaleString('ru-RU')} токенов`}
                    icon={BarChart3}
                    color="bg-blue-50"
                    iconColor="text-blue-600"
                  />
                  <Card data-testid="usage-limit-card">
                    <CardContent className="pt-5 pb-4">
                      <p className="text-xs text-muted-foreground mb-1">Потрачено кредитов</p>
                      <p className="text-2xl font-bold tracking-tight">
                        {(myUsage?.total_credits || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                      </p>
                      {myUsage?.monthly_token_limit > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Лимит</span>
                            <span>{(myUsage.total_tokens || 0).toLocaleString()} / {myUsage.monthly_token_limit.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                ((myUsage.total_tokens || 0) / myUsage.monthly_token_limit) > 0.9
                                  ? 'bg-red-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, ((myUsage.total_tokens || 0) / myUsage.monthly_token_limit) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Tariff Plans */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Тарифные планы
                    </CardTitle>
                    <CardDescription>Пополните баланс кредитов для использования AI-функций</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {plans.sort((a, b) => a.credits - b.credits).map(plan => (
                        <div
                          key={plan.id}
                          className="relative border rounded-xl p-5 hover:border-slate-400 transition-colors"
                          data-testid={`plan-card-${plan.id}`}
                        >
                          {plan.discount_pct > 0 && (
                            <div className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                              -{plan.discount_pct}%
                            </div>
                          )}
                          <div className="mb-3">
                            <h3 className="text-lg font-semibold">{plan.credits.toLocaleString('ru-RU')} кредитов</h3>
                          </div>
                          <div className="mb-1">
                            <span className="text-2xl font-bold">{(plan.price_rub || 0).toLocaleString('ru-RU')}</span>
                            <span className="text-sm text-muted-foreground ml-1">руб</span>
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">
                            (${plan.price_usd})
                          </div>
                          <ul className="space-y-1.5 mb-5 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                              ${(plan.price_usd / plan.credits).toFixed(4)} за кредит
                            </li>
                          </ul>
                          {isOrgAdmin() && (
                            <Button
                              className="w-full"
                              onClick={() => setPurchaseDialog(plan)}
                              data-testid={`buy-plan-${plan.id}`}
                            >
                              Пополнить
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Custom amount */}
                    {isOrgAdmin() && (
                      <div className="border rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">Своя сумма кредитов</h3>
                          <Button variant="ghost" size="sm" onClick={() => setShowCustom(!showCustom)} data-testid="custom-amount-toggle">
                            {showCustom ? 'Скрыть' : 'Указать'}
                          </Button>
                        </div>
                        {showCustom && (
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <Input
                                type="number"
                                min={1000}
                                step={100}
                                placeholder="Минимум 1000"
                                value={customCredits}
                                onChange={(e) => {
                                  setCustomCredits(e.target.value);
                                  handleCustomCalc(e.target.value);
                                }}
                                data-testid="custom-credits-input"
                              />
                              <Button
                                disabled={!customCalc}
                                onClick={() => setPurchaseDialog({
                                  isCustom: true,
                                  credits: customCalc.credits,
                                  price_usd: customCalc.price_usd,
                                  price_rub: customCalc.price_rub,
                                  discount_pct: customCalc.discount_pct,
                                  name: `${customCalc.credits.toLocaleString('ru-RU')} кредитов`,
                                })}
                                data-testid="custom-buy-btn"
                              >
                                Пополнить
                              </Button>
                            </div>
                            {customCalc && (
                              <div className="flex items-center gap-4 text-sm">
                                <span className="font-semibold">{customCalc.price_rub.toLocaleString('ru-RU')} руб (${customCalc.price_usd})</span>
                                {customCalc.discount_pct > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                    Скидка {customCalc.discount_pct}%
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Скидки: от 2 500 кредитов — 10%, от 5 000 — 15%, от 10 000 — 20%
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Последние операции</CardTitle>
                      {transactions.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('history')} className="text-xs">
                          Все операции
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {transactions.length > 0 ? (
                      <div className="space-y-2">
                        {transactions.slice(0, 5).map(txn => (
                          <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`recent-txn-${txn.id}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${txn.type === 'topup' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                {txn.type === 'topup' ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{txn.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(txn.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                                </p>
                              </div>
                            </div>
                            <span className={`font-semibold tabular-nums ${txn.type === 'topup' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {txn.type === 'topup' ? '+' : '-'}{txn.amount.toLocaleString('ru-RU', { maximumFractionDigits: 4 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8 text-sm">Операций пока нет</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ===== TEAM TAB (org_admin) ===== */}
            {isOrgAdmin() && (
              <TabsContent value="team">
                <Card>
                  <CardHeader>
                    <CardTitle>Использование по сотрудникам</CardTitle>
                    <CardDescription>Статистика AI-запросов за текущий месяц</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {orgUsersUsage.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Сотрудник</TableHead>
                            <TableHead className="text-right">Запросов</TableHead>
                            <TableHead className="text-right">Токенов</TableHead>
                            <TableHead className="text-right">Кредитов</TableHead>
                            <TableHead>Лимит</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orgUsersUsage.map(u => {
                            const limitPct = u.monthly_token_limit > 0
                              ? Math.min(100, (u.total_tokens / u.monthly_token_limit) * 100) : 0;
                            return (
                              <TableRow key={u.user_id} data-testid={`team-user-${u.user_id}`}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-medium">{u.name?.[0]?.toUpperCase()}</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{u.name}</p>
                                      <p className="text-xs text-muted-foreground">{u.email}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{u.total_requests}</TableCell>
                                <TableCell className="text-right tabular-nums">{u.total_tokens.toLocaleString('ru-RU')}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {u.total_credits.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="w-40">
                                  {u.monthly_token_limit > 0 ? (
                                    <div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                        <span>{u.total_tokens.toLocaleString()}</span>
                                        <span>{u.monthly_token_limit.toLocaleString()}</span>
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                                        <div
                                          className={`h-1.5 rounded-full transition-all ${limitPct > 90 ? 'bg-red-500' : limitPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                          style={{ width: `${limitPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Без лимита</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-12 text-sm">Нет данных об использовании за текущий месяц</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* ===== HISTORY TAB ===== */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>История операций</CardTitle>
                  <CardDescription>Все пополнения и списания кредитов</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Описание</TableHead>
                          <TableHead>Пользователь</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(txn => (
                          <TableRow key={txn.id} data-testid={`txn-row-${txn.id}`}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {format(new Date(txn.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                            </TableCell>
                            <TableCell>
                              <Badge className={txn.type === 'topup' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                                {txn.type === 'topup' ? 'Пополнение' : 'Списание'}
                              </Badge>
                            </TableCell>
                            <TableCell>{txn.description}</TableCell>
                            <TableCell className="text-muted-foreground">{txn.user_name || '—'}</TableCell>
                            <TableCell className={`text-right font-semibold tabular-nums ${txn.type === 'topup' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {txn.type === 'topup' ? '+' : '-'}{txn.amount.toLocaleString('ru-RU', { maximumFractionDigits: 4 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-12 text-sm">Операций пока нет</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===== PLATFORM TAB (superadmin) ===== */}
            {isSuperadmin() && (
              <TabsContent value="platform">
                <div className="space-y-6">
                  {/* Platform Metrics */}
                  {adminSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MetricCard
                        label="Выручка (USD)"
                        value={`$${adminSummary.total_revenue_usd.toLocaleString('ru-RU')}`}
                        sub={`${adminSummary.total_topups_credits.toLocaleString()} кредитов куплено`}
                        icon={TrendingUp}
                        color="bg-emerald-50"
                        iconColor="text-emerald-600"
                      />
                      <MetricCard
                        label="Потрачено кредитов"
                        value={adminSummary.total_deductions_credits.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                        sub="за всё время"
                        icon={ArrowDownRight}
                        color="bg-red-50"
                        iconColor="text-red-500"
                      />
                      <MetricCard
                        label="Запросов за месяц"
                        value={adminSummary.month_requests.toLocaleString('ru-RU')}
                        sub={`${adminSummary.month_tokens.toLocaleString()} токенов`}
                        icon={BarChart3}
                        color="bg-blue-50"
                        iconColor="text-blue-600"
                      />
                      <MetricCard
                        label="Организаций / Юзеров"
                        value={`${adminSummary.org_count} / ${adminSummary.user_count}`}
                        icon={Building2}
                        color="bg-purple-50"
                        iconColor="text-purple-600"
                      />
                    </div>
                  )}

                  {/* All Orgs Balances */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Балансы организаций</CardTitle>
                      <CardDescription>Текущие балансы и статистика расходов</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {adminBalances.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Организация</TableHead>
                              <TableHead className="text-right">Баланс</TableHead>
                              <TableHead className="text-right">Пополнено</TableHead>
                              <TableHead className="text-right">Потрачено</TableHead>
                              <TableHead>Обновлено</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adminBalances.map(b => (
                              <TableRow
                                key={b.org_id}
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={() => setSelectedOrgId(b.org_id)}
                                data-testid={`admin-balance-${b.org_id}`}
                              >
                                <TableCell className="font-medium">{b.org_name}</TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">
                                  {b.balance.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right text-emerald-600 tabular-nums">
                                  +{b.total_topups.toLocaleString('ru-RU')}
                                </TableCell>
                                <TableCell className="text-right text-red-600 tabular-nums">
                                  -{b.total_deductions.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                  {format(new Date(b.updated_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-center py-12 text-sm">Нет данных</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </main>

        {/* Purchase Dialog */}
        <Dialog open={!!purchaseDialog} onOpenChange={() => setPurchaseDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Подтверждение покупки</DialogTitle>
              <DialogDescription>Мок-оплата: деньги не списываются</DialogDescription>
            </DialogHeader>
            {purchaseDialog && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Пакет</span>
                    <span className="font-medium">{purchaseDialog.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Кредиты</span>
                    <span className="font-semibold text-emerald-600">+{purchaseDialog.credits.toLocaleString('ru-RU')}</span>
                  </div>
                  {purchaseDialog.discount_pct > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Скидка</span>
                      <span className="font-semibold text-emerald-600">{purchaseDialog.discount_pct}%</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-2 mt-2">
                    <span className="text-sm font-medium">К оплате</span>
                    <div className="text-right">
                      <span className="text-lg font-bold">{(purchaseDialog.price_rub || 0).toLocaleString('ru-RU')} руб</span>
                      <span className="text-sm text-muted-foreground ml-1.5">(${purchaseDialog.price_usd})</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">Демо-режим. Кредиты начислятся без реальной оплаты.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurchaseDialog(null)}>Отмена</Button>
              <Button onClick={handlePurchase} disabled={purchasing} data-testid="confirm-purchase-btn" className="gap-2">
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Оплатить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Org Detail Modal */}
        <OrgDetailModal
          orgId={selectedOrgId}
          open={!!selectedOrgId}
          onClose={() => setSelectedOrgId(null)}
        />
      </div>
    </AppLayout>
  );
}
