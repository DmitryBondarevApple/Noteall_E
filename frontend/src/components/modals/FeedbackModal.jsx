import React, { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Loader2, Send, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function FeedbackModal({ open, onOpenChange }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Введите текст предложения');
      return;
    }

    const shouldScreenshot = includeScreenshot;
    const feedbackText = text.trim();
    const feedbackTelegram = telegram.trim();
    const feedbackEmail = email.trim() || user?.email || '';

    // Close modal first
    onOpenChange(false);

    // Wait for modal to fully close before capturing screenshot
    await new Promise(r => setTimeout(r, 400));

    let screenshotBlob = null;
    if (shouldScreenshot) {
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
    }

    // Show sending overlay only AFTER screenshot is taken
    setSending(true);

    try {
      const formData = new FormData();
      formData.append('text', feedbackText);
      if (feedbackTelegram) formData.append('telegram', feedbackTelegram);
      formData.append('email', feedbackEmail);
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
        setIncludeScreenshot(true);
      } else {
        toast.error(resp.data.error || 'Ошибка при отправке');
      }
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error('Не удалось отправить предложение');
    } finally {
      setSending(false);
    }
  }, [text, telegram, email, includeScreenshot, user, onOpenChange]);

  return (
    <>
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
            <DialogDescription className="sr-only">Форма обратной связи</DialogDescription>
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

            <div className="flex items-center gap-2">
              <Checkbox
                id="feedback-screenshot"
                data-testid="feedback-screenshot-checkbox"
                checked={includeScreenshot}
                onCheckedChange={setIncludeScreenshot}
              />
              <label
                htmlFor="feedback-screenshot"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                При отправке сделать скриншот текущей страницы
              </label>
            </div>

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
