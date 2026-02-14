import React, { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Loader2, Send, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function FeedbackModal({ open, onOpenChange }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Введите текст предложения');
      return;
    }

    setSending(true);
    onOpenChange(false);

    try {
      // Small delay to let modal close before taking screenshot
      await new Promise(r => setTimeout(r, 300));

      let screenshotBlob = null;
      try {
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          scale: 0.7,
          logging: false,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
        });
        screenshotBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.8));
      } catch (e) {
        console.warn('Screenshot capture failed:', e);
      }

      const formData = new FormData();
      formData.append('text', text.trim());
      if (telegram.trim()) formData.append('telegram', telegram.trim());
      formData.append('email', email.trim() || user?.email || '');
      if (screenshotBlob) {
        formData.append('screenshot', screenshotBlob, 'screenshot.png');
      }

      const resp = await axios.post(`${API}/feedback/suggest`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (resp.data.success) {
        toast.success('Спасибо! Ваше предложение отправлено');
        setText('');
        setTelegram('');
        setEmail(user?.email || '');
      } else {
        toast.error(resp.data.error || 'Ошибка при отправке');
      }
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error('Не удалось отправить предложение');
    } finally {
      setSending(false);
    }
  }, [text, telegram, email, user, onOpenChange]);

  return (
    <>
      {/* Global sending overlay */}
      {sending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex items-center gap-3 bg-white rounded-xl px-6 py-4 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-sm font-medium text-slate-700">Отправка...</span>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="feedback-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-indigo-500" />
              Предложить улучшение
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-text">Ваше предложение *</Label>
              <Textarea
                id="feedback-text"
                data-testid="feedback-text-input"
                placeholder="Опишите, что можно улучшить..."
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-email">Email</Label>
              <Input
                id="feedback-email"
                data-testid="feedback-email-input"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-telegram">Telegram</Label>
              <Input
                id="feedback-telegram"
                data-testid="feedback-telegram-input"
                placeholder="@username"
                value={telegram}
                onChange={e => setTelegram(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              При отправке будет сделан скриншот текущей страницы
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="feedback-cancel-btn"
              >
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!text.trim()}
                data-testid="feedback-submit-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                Отправить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
