import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }
    if (password !== confirm) {
      toast.error('Пароли не совпадают');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API}/auth/reset-password`, { token, password });
      setSuccess(true);
      toast.success('Пароль успешно изменён!');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Ошибка сброса пароля';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold tracking-tight" data-testid="reset-success-title">Пароль изменён</h2>
            <p className="text-sm text-muted-foreground">Теперь вы можете войти с новым паролем</p>
            <Button onClick={() => navigate('/login')} className="rounded-full h-11 w-full" data-testid="reset-go-login-btn">
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-slate-600" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Новый пароль</CardTitle>
          <CardDescription>Введите новый пароль для вашего аккаунта</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <Input
                id="new-password"
                data-testid="reset-password-input"
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Подтвердите пароль</Label>
              <Input
                id="confirm-password"
                data-testid="reset-password-confirm-input"
                type="password"
                placeholder="Повторите пароль"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm" data-testid="reset-error-msg">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button
              type="submit"
              data-testid="reset-submit-btn"
              className="w-full rounded-full h-11"
              disabled={loading}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Сохранение...</> : 'Сохранить новый пароль'}
            </Button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-slate-900 transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Вернуться ко входу
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
