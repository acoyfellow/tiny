import { Hono } from 'hono';
import { jsx } from 'hono/jsx';
import { TinyBaseStore } from './durable-object';

export interface Env {
  TINYBASE_STORE: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

// JSX-based frontend
const TodoApp = ({ initialTodos = {} }: { initialTodos?: Record<string, any> }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>TinyBase + Cloudflare POC</title>
      <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <script src="https://unpkg.com/tinybase@4.8.4/lib/umd/tinybase.js"></script>
    </head>
    <body class="bg-gray-100 min-h-screen py-8" style="font-family: 'Google Sans', sans-serif;">
      <div class="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">TinyBase + Cloudflare Durable Objects POC</h1>

        <div class="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
          <div class="flex">
            <div class="ml-3">
              <p class="text-sm text-yellow-700">
                <strong>Architecture Limits:</strong> Single DO = 128MB storage (~100K todos), CPU throttling at scale, no multi-tenant isolation
              </p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <span class="text-sm text-gray-600">Connection: </span>
          <span id="connectionStatus" class="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">Connected</span>
        </div>

        <div class="mb-8">
          <h2 class="text-xl font-semibold text-gray-700 mb-4">Todo List Demo</h2>
          <div class="flex gap-2 mb-4 flex-wrap">
            <input
              type="text"
              id="todoInput"
              placeholder="Enter todo item..."
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onclick="addTodo()"
              class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Add Todo
            </button>
            <button
              onclick="clearCompleted()"
              class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Clear Completed
            </button>
            <button
              onclick="loadTodos()"
              class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              Reload
            </button>
          </div>
          <div id="todoList" class="space-y-2">
            {Object.entries(initialTodos).map(([id, todo]) => (
              <div class={`flex items-center gap-3 p-3 border border-gray-200 rounded-md ${todo.completed ? 'bg-gray-50 opacity-75' : 'bg-white'}`}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onchange={`toggleTodo('${id}')`}
                  class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span class={`${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'} flex-1`}>
                  {todo.text}
                </span>
                <button
                  onclick={`deleteTodo('${id}')`}
                  class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div class="mb-4">
          <h2 class="text-xl font-semibold text-gray-700 mb-4">Raw Store Data</h2>
          <div class="mb-2 text-xs text-gray-500">
            Storage: <span id="storageUsed">{JSON.stringify({ tables: { todos: initialTodos }, values: {} }).length}</span> bytes / 128MB DO limit
          </div>
          <pre id="storeData" class="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm overflow-auto max-h-64">
            {JSON.stringify({ tables: { todos: initialTodos }, values: {} }, null, 2)}
          </pre>
        </div>

        <div id="status"></div>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        // Go back to what was working - simple TinyBase store
        const store = TinyBase.createStore();
        let todos = ${JSON.stringify(initialTodos)};

        // Simple WebSocket for real-time sync
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host + '/todos';
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
            div.className = \`flex items-center gap-3 p-3 border border-gray-200 rounded-md \${todo.completed ? 'bg-gray-50 opacity-75' : 'bg-white'}\`;
            div.innerHTML = \`
              <input
                type="checkbox"
                \${todo.completed ? 'checked' : ''}
                onchange="toggleTodo('\${id}')"
                class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              >
              <span class="\${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'} flex-1">
                \${todo.text}
              </span>
              <button
                onclick="deleteTodo('\${id}')"
                class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
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
            statusEl.className = 'px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800';
          } else {
            statusEl.textContent = 'Disconnected';
            statusEl.className = 'px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800';
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
  const obj = c.env.TINYBASE_STORE.getByName('default-store');
  const response = await obj.fetch(new Request('http://localhost/todos'));
  const data = await response.json();
  const initialTodos = data.tables?.todos || {};

  return c.html(<TodoApp initialTodos={initialTodos} />);
});

// Route WebSocket requests to Durable Object
app.all('/todos', async (c) => {
  const obj = c.env.TINYBASE_STORE.getByName('default-store');
  return obj.fetch(c.req.raw);
});

export default app;
export { TinyBaseStore };