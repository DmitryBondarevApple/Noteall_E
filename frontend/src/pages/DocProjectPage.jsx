import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { docProjectsApi, docAttachmentsApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  ArrowLeft,
  FileText,
  Upload,
  Link2,
  Trash2,
  Paperclip,
  File,
  Image,
  FileType,
  Globe,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const fileTypeIcons = {
  pdf: FileType,
  image: Image,
  text: FileText,
  url: Globe,
  other: File,
};

export default function DocProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlDialog, setUrlDialog] = useState({ open: false, url: '', name: '' });

  const loadProject = async () => {
    try {
      const res = await docProjectsApi.get(projectId);
      setProject(res.data);
    } catch {
      toast.error('Проект не найден');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [projectId]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        await docAttachmentsApi.upload(projectId, file);
      }
      toast.success(`Загружено файлов: ${files.length}`);
      loadProject();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddUrl = async () => {
    if (!urlDialog.url.trim()) return;
    try {
      await docAttachmentsApi.addUrl(projectId, urlDialog.url, urlDialog.name || null);
      toast.success('Ссылка добавлена');
      setUrlDialog({ open: false, url: '', name: '' });
      loadProject();
    } catch {
      toast.error('Ошибка добавления');
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await docAttachmentsApi.delete(projectId, attachmentId);
      toast.success('Удалено');
      loadProject();
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!project) return null;

  const attachments = project.attachments || [];

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/documents')} data-testid="back-to-documents">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate" data-testid="project-title">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate">{project.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0">
              {project.status === 'draft' ? 'Черновик' : project.status === 'in_progress' ? 'В работе' : 'Готов'}
            </Badge>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Source Materials */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Исходные материалы
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">{attachments.length}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Upload buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      disabled={uploading}
                      onClick={() => document.getElementById('doc-file-input').click()}
                      data-testid="upload-file-btn"
                    >
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Файл
                    </Button>
                    <input
                      id="doc-file-input"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".pdf,.txt,.md,.csv,.docx,.png,.jpg,.jpeg,.webp"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => setUrlDialog({ open: true, url: '', name: '' })}
                      data-testid="add-url-btn"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Ссылка
                    </Button>
                  </div>

                  {/* Attachments list */}
                  {attachments.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Загрузите файлы или добавьте ссылки
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[400px]">
                      <div className="space-y-1">
                        {attachments.map(att => {
                          const Icon = fileTypeIcons[att.file_type] || File;
                          return (
                            <div
                              key={att.id}
                              className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50 transition-colors"
                              data-testid={`attachment-${att.id}`}
                            >
                              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-sm truncate flex-1">{att.name}</span>
                              {att.size && (
                                <span className="text-[10px] text-slate-400">
                                  {(att.size / 1024).toFixed(0)}KB
                                </span>
                              )}
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
                                onClick={() => handleDeleteAttachment(att.id)}
                                data-testid={`delete-attachment-${att.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Analysis Streams (placeholder) */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Потоки анализа</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">Скоро здесь появятся потоки анализа</p>
                    <p className="text-xs">Каждый поток — независимый чат с AI, фокусирующийся на конкретной части документа</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* URL Dialog */}
      <Dialog open={urlDialog.open} onOpenChange={(open) => !open && setUrlDialog({ ...urlDialog, open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить ссылку</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="https://..."
              value={urlDialog.url}
              onChange={(e) => setUrlDialog({ ...urlDialog, url: e.target.value })}
              autoFocus
              data-testid="url-input"
            />
            <Input
              placeholder="Название (опционально)"
              value={urlDialog.name}
              onChange={(e) => setUrlDialog({ ...urlDialog, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
              data-testid="url-name-input"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setUrlDialog({ ...urlDialog, open: false })}>Отмена</Button>
              <Button size="sm" onClick={handleAddUrl} disabled={!urlDialog.url.trim()} data-testid="url-save-btn">Добавить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
