import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Upload, FileAudio, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectsApi } from '../../lib/api';
import { languageOptions, reasoningEffortOptions } from './utils';

export function UploadSection({ projectId, onUploadStart }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('ru');
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState('high');

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      await handleUpload(files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file);
    }
  };

  const handleUpload = async (file) => {
    const allowedTypes = ['audio/', 'video/'];
    if (!allowedTypes.some(type => file.type.startsWith(type))) {
      toast.error('Поддерживаются только аудио и видео файлы');
      return;
    }

    setUploading(true);
    try {
      await projectsApi.upload(projectId, file, selectedLanguage, selectedReasoningEffort);
      toast.success('Файл загружен, начинается транскрибация');
      onUploadStart?.();
    } catch (error) {
      toast.error('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Загрузите запись встречи
        </CardTitle>
        <CardDescription>
          Поддерживаются форматы: MP3, WAV, MP4, WEBM и другие аудио/видео файлы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Settings Row */}
        <div className="flex flex-wrap items-center gap-6">
          {/* Language Selection */}
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap text-sm">Язык:</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-40" data-testid="language-select">
                <SelectValue placeholder="Выберите язык" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reasoning Effort Selection */}
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap text-sm">Режим GPT-5.2:</Label>
            <Select value={selectedReasoningEffort} onValueChange={setSelectedReasoningEffort}>
              <SelectTrigger className="w-48" data-testid="reasoning-select">
                <SelectValue placeholder="Выберите режим" />
              </SelectTrigger>
              <SelectContent>
                {reasoningEffortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dropzone */}
        <div
          className={`dropzone border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            dragActive ? 'active border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="file-dropzone"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileAudio className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium mb-2">
            Перетащите файл сюда или{' '}
            <label className="text-indigo-600 hover:text-indigo-700 cursor-pointer">
              выберите вручную
              <input
                type="file"
                className="hidden"
                accept="audio/*,video/*"
                onChange={handleFileSelect}
                disabled={uploading}
                data-testid="file-input"
              />
            </label>
          </p>
          <p className="text-sm text-muted-foreground">Максимальный размер: 500MB</p>
          {uploading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Загрузка...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
