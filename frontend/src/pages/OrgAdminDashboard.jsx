import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Building2, Users, History, BarChart3, Loader2, Zap,
  ArrowUpRight, ArrowDownRight, TrendingUp, Hash, DollarSign,
  ArrowLeft, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  KpiCard, CategoryBar, CategoryLegend, PeriodFilter, PIE_COLORS, ROLE_LABELS,
} from '../components/analytics/AnalyticsWidgets';

export default function OrgAdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [tab, setTab] = useState('stats');

  const loadData = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await billingApi.orgMyAnalytics(p);
      setData(res.data);
    } catch {
      toast.error('Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(period); }, [period, loadData]);

  const fmtNum = (n, d = 0) => n.toLocaleString('ru-RU', { maximumFractionDigits: d });

  const expenses = data?.expenses_by_category || {};
  const totalExpenses = (expenses.transcription || 0) + (expenses.analysis || 0) + (expenses.storage || 0) + (expenses.other || 0);

  const pieData = data ? [
    { name: 'Транскрибация', value: expenses.transcription || 0 },
    { name: 'Анализ (AI)', value: expenses.analysis || 0 },
    { name: 'Хранение', value: expenses.storage || 0 },
  ].filter(d => d.value > 0) : [];

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} data-testid="org-analytics-back-btn">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Building2 className="w-5 h-5 text-slate-400" />
              <div>
                <h1 className="text-lg font-bold tracking-tight" data-testid="org-analytics-name">
                  {data?.org?.name || 'Аналитика организации'}
                </h1>
                {data?.org?.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Создана: {format(new Date(data.org.created_at), 'dd MMMM yyyy', { locale: ru })}
                  </p>
                )}
              </div>
            </div>
            <PeriodFilter period={period} onPeriodChange={setPeriod} />
          </div>
        </header>

        {loading && !data ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="org-analytics-kpi-cards">
              <KpiCard label="Баланс" value={fmtNum(data.balance)} sub="кредитов" icon={Zap} color="text-emerald-600" />
              <KpiCard label="Всего оплачено" value={fmtNum(data.total_topups)} sub="кредитов" icon={TrendingUp} />
              <KpiCard label="Потрачено за период" value={fmtNum(totalExpenses, 2)} sub={`${data.total_requests} запросов`} icon={DollarSign} />
              <KpiCard label="Ср. расход/мес" value={fmtNum(data.avg_monthly_spend, 2)} sub="кредитов" icon={Calendar} />
              <KpiCard label="AI-запросов" value={fmtNum(data.total_requests)} sub={`${fmtNum(data.total_tokens)} токенов`} icon={Hash} />
            </div>

            {/* Category breakdown bar */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Расходы по категориям</span>
                  <span className="text-xs text-muted-foreground">{fmtNum(totalExpenses, 2)} кр. за период</span>
                </div>
                <CategoryBar
                  transcription={expenses.transcription || 0}
                  analysis={expenses.analysis || 0}
                  storage={expenses.storage || 0}
                />
                <CategoryLegend expenses={expenses} fmtNum={fmtNum} />
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="stats" className="gap-1.5" data-testid="org-analytics-tab-stats">
                  <BarChart3 className="w-3.5 h-3.5" /> Динамика
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1.5" data-testid="org-analytics-tab-users">
                  <Users className="w-3.5 h-3.5" /> Пользователи
                </TabsTrigger>
                <TabsTrigger value="txns" className="gap-1.5" data-testid="org-analytics-tab-txns">
                  <History className="w-3.5 h-3.5" /> Транзакции
                </TabsTrigger>
              </TabsList>

              {/* Stats / Chart tab */}
              <TabsContent value="stats" className="space-y-6 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Area chart */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Динамика расходов (по дням)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.daily_chart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart data={data.daily_chart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fontSize: 10 }} width={45} />
                            <RechartsTooltip
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              labelFormatter={v => `Дата: ${v}`}
                              formatter={(v, name) => {
                                const labels = { transcription: 'Транскрибация', analysis: 'Анализ', storage: 'Хранение' };
                                return [v.toFixed(2) + ' кр.', labels[name] || name];
                              }}
                            />
                            <Area type="monotone" dataKey="transcription" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="analysis" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="storage" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                          Нет данных за выбранный период
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pie chart */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Структура расходов</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Legend
                              iconSize={8}
                              wrapperStyle={{ fontSize: 11 }}
                              formatter={(value, entry) => `${value}: ${entry.payload.value.toFixed(2)} кр.`}
                            />
                            <RechartsTooltip formatter={(v) => v.toFixed(2) + ' кр.'} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                          Нет расходов
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Top users */}
                {data.top_users.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Топ пользователей по расходам</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.top_users.map((u, i) => {
                          const max = data.top_users[0].credits || 1;
                          return (
                            <div key={u.user_id} className="flex items-center gap-3" data-testid={`org-analytics-top-user-${i}`}>
                              <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}.</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-sm font-medium">{u.name}</span>
                                  <span className="text-xs tabular-nums">{fmtNum(u.credits, 2)} кр. / {fmtNum(u.requests)} запр.</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-slate-700 h-1.5 rounded-full" style={{ width: `${(u.credits / max) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Users tab */}
              <TabsContent value="users" className="mt-4">
                <Card>
                  <CardContent className="pt-4">
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
                          <TableRow key={u.id} data-testid={`org-analytics-user-${u.id}`}>
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Transactions tab */}
              <TabsContent value="txns" className="mt-4">
                <Card>
                  <CardContent className="pt-4">
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
                            <TableCell className="text-sm max-w-xs truncate">{txn.description}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{txn.user_name || '—'}</TableCell>
                            <TableCell className={`text-right font-medium tabular-nums text-sm ${txn.type === 'topup' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {txn.type === 'topup' ? '+' : '-'}{fmtNum(txn.amount, 4)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {data.transactions.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет транзакций за период</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        ) : null}
      </div>
    </AppLayout>
  );
}
