import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { seedData } from '../lib/api';
import {
  Mic,
  FileText,
  Workflow,
  Upload,
  Sparkles,
  Download,
  Users,
  ArrowRight,
  ChevronRight,
  Zap,
  Share2,
  Bot,
  SlidersHorizontal,
  Image,
  BrainCircuit,
  Check,
} from 'lucide-react';

/* ─── Scroll-reveal hook ─── */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/* ─── Section wrapper ─── */
function Section({ children, className = '', id }) {
  const [ref, visible] = useReveal();
  return (
    <section
      ref={ref}
      id={id}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ email: '', password: '', name: '', organizationName: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success('Добро пожаловать!');
      navigate('/meetings');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка входа');
    } finally { setIsLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(registerData.email, registerData.password, registerData.name, registerData.organizationName);
      try { await seedData(); } catch {}
      toast.success('Регистрация успешна!');
      navigate('/meetings');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка регистрации');
    } finally { setIsLoading(false); }
  };

  const openRegister = () => { setAuthTab('register'); setShowAuth(true); };
  const openLogin = () => { setAuthTab('login'); setShowAuth(true); };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden" style={{ fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>

      {/* ═══════ NAV ═══════ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <img src="/logo-noteall.png" alt="Noteall" className="h-8" />
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Возможности</a>
            <a href="#how" className="hover:text-white transition-colors">Как работает</a>
            <a href="#constructor" className="hover:text-white transition-colors">Конструктор</a>
            <a href="#pricing" className="hover:text-white transition-colors">Тарифы</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={openLogin} data-testid="nav-login-btn">
              Войти
            </Button>
            <Button size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-full px-5" onClick={openRegister} data-testid="nav-register-btn">
              Начать бесплатно
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <header className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        {/* bg glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-60 -left-40 w-[400px] h-[400px] bg-indigo-500/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-sm font-medium">
            <Zap className="w-3.5 h-3.5" /> AI-платформа нового поколения
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6" data-testid="hero-title">
            Полное извлечение смыслов
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-300">
              из встреч и документов
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed mb-10">
            Загрузите запись встречи или документы — получите структурированный анализ без потерь, адаптированный под ваши задачи. Больше не нужно переслушивать или перечитывать.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-full h-12 px-8 text-base"
              onClick={openRegister}
              data-testid="hero-cta-btn"
            >
              Начать бесплатно <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="text-slate-300 hover:text-white rounded-full h-12 px-8 text-base border border-white/10"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Узнать больше
            </Button>
          </div>
        </div>

        {/* hero screenshot */}
        <div className="relative max-w-5xl mx-auto mt-16 md:mt-20">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
          <div className="rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-cyan-500/5">
            <img
              src="/screenshots/pipeline-editor.png"
              alt="Pipeline Editor"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </header>

      {/* ═══════ KEY DIFFERENTIATOR ═══════ */}
      <Section className="py-20 md:py-28 px-6" id="differentiator">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Ключевое отличие</h2>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-6">
            Это не сервис транскрибации.
            <br />
            Это инструмент <span className="text-cyan-400">извлечения смыслов</span>.
          </p>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            На выходе — не стенограмма, а полное саммари без потерь в удобном структурированном виде. Вы сами определяете подробность, акценты и любые параметры анализа под свои задачи.
          </p>
        </div>
      </Section>

      {/* ═══════ FEATURES ═══════ */}
      <Section className="py-20 md:py-28 px-6" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Возможности</h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">Три главных инструмента</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1: Meetings */}
            <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 hover:border-cyan-500/20 hover:bg-white/[0.04] transition-all duration-300" data-testid="feature-meetings">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-6">
                <Mic className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Анализ встреч</h3>
              <p className="text-slate-400 leading-relaxed">
                Загрузите аудиозапись — получите полную замену необходимости слушать. Подробность, акценты, формат результата — всё настраивается.
              </p>
            </div>

            {/* Card 2: Documents */}
            <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300" data-testid="feature-documents">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Анализ документов</h3>
              <p className="text-slate-400 leading-relaxed">
                Совместный анализ разнотипных документов — тексты любых форматов и изображения. Конвейерная обработка по вашим сценариям.
              </p>
            </div>

            {/* Card 3: Constructor */}
            <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all duration-300" data-testid="feature-constructor">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <Workflow className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Конструктор сценариев</h3>
              <p className="text-slate-400 leading-relaxed">
                Создавайте свои сценарии обработки с помощью AI-ассистента. Экспортируйте и обменивайтесь готовыми сценариями с коллегами.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <Section className="py-20 md:py-28 px-6" id="how">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Как это работает</h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">Три простых шага</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center" data-testid="step-1">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-7 h-7 text-cyan-400" />
              </div>
              <div className="text-cyan-400 text-sm font-bold mb-2">01</div>
              <h3 className="text-lg font-semibold mb-2">Загрузите файлы</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Аудиозаписи, PDF, DOCX, изображения — любой формат</p>
            </div>

            <div className="text-center" data-testid="step-2">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                <SlidersHorizontal className="w-7 h-7 text-indigo-400" />
              </div>
              <div className="text-indigo-400 text-sm font-bold mb-2">02</div>
              <h3 className="text-lg font-semibold mb-2">Выберите сценарий</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Готовый или создайте свой через конструктор с AI-ассистентом</p>
            </div>

            <div className="text-center" data-testid="step-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Download className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-emerald-400 text-sm font-bold mb-2">03</div>
              <h3 className="text-lg font-semibold mb-2">Получите результат</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Структурированный анализ — экспортируйте в Word, PDF или сохраните</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════ CONSTRUCTOR DEEP DIVE ═══════ */}
      <Section className="py-20 md:py-28 px-6" id="constructor">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Конструктор сценариев</h2>
              <p className="text-2xl sm:text-3xl font-bold mb-6 leading-tight">
                Создайте свой сценарий анализа за минуты
              </p>
              <p className="text-slate-400 leading-relaxed mb-8">
                Визуальный drag-and-drop конструктор позволяет собирать конвейеры обработки из готовых блоков. AI-ассистент поможет спроектировать сценарий по вашему описанию.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Bot, text: 'AI-ассистент для создания сценариев', color: 'text-cyan-400' },
                  { icon: Sparkles, text: 'AI-анализ, парсинг, батч-обработка, ревью', color: 'text-indigo-400' },
                  { icon: SlidersHorizontal, text: 'Полный контроль: подробность, акценты, формат', color: 'text-emerald-400' },
                  { icon: Share2, text: 'Импорт/экспорт — обменивайтесь сценариями', color: 'text-amber-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <span className="text-slate-300 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-cyan-500/5">
              <img src="/screenshots/constructor.png" alt="Constructor" className="w-full" loading="lazy" />
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════ DOCUMENT ANALYSIS ═══════ */}
      <Section className="py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Работа с документами</h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold">Анализ любых форматов</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: FileText, label: 'PDF и DOCX', desc: 'Текстовые документы', color: 'cyan' },
              { icon: Image, label: 'Изображения', desc: 'Фото и сканы', color: 'indigo' },
              { icon: Mic, label: 'Аудиозаписи', desc: 'Встречи и звонки', color: 'emerald' },
              { icon: BrainCircuit, label: 'Совместный анализ', desc: 'Разнотипные данные', color: 'amber' },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center hover:border-${item.color}-500/20 transition-all duration-300`}>
                <div className={`w-11 h-11 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mx-auto mb-4`}>
                  <item.icon className={`w-5 h-5 text-${item.color}-400`} />
                </div>
                <h4 className="font-semibold mb-1">{item.label}</h4>
                <p className="text-slate-500 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══════ TEAM ═══════ */}
      <Section className="py-20 md:py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Команда</h2>
          <p className="text-2xl sm:text-3xl font-bold mb-6">Работайте вместе</p>
          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Приглашайте коллег в организацию, управляйте доступом, используйте общий баланс кредитов. Каждый может создавать и запускать сценарии.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            {[
              'Организации и команды',
              'Управление доступом',
              'Общий баланс',
              'Совместные сценарии',
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.02] text-sm text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400" /> {t}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══════ PRICING ═══════ */}
      <Section className="py-20 md:py-28 px-6" id="pricing">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-base md:text-lg font-semibold text-cyan-400 mb-4 tracking-wide uppercase">Тарифы</h2>
          <p className="text-2xl sm:text-3xl font-bold mb-6">Простая кредитная модель</p>
          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
            Платите только за AI-вызовы. Получите приветственный бонус при регистрации и начните работать сразу.
          </p>

          <div className="max-w-sm mx-auto rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-8">
            <div className="text-cyan-400 font-semibold text-sm mb-2">Старт</div>
            <div className="text-4xl font-bold mb-2">Бесплатно</div>
            <p className="text-slate-400 text-sm mb-6">Приветственный бонус кредитов при регистрации</p>
            <ul className="text-left space-y-3 mb-8">
              {[
                'Транскрибация и анализ встреч',
                'Анализ документов и изображений',
                'Конструктор сценариев',
                'AI-ассистент',
                'Экспорт результатов',
              ].map((t, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" /> {t}
                </li>
              ))}
            </ul>
            <Button
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-full h-11"
              onClick={openRegister}
              data-testid="pricing-cta-btn"
            >
              Начать бесплатно
            </Button>
          </div>
        </div>
      </Section>

      {/* ═══════ FINAL CTA ═══════ */}
      <Section className="py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6">
            Готовы извлечь максимум из своих данных?
          </p>
          <p className="text-slate-400 text-lg mb-8">
            Начните бесплатно — без ограничений по функциям.
          </p>
          <Button
            size="lg"
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-full h-12 px-8 text-base"
            onClick={openRegister}
            data-testid="final-cta-btn"
          >
            Создать аккаунт <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/logo-noteall.png" alt="Noteall" className="h-6 opacity-60" />
          <p className="text-slate-500 text-sm">&copy; 2026 Noteall. Все права защищены.</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <button onClick={openLogin} className="hover:text-white transition-colors">Войти</button>
            <button onClick={openRegister} className="hover:text-white transition-colors">Регистрация</button>
          </div>
        </div>
      </footer>

      {/* ═══════ AUTH MODAL ═══════ */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAuth(false)} />
          <Card className="relative w-full max-w-md shadow-2xl border-0 bg-white z-10" data-testid="auth-modal">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl leading-none"
              onClick={() => setShowAuth(false)}
              data-testid="auth-modal-close"
            >
              &times;
            </button>
            <CardContent className="pt-8 pb-6 px-6">
              <div className="text-center mb-6">
                <img src="/logo-noteall.png" alt="Noteall" className="h-8 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Войдите или создайте аккаунт</p>
              </div>
              <Tabs value={authTab} onValueChange={setAuthTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="login-tab">Вход</TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">Регистрация</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" data-testid="login-email-input" type="email" placeholder="email@example.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Пароль</Label>
                      <Input id="login-password" data-testid="login-password-input" type="password" placeholder="********" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
                    </div>
                    <Button type="submit" data-testid="login-submit-btn" className="w-full rounded-full h-11" disabled={isLoading}>
                      {isLoading ? 'Вход...' : 'Войти'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Имя</Label>
                      <Input id="register-name" data-testid="register-name-input" type="text" placeholder="Ваше имя" value={registerData.name} onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-org">Организация</Label>
                      <Input id="register-org" data-testid="register-org-input" type="text" placeholder="Название компании (необязательно)" value={registerData.organizationName} onChange={(e) => setRegisterData({ ...registerData, organizationName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input id="register-email" data-testid="register-email-input" type="email" placeholder="email@example.com" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Пароль</Label>
                      <Input id="register-password" data-testid="register-password-input" type="password" placeholder="Минимум 6 символов" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} required minLength={6} />
                    </div>
                    <Button type="submit" data-testid="register-submit-btn" className="w-full rounded-full h-11" disabled={isLoading}>
                      {isLoading ? 'Регистрация...' : 'Создать аккаунт'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
