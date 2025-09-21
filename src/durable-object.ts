export class TinyBaseStore {
  private state: DurableObjectState;
  private sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());

      server.accept();
      this.sessions.add(server);

      server.addEventListener('close', () => {
        this.sessions.delete(server);
      });

      server.addEventListener('message', async (event) => {
        try {
          const data = JSON.parse(event.data as string);

          // Store the data
          await this.state.storage.put('todos', data);

          // Broadcast to all connected clients
          const message = JSON.stringify(data);
          this.sessions.forEach(session => {
            if (session !== server && session.readyState === WebSocket.READY_STATE_OPEN) {
              session.send(message);
            }
          });
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      });

      // Send current data to new client
      const currentData = await this.state.storage.get('todos') || { tables: { todos: {} }, values: {} };
      server.send(JSON.stringify(currentData));

      return new Response(null, { status: 101, webSocket: client });
    }

    // Handle HTTP requests for initial data
    if (request.url.endsWith('/todos')) {
      const data = await this.state.storage.get('todos') || { tables: { todos: {} }, values: {} };
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
}