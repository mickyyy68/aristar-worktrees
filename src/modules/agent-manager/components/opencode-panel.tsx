'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, ScrollArea, Separator } from '@core/ui';
import { useAppStore } from '@/store/use-app-store';
import { X, Send, Loader2, Bot, User } from 'lucide-react';

export function OpenCodePanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { opencode } = useAppStore();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [opencode.messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || opencode.isLoading) return;

    const prompt = input.trim();
    setInput('');

    try {
      await opencode.sendToOpencode(prompt);
    } catch (err) {
      console.error('[OpenCodePanel] Error sending prompt:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!opencode.isOpencodePanelOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[500px] h-[600px] bg-background border border-border rounded-lg shadow-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-medium">OpenCode</span>
          {opencode.activeWorktreePath && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {opencode.activeWorktreePath.split('/').pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {opencode.isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={() => opencode.closeOpencodePanel()}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {opencode.error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {opencode.error}
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        {opencode.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm mb-2">Start a conversation with OpenCode</p>
            <p className="text-xs opacity-75">
              Ask about your code, get help with bugs, or request features
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {opencode.messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-primary/10'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-primary/10'
                      : 'bg-muted'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {opencode.isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <Separator />

      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask OpenCode something..."
            disabled={!opencode.isConnected || opencode.isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!opencode.isConnected || opencode.isLoading || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
