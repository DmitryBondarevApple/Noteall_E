import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Mic,
  FileText,
  Blocks,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/meetings', label: 'Встречи', icon: Mic },
  { path: '/documents', label: 'Документы', icon: FileText },
  { path: '/constructor', label: 'Конструктор', icon: Blocks },
];

export default function AppLayout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/meetings') return location.pathname === '/meetings' || location.pathname.startsWith('/projects/') || location.pathname.startsWith('/meetings/');
    if (path === '/documents') return location.pathname === '/documents' || location.pathname.startsWith('/documents/');
    if (path === '/constructor') return location.pathname.startsWith('/constructor') || location.pathname.startsWith('/pipelines');
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
              <span className="font-bold text-sm text-white">N</span>
            ) : (
              <img src="/logo-noteall.png" alt="Noteall" className="h-5" />
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
          </nav>

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
                    'w-full flex items-center gap-2.5 rounded-lg text-sm h-9 transition-colors text-slate-300 hover:bg-slate-800',
                    collapsed ? 'justify-center px-0' : 'px-3'
                  )}
                  data-testid="user-menu-btn"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium">{user?.name?.[0]?.toUpperCase()}</span>
                  </div>
                  {!collapsed && <span className="truncate text-xs">{user?.name}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuItem className="text-muted-foreground text-xs">
                  {user?.email}
                </DropdownMenuItem>
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
