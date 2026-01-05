/**
 * Mock SSE Server for testing OpenCode event streaming
 *
 * This creates a real HTTP server that sends SSE events, allowing us to test
 * the full event flow from server to client.
 */



export interface SSEEvent {
  type: string;
  properties?: Record<string, unknown>;
}

export interface MockSSEServerOptions {
  port?: number;
}

/**
 * Creates a mock SSE server that simulates OpenCode's /event endpoint
 */
export class MockSSEServer {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private clients: Set<ReadableStreamDefaultController<Uint8Array>> = new Set();
  private port: number;
  private eventQueue: SSEEvent[] = [];

  constructor(options: MockSSEServerOptions = {}) {
    this.port = options.port || 0; // 0 = auto-assign port
  }

  /**
   * Start the mock server
   */
  async start(): Promise<number> {
    const self = this;

    this.server = Bun.serve({
      port: this.port,
      fetch(req) {
        const url = new URL(req.url);

        // Handle SSE endpoint
        if (url.pathname === '/event') {
          return self.handleSSE();
        }

        // Handle health check
        if (url.pathname === '/global/health') {
          return new Response(JSON.stringify({ healthy: true, version: '1.0.0' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Handle session creation
        if (url.pathname === '/session' && req.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: 'test-session-123',
              title: 'Test Session',
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Handle session list
        if (url.pathname === '/session' && req.method === 'GET') {
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Handle prompt async
        if (url.pathname.match(/\/session\/[^/]+\/prompt_async/) && req.method === 'POST') {
          return new Response(null, { status: 204 });
        }

        // Handle messages list
        if (url.pathname.match(/\/session\/[^/]+\/message/) && req.method === 'GET') {
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Handle provider list
        if (url.pathname === '/provider') {
          return new Response(
            JSON.stringify({
              all: [
                {
                  id: 'anthropic',
                  name: 'Anthropic',
                  models: [{ id: 'claude-sonnet-4', name: 'Claude Sonnet 4' }],
                },
              ],
              default: {},
              connected: ['anthropic'],
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Handle agent list
        if (url.pathname === '/agent') {
          return new Response(
            JSON.stringify([
              {
                id: 'build',
                name: 'Build',
                description: 'Default agent',
                mode: 'primary',
              },
            ]),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response('Not Found', { status: 404 });
      },
    });

    this.port = this.server.port ?? this.port;
    return this.port;
  }

  /**
   * Handle SSE connection
   */
  private handleSSE(): Response {
    const self = this;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        self.clients.add(controller);

        // Send initial server.connected event
        const connectEvent = { type: 'server.connected', properties: {} };
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(connectEvent)}\n\n`)
        );

        // Send any queued events
        for (const event of self.eventQueue) {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
        self.eventQueue = [];
      },
      cancel() {
        // Client disconnected - we need to find and remove this controller
        // Since we can't compare controllers directly, we'll let it be garbage collected
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  /**
   * Send an SSE event to all connected clients
   */
  sendEvent(event: SSEEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    const encoded = new TextEncoder().encode(data);

    for (const controller of this.clients) {
      try {
        controller.enqueue(encoded);
      } catch {
        // Client might have disconnected
        this.clients.delete(controller);
      }
    }
  }

  /**
   * Queue an event to be sent when a client connects
   */
  queueEvent(event: SSEEvent): void {
    this.eventQueue.push(event);
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Get the port number
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Stop the server
   */
  stop(): void {
    // Close all client connections
    for (const controller of this.clients) {
      try {
        controller.close();
      } catch {
        // Ignore errors on close
      }
    }
    this.clients.clear();

    // Stop the server
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * Helper function to create and start a mock server
 */
export async function createMockSSEServer(
  options?: MockSSEServerOptions
): Promise<MockSSEServer> {
  const server = new MockSSEServer(options);
  await server.start();
  return server;
}
