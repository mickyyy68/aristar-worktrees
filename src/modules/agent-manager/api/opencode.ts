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
  }

  disconnect(): void {
    this.baseUrl = null;
    this.currentSessionId = null;
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
        return true;
      } catch {
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

    const agents = data.map((a: any) => {
      const id = a.id;
      const name = a.name || a.id || 'Unknown';
      const description = a.description || '';
      const mode = a.mode || 'all';

      return {
        id: id || name,
        name,
        description,
        mode,
      };
    });

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
   * Optimize a prompt using the "build" agent.
   * Creates a temporary session, sends the optimization request, and returns the result.
   *
   * @param prompt - The original prompt to optimize
   * @param model - The model to use in format "provider/model-id"
   * @returns The optimized prompt text
   */
  async optimizePrompt(prompt: string, model: string): Promise<string> {
    // Create a new session for the optimization
    const session = await this.createSession('Prompt Optimization');
    this.setSession(session.id);

    const optimizationRequest = `You are an expert prompt engineer. Optimize the following user prompt for an AI coding assistant.

## Original Prompt
${prompt}

## Output Requirements
- Be specific and actionable
- Include context about the task/goal
- Add constraints (style, tests, dependencies) if relevant
- Structure clearly with sections if helpful
- Keep it concise but complete

Return ONLY the optimized prompt, no explanations or markdown code blocks.`;

    // Send the prompt and wait for the response
    const response = await this.sendPromptWithOptions(optimizationRequest, {
      model,
      agent: 'build',
    });

    return response.content.trim();
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
      console.log('[getSessionMessagesExtended] No current session ID');
      return [];
    }

    const url = `${this.getBaseUrl()}/session/${this.currentSessionId}/message`;
    console.log('[getSessionMessagesExtended] Fetching from:', url);
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[getSessionMessagesExtended] Raw API response:', JSON.stringify(data, null, 2));
    
    // Handle case where data is null, undefined, or not an array
    if (!Array.isArray(data)) {
      console.log('[getSessionMessagesExtended] Data is not an array:', typeof data);
      return [];
    }
    
    return data.map((m: any) => {
      const parts = m.parts || [];
      
      console.log('[getSessionMessagesExtended] Processing message:', {
        id: m.info?.id,
        role: m.info?.role,
        partsCount: parts.length,
        partTypes: parts.map((p: any) => p.type),
        allParts: parts
      });
      
      // Filter for text parts and extract content
      const textParts = parts.filter((p: any) => p.type === 'text');
      const textContent = textParts.map((p: any) => p.text || '').filter(Boolean).join('\n');
      
      console.log('[getSessionMessagesExtended] Text extraction:', {
        textPartsCount: textParts.length,
        textContent: textContent.substring(0, 100) + (textContent.length > 100 ? '...' : ''),
        textContentLength: textContent.length
      });
      
      return {
        id: m.info.id,
        role: m.info.role,
        content: textContent,
        // Handle multiple timestamp formats: time.created (nested), created (legacy), createdAt (alternative)
        timestamp: new Date(m.info.time?.created || m.info.created || m.info.createdAt || Date.now()),
        parts: parts,
      };
    });
  }
}

/**
 * Manager for per-agent OpenCode clients.
 * Each agent gets its own client instance to avoid connection conflicts
 * when switching between agents or using multiple agents simultaneously.
 */
class OpenCodeClientManager {
  private clients = new Map<string, OpenCodeClient>();

  /**
   * Get or create a client for a specific agent
   * @param agentKey - Composite key in format "taskId:agentId"
   * @param port - Port to connect to (optional, will connect if provided)
   */
  getClient(agentKey: string, port?: number): OpenCodeClient {
    let client = this.clients.get(agentKey);
    
    if (!client) {
      client = new OpenCodeClient();
      this.clients.set(agentKey, client);
    }
    
    if (port !== undefined && !client.isConnected()) {
      client.connect(port);
    }
    
    return client;
  }

  /**
   * Get a client only if it already exists
   */
  getExistingClient(agentKey: string): OpenCodeClient | undefined {
    return this.clients.get(agentKey);
  }

