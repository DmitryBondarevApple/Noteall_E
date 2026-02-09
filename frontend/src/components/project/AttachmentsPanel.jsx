import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import {
  Paperclip,
  Upload,
  Link2,
  Trash2,
  FileText,
  Image,
  File,
  Globe,
  Loader2,
  Plus,
  X,
  Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { attachmentsApi } from '../../lib/api';

const TYPE_ICONS = {
  text: FileText,
  pdf: File,
  image: Image,
  url: Globe,
  zip: Archive,
};

const TYPE_COLORS = {
  text: 'bg-blue-50 text-blue-600 border-blue-200',
  pdf: 'bg-red-50 text-red-600 border-red-200',
  image: 'bg-purple-50 text-purple-600 border-purple-200',
  url: 'bg-teal-50 text-teal-600 border-teal-200',
  zip: 'bg-amber-50 text-amber-600 border-amber-200',
};

export function AttachmentsPanel({ projectId, selectedIds, onSelectionChange, compact = false }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlName, setUrlName] = useState('');
  const fileInputRef = useRef(null);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await attachmentsApi.list(projectId);
      setAttachments(res.data);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) {
          toast.error(`${file.name}: превышает 100MB`);
          continue;
        }
        await attachmentsApi.upload(projectId, file);
        toast.success(`${file.name} загружен`);
      }
      await loadAttachments();
    } catch (err) {
      toast.error('Ошибка загрузки: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = async () => {
    if (!urlValue.trim()) return;
    try {
      await attachmentsApi.addUrl(projectId, urlValue.trim(), urlName.trim() || undefined);
      setUrlValue('');
      setUrlName('');
      setShowUrlInput(false);
      await loadAttachments();
      toast.success('Ссылка добавлена');
    } catch (err) {
      toast.error('Ошибка: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (id) => {
    try {
      await attachmentsApi.delete(projectId, id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      onSelectionChange?.(new Set([...selectedIds].filter((sid) => sid !== id)));
      toast.success('Удалено');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  };

  const selectAll = () => {
    if (selectedIds.size === attachments.length) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(attachments.map((a) => a.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Загрузка вложений...
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="attachments-panel">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Вложения {attachments.length > 0 && `(${attachments.length})`}
          </span>
          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              выбрано: {selectedIds.size}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.csv,.md,.png,.jpg,.jpeg,.webp,.gif,.zip"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="file-input"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5 h-7 text-xs"
            data-testid="upload-file-btn"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Файл
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="gap-1.5 h-7 text-xs"
            data-testid="add-url-btn"
          >
            <Link2 className="w-3.5 h-3.5" />
            Ссылка
          </Button>
        </div>
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
          <Input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://..."
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            data-testid="url-input"
          />
          <Input
            value={urlName}
            onChange={(e) => setUrlName(e.target.value)}
            placeholder="Название (необяз.)"
            className="h-7 text-xs w-[150px]"
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleAddUrl} disabled={!urlValue.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowUrlInput(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {onSelectionChange && attachments.length > 1 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={selectedIds.size === attachments.length}
                onCheckedChange={selectAll}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px] text-muted-foreground">Выбрать все</span>
            </div>
          )}

          {attachments.map((att) => {
            const Icon = TYPE_ICONS[att.file_type] || File;
            const colorClass = TYPE_COLORS[att.file_type] || 'bg-slate-50 text-slate-600 border-slate-200';

            return (
              <div
                key={att.id}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border transition-colors ${
                  selectedIds.has(att.id) ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'
                }`}
                data-testid={`attachment-${att.id}`}
              >
                {onSelectionChange && (
                  <Checkbox
                    checked={selectedIds.has(att.id)}
                    onCheckedChange={() => toggleSelect(att.id)}
                    className="h-3.5 w-3.5"
                  />
                )}
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{att.name}</p>
                  {att.size && (
                    <p className="text-[10px] text-muted-foreground">{formatSize(att.size)}</p>
                  )}
                  {att.source_url && (
                    <p className="text-[10px] text-muted-foreground truncate">{att.source_url}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-400 hover:text-red-600 shrink-0"
                  onClick={() => handleDelete(att.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && !showUrlInput && (
        <p className="text-xs text-muted-foreground italic py-1">
          Нет вложений. Загрузите файлы или добавьте ссылки для включения в анализ.
        </p>
      )}
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
