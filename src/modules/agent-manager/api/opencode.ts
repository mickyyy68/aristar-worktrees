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

// ============ Extended Types for Agent Manager ============

/**
 * Model information from OpenCode
 */
export interface OpenCodeModel {
  id: string;
  name: string;
  limit?: {
    context?: number;
    output?: number;
  };
}

/**
 * Provider information from OpenCode
 */
export interface OpenCodeProvider {
  id: string;
  name: string;
  models: OpenCodeModel[];
}

/**
 * Agent configuration from OpenCode
 */
export interface OpenCodeAgentInfo {
  id: string;
  name: string;
  description: string;
  mode: 'primary' | 'subagent' | 'all';
}

/**
 * Message part types for extended message parsing
 */
export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocationId: string;
  toolName: string;
  state: 'pending' | 'result' | 'error';
  args?: unknown;
  result?: unknown;
}

export type MessagePart = TextPart | ToolInvocationPart | { type: string; [key: string]: unknown };

/**
 * Extended message with full parts information
 */
export interface OpenCodeMessageExtended extends OpenCodeMessage {
  parts: MessagePart[];
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
      // Handle multiple timestamp formats: time.created (nested), created (legacy), createdAt (alternative)
      timestamp: new Date(m.info.time?.created || m.info.created || m.info.createdAt || Date.now()),
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

  // ============ Extended Methods for Agent Manager ============

