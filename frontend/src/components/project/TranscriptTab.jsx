import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { FileText, Loader2 } from 'lucide-react';
import { applySpeakerNames } from './utils';

export function TranscriptTab({ transcript, speakers }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Исходный транскрипт</CardTitle>
          <CardDescription>
            Результат распознавания от Deepgram (без обработки)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {transcript ? (
          <ScrollArea className="h-[500px] rounded-lg border p-6 bg-white">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans" data-testid="raw-transcript-content">
              {applySpeakerNames(transcript.content, speakers)}
            </pre>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Транскрибация в процессе...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
