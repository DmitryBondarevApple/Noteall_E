import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { invitationsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Building2, Loader2, UserPlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function InviteRegisterPage() {
  const { token: inviteToken } = useParams();
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });

  useEffect(() => {
    if (user) {
      navigate('/meetings', { replace: true });
      return;
    }
    validateToken();
  }, [inviteToken]);

  const validateToken = async () => {
    try {
      const res = await invitationsApi.validate(inviteToken);
      setInviteInfo(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid invitation link');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await register(formData.email, formData.password, formData.name, null, inviteToken);
      toast.success('Registration successful! Welcome to the team.');
      navigate('/meetings', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold tracking-tight" data-testid="invite-error-title">Ссылка недействительна</h2>
            <p className="text-muted-foreground text-sm" data-testid="invite-error-message">{error}</p>
            <Button onClick={() => navigate('/')} className="mt-4" data-testid="invite-error-home-btn">
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Invitation info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-slate-800 p-12 flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
            <UserPlus className="w-10 h-10 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-3">
              Вас пригласили присоединиться
            </h1>
            <p className="text-slate-400 text-lg">
              Создайте аккаунт, чтобы начать работу в команде
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Организация</p>
                <p className="text-white text-lg font-semibold" data-testid="invite-org-name">
                  {inviteInfo?.org_name}
                </p>
              </div>
            </div>
            {inviteInfo?.invited_by && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-slate-400 text-sm">
                  Приглашение от: <span className="text-white font-medium">{inviteInfo.invited_by}</span>
                </p>
              </div>
            )}
            {inviteInfo?.note && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-slate-400 text-sm italic">"{inviteInfo.note}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Registration form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg" data-testid="invite-org-name-mobile">{inviteInfo?.org_name}</span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Создать аккаунт</CardTitle>
            <CardDescription>
              Зарегистрируйтесь для работы в организации «{inviteInfo?.org_name}»
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Имя</Label>
                <Input
                  id="invite-name"
                  data-testid="invite-register-name-input"
                  type="text"
                  placeholder="Ваше имя"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  data-testid="invite-register-email-input"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password">Пароль</Label>
                <Input
                  id="invite-password"
                  data-testid="invite-register-password-input"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border text-sm text-muted-foreground">
                Вы будете добавлены в организацию «<span className="font-medium text-slate-700">{inviteInfo?.org_name}</span>» и сможете сразу начать работу.
              </div>

              <Button
                type="submit"
                data-testid="invite-register-submit-btn"
                className="w-full rounded-full h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Регистрация...
                  </>
                ) : (
                  'Присоединиться к команде'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