  /**
   * Check if the server is healthy/ready
   * Endpoint: GET /global/health
   */
  async healthCheck(): Promise<{ healthy: boolean; version: string }> {
    const url = `${this.getBaseUrl()}/global/health`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Wait for the server to be ready with retries
   */
  async waitForReady(maxRetries = 10, delayMs = 300): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.healthCheck();
        console.log('[OpenCodeClient] Server is ready');
        return true;
      } catch {
        console.log(`[OpenCodeClient] Waiting for server... (${i + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    console.error('[OpenCodeClient] Server did not become ready in time');
    return false;
  }

  /**
   * Get available providers and their models (including custom ones)
   * Endpoint: GET /provider
   * 
   * Note: We use /provider instead of /config/providers because /provider
   * returns ALL providers including custom ones defined in opencode.json
   */
  async getProviders(): Promise<{ providers: OpenCodeProvider[]; default: Record<string, string> }> {
    const url = `${this.getBaseUrl()}/provider`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get providers: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[OpenCodeClient] getProviders raw response:', JSON.stringify(data, null, 2));

    // The /provider endpoint returns { all: Provider[], default: {...}, connected: string[] }
    const rawProviders = data.all || data.providers || [];
    
    // Transform the API response to our format
    // Handle both array and object formats for models
    const providers: OpenCodeProvider[] = rawProviders.map((p: any) => {
      // models can be an array or an object (map of model id -> model info)
      let models: OpenCodeModel[] = [];
      
      if (Array.isArray(p.models)) {
        // Models is already an array
        models = p.models.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          limit: m.limit,
        }));
      } else if (p.models && typeof p.models === 'object') {
        // Models is an object/map - convert to array
        models = Object.entries(p.models).map(([id, m]: [string, any]) => ({
          id: m.id || id,
          name: m.name || m.id || id,
          limit: m.limit,
        }));
      }
      
      return {
        id: p.id,
        name: p.name || p.id,
        models,
      };
    });

    console.log('[OpenCodeClient] Transformed providers:', providers.length, 'providers');

    return {
      providers,
      default: data.default || {},
    };
  }

  /**
   * Get all provider info including connected status
   * Endpoint: GET /provider
   */
  async getProviderInfo(): Promise<{
    all: OpenCodeProvider[];
    default: Record<string, string>;
    connected: string[];
  }> {
    const url = `${this.getBaseUrl()}/provider`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get provider info: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get available agents
   * Endpoint: GET /agent
   */
  async getAgents(): Promise<OpenCodeAgentInfo[]> {
    const url = `${this.getBaseUrl()}/agent`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get agents: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[OpenCodeClient] getAgents raw response:', JSON.stringify(data, null, 2));

    const agents = data.map((a: any) => {
      const id = a.id;
      const name = a.name || a.id || 'Unknown';
      const description = a.description || '';
      const mode = a.mode || 'all';

      if (!id) {
        console.debug('[OpenCodeClient] Agent missing id, using name as fallback:', { name, id });
      }

      return {
        id: id || name,
        name,
        description,
        mode,
      };
    });

    console.log('[OpenCodeClient] Transformed agents:', agents.length, 'agents');

    return agents;
  }

  /**
   * Send prompt with model and agent options
   * Endpoint: POST /session/:id/message
   *
   * Note: model should be in format "provider/model-id", will be split into providerID and modelID
   */
  async sendPromptWithOptions(
    prompt: string,
    options: {
      model?: string; // Format: "provider/model-id"
      agent?: string;
    }
  ): Promise<OpenCodeMessage> {
    if (!this.currentSessionId) {
      await this.createSession();
    }

    const url = `${this.getBaseUrl()}/session/${this.currentSessionId}/message`;
    const body: Record<string, unknown> = {
      parts: [{ type: 'text', text: prompt }],
    };

    // Model should be an object with providerID and modelID
    if (options.model) {
      const [providerID, ...modelParts] = options.model.split('/');
      const modelID = modelParts.join('/'); // Handle model IDs that contain slashes
      body.model = { providerID, modelID };
    }

    if (options.agent) {
      body.agent = options.agent;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  /**
   * Send prompt asynchronously (returns immediately, no wait for response)
   * Endpoint: POST /session/:id/prompt_async
   * 
   * Note: model should be in format "provider/model-id", will be split into providerID and modelID
   */
  async sendPromptAsync(
    prompt: string,
    options?: {
      model?: string;  // Format: "provider/model-id"
      agent?: string;
    }
  ): Promise<void> {
    if (!this.currentSessionId) {
      await this.createSession();
    }

    const url = `${this.getBaseUrl()}/session/${this.currentSessionId}/prompt_async`;
    const body: Record<string, unknown> = {
      parts: [{ type: 'text', text: prompt }],
    };

    // Model should be an object with providerID and modelID
    if (options?.model) {
      const [providerID, ...modelParts] = options.model.split('/');
      const modelID = modelParts.join('/'); // Handle model IDs that contain slashes
      body.model = { providerID, modelID };
    }

    if (options?.agent) {
      body.agent = options.agent;
    }

    console.log('[OpenCodeClient] sendPromptAsync body:', JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenCodeClient] sendPromptAsync error:', errorText);
      throw new Error(`Failed to send async prompt: ${response.statusText}`);
    }
    // Returns 204 No Content on success
  }

  /**
   * Abort/cancel a running session
   * Endpoint: POST /session/:id/abort
   */
  async abortSession(sessionId: string): Promise<boolean> {
    const url = `${this.getBaseUrl()}/session/${sessionId}/abort`;
    const response = await fetch(url, { method: 'POST' });

    if (!response.ok) {
      throw new Error(`Failed to abort session: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Subscribe to SSE events for real-time updates
   * Endpoint: GET /event
   *
   * First event is 'server.connected', then bus events
   */
  subscribeToEvents(onEvent: (event: any) => void): () => void {
    const url = `${this.getBaseUrl()}/event`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (e) {
        console.error('[OpenCodeClient] Failed to parse event:', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[OpenCodeClient] EventSource error:', error);
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Get extended messages with full parts information
   * Endpoint: GET /session/:id/message
   */
  async getSessionMessagesExtended(): Promise<OpenCodeMessageExtended[]> {
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
      // Handle multiple timestamp formats: time.created (nested), created (legacy), createdAt (alternative)
      timestamp: new Date(m.info.time?.created || m.info.created || m.info.createdAt || Date.now()),
      parts: m.parts,
    }));
  }
}

export const opencodeClient = new OpenCodeClient();
