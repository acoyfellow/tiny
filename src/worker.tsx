import { Hono } from 'hono';
import { TinyBaseStore } from './durable-object';

// Cloudflare Workers types
declare global {
  interface DurableObjectNamespace {
    getByName(name: string): DurableObjectStub;
  }
  interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
  }
}

export interface Env {
  TINYBASE_STORE: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// Rate limiting state (in-memory)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

// Helper functions
function getUserId(request: Request): string {
  // Try to get user from URL query parameter first
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId) {
    return queryUserId;
  }

  // Try to get user from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try to get from session cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const sessionMatch = cookieHeader.match(/session=([^;]+)/);
    if (sessionMatch) {
      return sessionMatch[1];
    }
  }

  // Generate a session ID for anonymous users
  return `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isRateLimited(clientIP: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 100; // 100 requests per minute
  
  const current = rateLimiter.get(clientIP);
  
  if (!current || now > current.resetTime) {
    // Reset or initialize
    rateLimiter.set(clientIP, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (current.count >= maxRequests) {
    return true;
  }
  
  current.count++;
  return false;
}

// JSX-based frontend
const TodoApp = ({ initialTodos = {}, userId }: { initialTodos?: Record<string, any>; userId?: string }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>tiny: a TinyBase + Cloudflare POC</title>
      <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <script src="https://unpkg.com/tinybase@4.8.4/lib/umd/tinybase.js"></script>
    </head>
    <body class="bg-white min-h-screen" style="font-family: 'Google Sans', sans-serif;">
      <div class="max-w-4xl mx-auto p-6">
        <div class="mb-8">
          <h1 class="text-5xl font-bold mb-2 text-black">tiny</h1>
          <div class="my-6 flex items-center gap-6 text-black">
            <div class="flex items-center gap-2">
              <span>Connection:</span>
              <span id="connectionStatus" class="px-2 py-1 bg-black text-white text-sm font-medium">Connected</span>
            </div>
            <div class="flex items-center gap-2">
              <span>User:</span>
              <span class="px-2 py-1 border border-black text-sm font-medium">{userId || 'Loading...'}</span>
            </div>
          </div>
        </div>
        <div class="text-lg mb-4">
          <span class="text-black font-medium">
            Realtime Collaborative Todo List with User-based Sharding
          </span>
          <span class="text-black"> → </span>
          <a href="https://github.com/acoyfellow/tiny" target="_blank" class="text-black font-medium underline hover:no-underline">
            GitHub
          </a>
        </div>
        <div class="mb-6 p-4 border-l-4 border-black bg-gray-50 text-black space-y-2">
          
          <div>
            <span class="font-semibold">What is this?</span> This is a simple example of a TinyBase + Cloudflare Durable Objects application. Each user gets their own private todo list with real-time sync.
          </div>
          <div>
            <span class="font-semibold">Architecture:</span> User-based sharding enabled! Each user gets 128MB storage (~100K todos per user) with rate limiting protection
          </div>
          <div class="mb-6 p-4 border border-black bg-gray-50">
            <div class="text-black">
              <span class="text-lg">💡</span> <span class="font-semibold">Try different users:</span> Add{" "}
              <code class="bg-white px-1 border">?userId=alice</code> or{" "}
              <code class="bg-white px-1 border">?userId=bob</code> to the URL to test user isolation. Each user gets their own private todo list with real-time sync!
            </div>
          </div>
          <div class="mb-8 text-black">
            <span class="font-semibold">Tech Stack:</span>
            <span> <a href="https://hono.dev" target="_blank" class="text-black underline hover:no-underline">Hono</a> </span>
            <span>•</span>
            <span> <a href="https://developers.cloudflare.com/workers/" target="_blank" class="text-black underline hover:no-underline">Cloudflare Workers</a> </span>
            <span>•</span>
            <span> <a href="https://alchemy.run" target="_blank" class="text-black underline hover:no-underline">Alchemy.run</a> </span>
            <span>•</span>
            <span> <a href="https://tailwindcss.com" target="_blank" class="text-black underline hover:no-underline">Tailwind CSS</a></span>
          </div>
        </div>

       

        

      

        <div class="mb-8">
          <h2 class="text-3xl font-bold mb-6 text-black">Todo List Demo</h2>

          <div class="mb-6 flex gap-3">
            <input
              type="text"
              id="todoInput"
              placeholder="Enter todo item..."
              class="flex-1 px-4 py-3 border border-black focus:outline-none focus:ring-2 focus:ring-black text-lg"
            />
            <button
              onclick="addTodo()"
              class="px-6 py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
            >
              Add Todo
            </button>
            <button
              onclick="clearCompleted()"
              class="px-6 py-3 border border-black bg-white text-black font-medium hover:bg-gray-100 transition-colors"
            >
              Clear Completed
            </button>
            <button
              onclick="loadTodos()"
              class="px-6 py-3 border border-black bg-white text-black font-medium hover:bg-gray-100 transition-colors"
            >
              Reload
            </button>
          </div>

          <div id="todoList" class="space-y-3 mb-8">
            {Object.entries(initialTodos).map(([id, todo]) => (
              <div class="flex items-center gap-3 p-3 border border-black">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onchange={`toggleTodo('${id}')`}
                  class="w-5 h-5 accent-black"
                />
                <span class={`flex-1 text-lg ${todo.completed ? 'line-through text-gray-500' : 'text-black'}`}>
                  {todo.text}
                </span>
                <button
                  onclick={`deleteTodo('${id}')`}
                  class="px-4 py-2 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div class="mb-8">
          <h2 class="text-3xl font-bold mb-4 text-black">Raw Store Data</h2>

          <div class="mb-4 text-black">
            <span>
              Storage: <span id="storageUsed">{JSON.stringify({ tables: { todos: initialTodos }, values: {} }).length}</span> bytes / 128MB DO limit
            </span>
          </div>

          <div class="bg-black text-white p-4 font-mono text-sm overflow-x-auto">
            <pre id="storeData">{JSON.stringify({ tables: { todos: initialTodos }, values: {} }, null, 2)}</pre>
          </div>
        </div>

        <div id="status"></div>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        // Go back to what was working - simple TinyBase store
        const store = TinyBase.createStore();
        let todos = ${JSON.stringify(initialTodos)};

        // Simple WebSocket for real-time sync (with user ID)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const userId = '${userId}';
        const wsUrl = protocol + '//' + window.location.host + '/todos?userId=' + encodeURIComponent(userId);
        let websocket;

        function connectWebSocket() {
          try {
            websocket = new WebSocket(wsUrl);

            websocket.onopen = () => {
              console.log('Connected to WebSocket');
              updateConnectionStatus(true);
            };

            websocket.onclose = () => {
              console.log('WebSocket disconnected');
              updateConnectionStatus(false);
              setTimeout(connectWebSocket, 3000);
            };

            websocket.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.tables?.todos) {
                  todos = data.tables.todos;
                  updateDisplay();
                }
              } catch (e) {
                console.error('WebSocket message error:', e);
              }
            };

            websocket.onerror = (error) => {
              console.error('WebSocket error:', error);
              updateConnectionStatus(false);
            };
          } catch (error) {
            console.error('WebSocket connection failed:', error);
            updateConnectionStatus(false);
            setTimeout(connectWebSocket, 3000);
          }
        }

        connectWebSocket();
        updateDisplay();

        function updateDisplay() {
          updateTodoList();
          updateStoreData();
        }

        function updateTodoList() {
          const todoList = document.getElementById('todoList');

          todoList.innerHTML = '';
          Object.entries(todos).forEach(([id, todo]) => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 p-3 border border-black';
            div.innerHTML = \`
              <input
                type="checkbox"
                \${todo.completed ? 'checked' : ''}
                onchange="toggleTodo('\${id}')"
                class="w-5 h-5 accent-black"
              >
              <span class="flex-1 text-lg \${todo.completed ? 'line-through text-gray-500' : 'text-black'}">
                \${todo.text}
              </span>
              <button
                onclick="deleteTodo('\${id}')"
                class="px-4 py-2 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
              >
                Delete
              </button>
            \`;
            todoList.appendChild(div);
          });
        }

        function updateStoreData() {
          const data = { tables: { todos }, values: {} };
          const dataStr = JSON.stringify(data, null, 2);
          const bytes = new Blob([dataStr]).size;

          document.getElementById('storeData').textContent = dataStr;
          document.getElementById('storageUsed').textContent = bytes.toLocaleString();

          // Warn when approaching limits
          if (bytes > 100 * 1024 * 1024) {
            document.getElementById('storageUsed').className = 'text-red-600 font-bold';
          } else if (bytes > 50 * 1024 * 1024) {
            document.getElementById('storageUsed').className = 'text-yellow-600 font-bold';
          }
        }

        function updateConnectionStatus(connected) {
          const statusEl = document.getElementById('connectionStatus');
          if (connected) {
            statusEl.textContent = 'Connected';
            statusEl.className = 'px-2 py-1 bg-black text-white text-sm font-medium';
          } else {
            statusEl.textContent = 'Disconnected';
            statusEl.className = 'px-2 py-1 bg-gray-500 text-white text-sm font-medium';
          }
        }

        function addTodo() {
          const input = document.getElementById('todoInput');
          const text = input.value.trim();
          if (!text) return;

          const id = Date.now().toString();
          todos[id] = { text, completed: false };
          input.value = '';
          updateDisplay();
          sendToServer();
        }

        function toggleTodo(id) {
          todos[id].completed = !todos[id].completed;
          updateDisplay();
          sendToServer();
        }

        function deleteTodo(id) {
          delete todos[id];
          updateDisplay();
          sendToServer();
        }

        function clearCompleted() {
          Object.keys(todos).forEach(id => {
            if (todos[id].completed) {
              delete todos[id];
            }
          });
          updateDisplay();
          sendToServer();
        }

        function sendToServer() {
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
              tables: { todos },
              values: {}
            }));
          }
        }

        function loadTodos() {
          // Synchronizer handles loading automatically
          updateDisplay();
        }

        // Allow enter key to add todos
        document.getElementById('todoInput').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') addTodo();
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
          if (synchronizer) {
            synchronizer.destroy();
          }
        });
      `}} />
    </body>
  </html>
);

