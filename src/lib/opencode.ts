export interface OpenCodeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface OpenCodeSession {
  id: string;
  title?: string;
  created: Date;
  updated: Date;
}

class OpenCodeClient {
  private baseUrl: string | null = null;
  private currentSessionId: string | null = null;

  connect(port: number): void {
    this.baseUrl = `http://127.0.0.1:${port}`;
    console.log('[OpenCodeClient] Connected to', this.baseUrl);
  }

  disconnect(): void {
    this.baseUrl = null;
    this.currentSessionId = null;
    console.log('[OpenCodeClient] Disconnected');
  }

  isConnected(): boolean {
    return this.baseUrl !== null;
  }

  private getBaseUrl(): string {
    if (!this.baseUrl) {
      throw new Error('OpenCode client not connected. Call connect(port) first.');
    }
    return this.baseUrl;
  }

  async createSession(title?: string): Promise<OpenCodeSession> {
    const url = `${this.getBaseUrl()}/session`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    this.currentSessionId = data.id;
    return {
      id: data.id,
      title: data.title,
      created: new Date(data.created),
      updated: new Date(data.updated),
    };
  }

  async listSessions(): Promise<OpenCodeSession[]> {
    const url = `${this.getBaseUrl()}/session`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map((s: any) => ({
      id: s.id,
      title: s.title,
      created: new Date(s.created),
      updated: new Date(s.updated),
    }));
  }

  async sendPrompt(prompt: string): Promise<OpenCodeMessage> {
    if (!this.currentSessionId) {
      await this.createSession();
    }

    const url = `${this.getBaseUrl()}/session/${this.currentSessionId}/message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send prompt: ${response.statusText}`);
    }

    const data = await response.json();

    const content = data.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');

    return {
      id: data.info.id,
      role: data.info.role,
      content,
      timestamp: new Date(data.info.created),
    };
  }

  async streamPrompt(prompt: string, onChunk: (content: string) => void): Promise<void> {
    if (!this.currentSessionId) {
      await this.createSession();
    }

    const url = `${this.getBaseUrl()}/session/${this.currentSessionId}/message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send prompt: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text' || data.type === 'content') {
              onChunk(data.text || data.content || '');
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  async getSessionMessages(): Promise<OpenCodeMessage[]> {
    if (!this.currentSessionId) {
      return [];
    }

    const url = `${this.getBaseUrl()}/session/${this.currentSessionId}/message`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map((m: any) => ({
      id: m.info.id,
      role: m.info.role,
      content: m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n'),
      timestamp: new Date(m.info.created),
    }));
  }

  setSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  getSession(): string | null {
    return this.currentSessionId;
  }

  async readFile(path: string): Promise<string> {
    const url = `${this.getBaseUrl()}/file/content?path=${encodeURIComponent(path)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content;
  }

  async findFiles(query: string, type?: 'file' | 'directory'): Promise<string[]> {
    const params = new URLSearchParams({ query });
    if (type) params.append('type', type);

    const url = `${this.getBaseUrl()}/find/file?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to find files: ${response.statusText}`);
    }

    return await response.json();
  }

  async grep(pattern: string): Promise<Array<{ path: string; line_number: number; lines: string }>> {
    const url = `${this.getBaseUrl()}/find?pattern=${encodeURIComponent(pattern)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to grep: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const opencodeClient = new OpenCodeClient();
