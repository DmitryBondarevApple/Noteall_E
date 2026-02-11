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
  Loader2, Building2, TrendingUp, Zap, ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function BillingPage() {
  const { user, isOrgAdmin, isSuperadmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [balance, setBalance] = useState(null);
  const [plans, setPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [myUsage, setMyUsage] = useState(null);

  // Superadmin
  const [adminBalances, setAdminBalances] = useState([]);

  // Purchase dialog
  const [purchaseDialog, setPurchaseDialog] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const promises = [
        billingApi.getBalance().catch(() => ({ data: null })),
        billingApi.getPlans().catch(() => ({ data: [] })),
        billingApi.getTransactions().catch(() => ({ data: { items: [], total: 0 } })),
        billingApi.getMyUsage().catch(() => ({ data: null })),
      ];
      if (isSuperadmin()) {
        promises.push(billingApi.adminBalances().catch(() => ({ data: [] })));
      }
      const results = await Promise.all(promises);
      setBalance(results[0].data);
      setPlans(results[1].data || []);
      const txnData = results[2].data;
      setTransactions(txnData?.items || txnData || []);
      setTxnTotal(txnData?.total || 0);
      setMyUsage(results[3].data);
      if (isSuperadmin() && results[4]) {
        setAdminBalances(results[4].data || []);
      }
    } catch {
      toast.error('Ошибка загрузки данных биллинга');
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async () => {
    if (!purchaseDialog) return;
    setPurchasing(true);
    try {
      const res = await billingApi.topup(purchaseDialog.id);
      toast.success(res.data.message);
      setPurchaseDialog(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка покупки');
    } finally {
      setPurchasing(false);
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
              <TabsTrigger value="history" className="gap-2" data-testid="billing-history-tab">
                <History className="w-4 h-4" />
                История
              </TabsTrigger>
              {isSuperadmin() && (
                <TabsTrigger value="all-orgs" className="gap-2" data-testid="billing-all-orgs-tab">
                  <Building2 className="w-4 h-4" />
                  Все организации
                </TabsTrigger>
              )}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="space-y-6">
                {/* Balance Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="md:col-span-2" data-testid="balance-card">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Баланс кредитов</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold tracking-tight" data-testid="credit-balance">
                              {(balance?.balance || 0).toLocaleString('ru-RU')}
                            </span>
                            <span className="text-lg text-muted-foreground">кредитов</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            1 кредит = $0.02 USD
                          </p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                          <Zap className="w-7 h-7 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="quick-stats-card">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground mb-3">Использование за месяц</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">AI-запросов</span>
                          <Badge variant="secondary">{myUsage?.total_requests || 0}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Токенов</span>
                          <span className="text-sm font-medium">
                            {(myUsage?.total_tokens || 0).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Потрачено кредитов</span>
                          <span className="text-sm font-medium">
                            {(myUsage?.total_credits || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {myUsage?.monthly_token_limit > 0 && (
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Лимит токенов</span>
                              <span>{(myUsage.total_tokens || 0).toLocaleString()} / {myUsage.monthly_token_limit.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className="bg-slate-900 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(100, ((myUsage.total_tokens || 0) / myUsage.monthly_token_limit) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
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
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {plans.map(plan => (
                        <div
                          key={plan.id}
                          className="relative border rounded-xl p-5 hover:border-slate-400 transition-colors group"
                          data-testid={`plan-card-${plan.id}`}
                        >
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold">{plan.credits.toLocaleString('ru-RU')} кредитов</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">{plan.name}</p>
                          </div>
                          <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-3xl font-bold">${plan.price_usd}</span>
                            <span className="text-sm text-muted-foreground">/мес</span>
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
                      {plans.length === 0 && (
                        <p className="text-muted-foreground col-span-full text-center py-8">
                          Тарифные планы не найдены
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Последние операции</CardTitle>
                      {transactions.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('history')}
                          className="text-xs"
                        >
                          Все операции
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {transactions.length > 0 ? (
                      <div className="space-y-2">
                        {transactions.slice(0, 5).map(txn => (
                          <div
                            key={txn.id}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                            data-testid={`recent-txn-${txn.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                txn.type === 'topup' ? 'bg-emerald-50' : 'bg-red-50'
                              }`}>
                                {txn.type === 'topup' ? (
                                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{txn.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(txn.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                                </p>
                              </div>
                            </div>
                            <span className={`font-semibold tabular-nums ${
                              txn.type === 'topup' ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {txn.type === 'topup' ? '+' : '-'}{txn.amount.toLocaleString('ru-RU')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8 text-sm">
                        Операций пока нет
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* History Tab */}
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
                              <Badge
                                className={txn.type === 'topup'
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-red-100 text-red-700 hover:bg-red-100'}
                              >
                                {txn.type === 'topup' ? 'Пополнение' : 'Списание'}
                              </Badge>
                            </TableCell>
                            <TableCell>{txn.description}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {txn.user_name || '—'}
                            </TableCell>
                            <TableCell className={`text-right font-semibold tabular-nums ${
                              txn.type === 'topup' ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {txn.type === 'topup' ? '+' : '-'}{txn.amount.toLocaleString('ru-RU')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-12 text-sm">
                      Операций пока нет. Пополните баланс, чтобы начать использовать AI-функции.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Superadmin: All Organizations */}
            {isSuperadmin() && (
              <TabsContent value="all-orgs">
                <Card>
                  <CardHeader>
                    <CardTitle>Балансы организаций</CardTitle>
                    <CardDescription>Общий обзор кредитов по всем организациям</CardDescription>
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
                            <TableRow key={b.org_id} data-testid={`admin-balance-${b.org_id}`}>
                              <TableCell className="font-medium">{b.org_name}</TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {b.balance.toLocaleString('ru-RU')}
                              </TableCell>
                              <TableCell className="text-right text-emerald-600 tabular-nums">
                                +{b.total_topups.toLocaleString('ru-RU')}
                              </TableCell>
                              <TableCell className="text-right text-red-600 tabular-nums">
                                -{b.total_deductions.toLocaleString('ru-RU')}
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {format(new Date(b.updated_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-12 text-sm">
                        Нет данных
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </main>

        {/* Purchase Dialog */}
        <Dialog open={!!purchaseDialog} onOpenChange={() => setPurchaseDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Подтверждение покупки</DialogTitle>
              <DialogDescription>
                Мок-оплата: деньги не списываются
              </DialogDescription>
            </DialogHeader>
            {purchaseDialog && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">План</span>
                    <span className="font-medium">{purchaseDialog.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Кредиты</span>
                    <span className="font-semibold text-emerald-600">
                      +{purchaseDialog.credits.toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 mt-2">
                    <span className="text-sm font-medium">К оплате</span>
                    <span className="text-lg font-bold">${purchaseDialog.price_usd}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Это демо-режим. Кредиты будут начислены без реальной оплаты.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurchaseDialog(null)}>
                Отмена
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={purchasing}
                data-testid="confirm-purchase-btn"
                className="gap-2"
              >
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Оплатить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