app.get('/', async (c) => {
  // Rate limiting
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  if (isRateLimited(clientIP)) {
    return c.text('Rate limited. Please try again later.', 429);
  }

  // Get user-specific DO
  const userId = getUserId(c.req.raw);
  const obj = c.env.TINYBASE_STORE.getByName(`user-${userId}`);
  const response = await obj.fetch(new Request('http://localhost/todos'));
  const data = await response.json();
  const initialTodos = data.tables?.todos || {};

  // Set session cookie for anonymous users
  if (userId.startsWith('anon-')) {
    c.header('Set-Cookie', `session=${userId}; Path=/; Max-Age=86400; HttpOnly`);
  }

  return c.html(<TodoApp initialTodos={initialTodos} userId={userId} />);
});

// Route WebSocket requests to Durable Object
app.all('/todos', async (c) => {
  // Rate limiting
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  if (isRateLimited(clientIP)) {
    return c.text('Rate limited. Please try again later.', 429);
  }

  // Get user ID from query parameter or fallback to header/cookie detection
  let userId = c.req.query('userId');
  if (!userId) {
    userId = getUserId(c.req.raw);
  }

  const obj = c.env.TINYBASE_STORE.getByName(`user-${userId}`);
  return obj.fetch(c.req.raw);
});

export default app;
export { TinyBaseStore };