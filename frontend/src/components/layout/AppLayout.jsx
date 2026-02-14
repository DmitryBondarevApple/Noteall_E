import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { billingApi } from '../../lib/api';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  FileText,
  Blocks,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  CalendarDays,
  CreditCard,
  Zap,
  MessageSquarePlus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import FeedbackModal from '../modals/FeedbackModal';

const navItems = [
  { path: '/meetings', label: 'Встречи', icon: CalendarDays },
  { path: '/documents', label: 'Документы', icon: FileText },
  { path: '/constructor', label: 'Конструктор', icon: Blocks },
];

export default function AppLayout({ children }) {
  const { user, logout, isAdmin, isOrgAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [creditInfo, setCreditInfo] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [balRes, usageRes] = await Promise.all([
          billingApi.getBalance().catch(() => ({ data: null })),
          billingApi.getMyUsage().catch(() => ({ data: null })),
        ]);
        const bal = balRes.data;
        const usage = usageRes.data;
        const isAdminRole = ['org_admin', 'superadmin'].includes(user?.role);
        const limit = usage?.monthly_token_limit || 0;

        if (isAdminRole) {
          setCreditInfo({ value: bal?.balance || 0, label: 'кредитов', type: 'org' });
        } else if (limit > 0) {
          const remaining = Math.max(0, limit - (usage?.total_tokens || 0));
          setCreditInfo({ value: remaining, label: 'токенов', type: 'limit', total: limit });
        } else {
          setCreditInfo({ value: bal?.balance || 0, label: 'кредитов', type: 'org' });
        }
      } catch {}
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/meetings') return location.pathname === '/meetings' || location.pathname.startsWith('/projects/') || location.pathname.startsWith('/meetings/');
    if (path === '/documents') return location.pathname === '/documents' || location.pathname.startsWith('/documents/');
    if (path === '/constructor') return location.pathname.startsWith('/constructor') || location.pathname.startsWith('/pipelines');
    if (path === '/billing') return location.pathname === '/billing';
    return location.pathname === path;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed left-0 top-0 h-screen bg-slate-900 text-white flex flex-col z-50 transition-all duration-200',
            collapsed ? 'w-16' : 'w-56'
          )}
          data-testid="app-sidebar"
        >
          {/* Logo */}
          <div className={cn('flex items-center h-14 px-3 border-b border-slate-700/50', collapsed ? 'justify-center' : 'gap-2.5')}>
            {collapsed ? (
              <span className="font-semibold text-lg text-white">N<span className="text-cyan-400">*</span></span>
            ) : (
              <span className="font-semibold text-xl text-white tracking-tight">note<span className="relative inline-block">a<span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-cyan-400 text-xs">&#10022;</span></span>ll</span>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              const btn = (
                <Link to={item.path} key={item.path}>
                  <button
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors h-9',
                      collapsed ? 'justify-center px-0' : 'px-3',
                      active
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}
                    data-testid={`nav-${item.path.replace('/', '')}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                </Link>
              );
              if (collapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return btn;
            })}

            {isAdmin() && (
              <>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/admin">
                        <button
                          className={cn(
                            'w-full flex items-center justify-center rounded-lg text-sm font-medium h-9 transition-colors',
                            isActive('/admin') ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          )}
                          data-testid="nav-admin"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">Админ</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link to="/admin">
                    <button
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 rounded-lg text-sm font-medium h-9 transition-colors',
                        isActive('/admin') ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      )}
                      data-testid="nav-admin"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Админ</span>
                    </button>
                  </Link>
                )}
              </>
            )}

            {isOrgAdmin() && (
              <>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/billing">
                        <button
                          className={cn(
                            'w-full flex items-center justify-center rounded-lg text-sm font-medium h-9 transition-colors',
                            isActive('/billing') ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          )}
                          data-testid="nav-billing"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">Биллинг</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link to="/billing">
                    <button
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 rounded-lg text-sm font-medium h-9 transition-colors',
                        isActive('/billing') ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      )}
                      data-testid="nav-billing"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Биллинг</span>
                    </button>
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Credit Balance Widget */}
          {creditInfo && (
            <div className={cn('px-2 pb-2', collapsed ? 'px-1' : 'px-2')}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/billing">
                      <div className="flex flex-col items-center py-2 px-1 rounded-lg bg-slate-800/60 cursor-pointer hover:bg-slate-800 transition-colors" data-testid="sidebar-credit-widget">
                        <Zap className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                        <span className="text-[10px] font-bold text-emerald-400 tabular-nums">
                          {creditInfo.value >= 1000
                            ? `${(creditInfo.value / 1000).toFixed(1)}k`
                            : Math.round(creditInfo.value)}
                        </span>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {creditInfo.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} {creditInfo.label}
                    {creditInfo.type === 'limit' && ` из ${creditInfo.total.toLocaleString('ru-RU')}`}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link to="/billing">
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/60 cursor-pointer hover:bg-slate-800 transition-colors" data-testid="sidebar-credit-widget">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-slate-400">
                        {creditInfo.type === 'limit' ? 'Лимит' : 'Баланс'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums" data-testid="sidebar-credit-value">
                      {creditInfo.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                      <span className="text-[10px] font-normal text-slate-500 ml-1">{creditInfo.label}</span>
                    </span>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Bottom section */}
          <div className="border-t border-slate-700/50 p-2 space-y-1">
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 h-9 transition-colors',
                collapsed ? 'justify-center px-0' : 'px-3'
              )}
              data-testid="sidebar-toggle"
            >
              {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              {!collapsed && <span>Свернуть</span>}
            </button>

            {/* User */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors hover:bg-slate-800',
                    collapsed ? 'justify-center px-0 h-9' : 'px-3 py-2'
                  )}
                  data-testid="user-menu-btn"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                  {!collapsed && (
                    <div className="flex flex-col items-start min-w-0">
                      {user?.org_name && (
                        <span className="text-[10px] text-slate-500 truncate w-full" data-testid="sidebar-org-name">{user.org_name}</span>
                      )}
                      <span className="truncate text-xs text-slate-300">{user?.name}</span>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuItem className="text-muted-foreground text-xs">
                  {user?.email}
                </DropdownMenuItem>
                {user?.org_name && (
                  <DropdownMenuItem className="text-muted-foreground text-xs">
                    {user.org_name}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Main content */}
        <main className={cn('flex-1 transition-all duration-200', collapsed ? 'ml-16' : 'ml-56')}>
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