  /**
   * Remove a client for an agent (cleanup on agent removal)
   */
  removeClient(agentKey: string): void {
    const client = this.clients.get(agentKey);
    if (client) {
      client.disconnect();
      this.clients.delete(agentKey);
    }
  }

  /**
   * Check if a client exists and is connected for an agent
   */
  isConnected(agentKey: string): boolean {
    const client = this.clients.get(agentKey);
    return client?.isConnected() ?? false;
  }

  /**
   * Disconnect all clients (cleanup)
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }

  // Track active SSE subscriptions per agent
  private sseSubscriptions = new Map<string, () => void>();
  // Track if SSE is connected per agent
  private sseConnected = new Map<string, boolean>();
  // Event handlers per agent (for the React hook to use)
  private eventHandlers = new Map<string, (event: any) => void>();

  /**
   * Establish SSE connection for an agent and wait for server.connected event.
   * This should be called BEFORE sending any prompts to ensure events aren't missed.
   * 
   * @param agentKey - Composite key in format "taskId:agentId"
   * @param port - Port to connect to
   * @param timeoutMs - Maximum time to wait for connection (default: 5000ms)
   * @returns Promise that resolves when connected, or rejects on timeout/error
   */
  async establishSSEConnection(agentKey: string, port: number, timeoutMs = 5000): Promise<void> {
    // If already connected, return immediately
    if (this.sseConnected.get(agentKey)) {
      console.log(`[OpenCodeClientManager] SSE already connected for ${agentKey}`);
      return;
    }

    // Clean up any existing subscription for this agent
    const existingUnsub = this.sseSubscriptions.get(agentKey);
    if (existingUnsub) {
      existingUnsub();
      this.sseSubscriptions.delete(agentKey);
    }

    const client = this.getClient(agentKey, port);

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`SSE connection timeout for ${agentKey}`));
        }
      }, timeoutMs);

      const unsub = client.subscribeToEvents((event) => {
        // Handle the server.connected event
        if (event.type === 'server.connected' && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.sseConnected.set(agentKey, true);
          console.log(`[OpenCodeClientManager] SSE connected for ${agentKey}`);
          resolve();
        }

        // Forward all events to the registered handler (if any)
        const handler = this.eventHandlers.get(agentKey);
        if (handler) {
          handler(event);
        }
      });

      this.sseSubscriptions.set(agentKey, unsub);
    });
  }

  /**
   * Register an event handler for an agent's SSE events.
   * Used by the useAgentSSE hook to receive events.
   * If SSE is already connected, the handler will receive future events.
   * 
   * @param agentKey - Composite key in format "taskId:agentId"
   * @param handler - Function to call for each event
   * @returns Unsubscribe function
   */
  registerEventHandler(agentKey: string, handler: (event: any) => void): () => void {
    this.eventHandlers.set(agentKey, handler);
    console.log(`[OpenCodeClientManager] Event handler registered for ${agentKey}`);
    
    return () => {
      if (this.eventHandlers.get(agentKey) === handler) {
        this.eventHandlers.delete(agentKey);
        console.log(`[OpenCodeClientManager] Event handler unregistered for ${agentKey}`);
      }
    };
  }

  /**
   * Check if SSE is connected for an agent
   */
  isSSEConnected(agentKey: string): boolean {
    return this.sseConnected.get(agentKey) ?? false;
  }

  /**
   * Clean up SSE subscription for an agent
   */
  cleanupSSE(agentKey: string): void {
    const unsub = this.sseSubscriptions.get(agentKey);
    if (unsub) {
      unsub();
      this.sseSubscriptions.delete(agentKey);
    }
    this.sseConnected.delete(agentKey);
    this.eventHandlers.delete(agentKey);
    console.log(`[OpenCodeClientManager] SSE cleaned up for ${agentKey}`);
  }
}

// Legacy singleton client (for backward compatibility with code that doesn't need per-agent isolation)
export const opencodeClient = new OpenCodeClient();

// Per-agent client manager (for SSE subscriptions that need isolation)
export const opencodeClientManager = new OpenCodeClientManager();
