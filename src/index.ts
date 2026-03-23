import { Hono, Context, Next } from "hono";
import { cors } from "hono/cors";
import { handleRest } from './rest';

export interface Env {
    DB: D1Database;
    SECRET: SecretsStoreSecret | string;
}

// # List all users
// GET /rest/users

// # Get filtered and sorted users
// GET /rest/users?age=25&sort_by=name&order=desc

// # Get paginated results
// GET /rest/users?limit=10&offset=20

// # Create a new user
// POST /rest/users
// { "name": "John", "age": 30 }

// # Update a user
// PATCH /rest/users/123
// { "age": 31 }

// # Delete a user
// DELETE /rest/users/123

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const app = new Hono<{ Bindings: Env }>();

        // Apply CORS to all routes
        app.use('*', async (c, next) => {
            return cors()(c, next);
        })

        // Secret Store key value that we have set
        const secret = typeof env.SECRET === 'string' ? env.SECRET : await env.SECRET.get();

        // Authentication middleware that verifies the Authorization header
        // is sent in on each request and matches the value of our Secret key.
        // If a match is not found we return a 401 and prevent further access.
        const authMiddleware = async (c: Context, next: Next) => {
            const authHeader = c.req.header('Authorization');
            if (!authHeader) {
                return c.json({ error: 'Unauthorized' }, 401);
            }

            const token = authHeader.startsWith('Bearer ')
                ? authHeader.substring(7)
                : authHeader;

            if (token !== secret) {
                return c.json({ error: 'Unauthorized' }, 401);
            }

            return next();
        };

        // API docs page (no auth required)
        app.get('/', (c) => {
            const base = new URL(c.req.url).origin;
            const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>D1 REST API</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 860px; margin: 0 auto; }
    h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 32px; }
    .auth-box { background: #1e2330; border: 1px solid #2d3748; border-radius: 10px; padding: 16px 20px; margin-bottom: 32px; font-size: 0.85rem; color: #94a3b8; }
    .auth-box strong { color: #f59e0b; }
    .auth-box code { background: #0f1117; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 10px; padding-left: 4px; }
    .endpoint { background: #1e2330; border: 1px solid #2d3748; border-radius: 10px; overflow: hidden; margin-bottom: 10px; }
    .endpoint-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; user-select: none; }
    .endpoint-header:hover { background: #252d3d; }
    .method { font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; min-width: 60px; text-align: center; letter-spacing: 0.05em; }
    .GET    { background: #064e3b; color: #34d399; }
    .POST   { background: #1e3a5f; color: #60a5fa; }
    .PATCH  { background: #3b1f00; color: #fb923c; }
    .DELETE { background: #3b0a0a; color: #f87171; }
    .path { font-family: monospace; font-size: 0.95rem; color: #e2e8f0; flex: 1; }
    .desc { font-size: 0.82rem; color: #64748b; }
    .auth-badge { font-size: 0.68rem; background: #2d1f00; color: #f59e0b; border: 1px solid #78350f; padding: 2px 7px; border-radius: 12px; }
    .endpoint-body { border-top: 1px solid #2d3748; padding: 16px 18px; display: none; }
    .endpoint-body.open { display: block; }
    .detail-row { display: flex; gap: 12px; margin-bottom: 12px; font-size: 0.83rem; }
    .detail-label { color: #475569; min-width: 80px; padding-top: 1px; }
    .detail-val { color: #cbd5e1; font-family: monospace; }
    .params-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 4px; }
    .params-table th { text-align: left; color: #475569; font-weight: 500; padding: 4px 8px 6px 0; border-bottom: 1px solid #2d3748; }
    .params-table td { padding: 6px 8px 6px 0; border-bottom: 1px solid #1a2234; color: #94a3b8; vertical-align: top; }
    .params-table td:first-child { color: #e2e8f0; font-family: monospace; }
    .tag { display: inline-block; font-size: 0.7rem; padding: 1px 6px; border-radius: 3px; background: #1a2234; color: #64748b; margin-left: 6px; }
    .tag.required { background: #2d1a1a; color: #f87171; }
    pre { background: #0f1117; border: 1px solid #2d3748; border-radius: 6px; padding: 12px 14px; font-size: 0.8rem; color: #a3e635; overflow-x: auto; margin-top: 4px; line-height: 1.6; }
  </style>
</head>
<body>
<div class="container">
  <h1>D1 REST API</h1>
  <p class="subtitle">Cloudflare D1 通用 REST 接口</p>

  <div class="auth-box">
    <strong>鉴权方式：</strong> 所有请求需携带 Header：<code>Authorization: Bearer &lt;SECRET&gt;</code>
  </div>

  <div class="section">
    <div class="section-title">CRUD &mdash; 通用表操作（{table} 替换为实际表名）</div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="toggle(this)">
        <span class="method GET">GET</span>
        <span class="path">/rest/{table}</span>
        <span class="desc">查询记录列表，支持过滤 / 排序 / 分页</span>
        <span class="auth-badge">需鉴权</span>
      </div>
      <div class="endpoint-body">
        <table class="params-table">
          <tr><th>Query 参数</th><th>说明</th><th>示例</th></tr>
          <tr><td>{字段名}<span class="tag">可选</span></td><td>按字段精确过滤，可叠加多个</td><td>age=25&amp;city=Beijing</td></tr>
          <tr><td>sort_by<span class="tag">可选</span></td><td>排序字段</td><td>sort_by=name</td></tr>
          <tr><td>order<span class="tag">可选</span></td><td>asc（默认）或 desc</td><td>order=desc</td></tr>
          <tr><td>limit<span class="tag">可选</span></td><td>返回条数上限</td><td>limit=10</td></tr>
          <tr><td>offset<span class="tag">可选</span></td><td>跳过条数（配合 limit 分页）</td><td>offset=20</td></tr>
        </table>
        <div class="detail-row" style="margin-top:14px">
          <span class="detail-label">示例</span>
          <pre>GET ${base}/rest/users?age=25&sort_by=name&order=desc&limit=10&offset=0
Authorization: Bearer &lt;SECRET&gt;</pre>
        </div>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="toggle(this)">
        <span class="method GET">GET</span>
        <span class="path">/rest/{table}/{id}</span>
        <span class="desc">查询单条记录</span>
        <span class="auth-badge">需鉴权</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-row">
          <span class="detail-label">Path 参数</span>
          <span class="detail-val">id<span class="tag required">必填</span> — 记录的 id</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">示例</span>
          <pre>GET ${base}/rest/users/123
Authorization: Bearer &lt;SECRET&gt;</pre>
        </div>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="toggle(this)">
        <span class="method POST">POST</span>
        <span class="path">/rest/{table}</span>
        <span class="desc">新增一条记录</span>
        <span class="auth-badge">需鉴权</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-row">
          <span class="detail-label">Body</span>
          <span class="detail-val">JSON 对象，字段对应表的列名</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">示例</span>
          <pre>POST ${base}/rest/users
Authorization: Bearer &lt;SECRET&gt;
Content-Type: application/json

{ "name": "Alice", "age": 30 }</pre>
        </div>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="toggle(this)">
        <span class="method PATCH">PATCH</span>
        <span class="path">/rest/{table}/{id}</span>
        <span class="desc">更新指定记录的部分字段</span>
        <span class="auth-badge">需鉴权</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-row">
          <span class="detail-label">Path 参数</span>
          <span class="detail-val">id<span class="tag required">必填</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Body</span>
          <span class="detail-val">JSON 对象，只需传要修改的字段</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">示例</span>
          <pre>PATCH ${base}/rest/users/123
Authorization: Bearer &lt;SECRET&gt;
Content-Type: application/json

{ "age": 31 }</pre>
        </div>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="toggle(this)">
        <span class="method DELETE">DELETE</span>
        <span class="path">/rest/{table}/{id}</span>
        <span class="desc">删除指定记录</span>
        <span class="auth-badge">需鉴权</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-row">
          <span class="detail-label">Path 参数</span>
          <span class="detail-val">id<span class="tag required">必填</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">示例</span>
          <pre>DELETE ${base}/rest/users/123
Authorization: Bearer &lt;SECRET&gt;</pre>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">原始 SQL</div>
    <div class="endpoint">
      <div class="endpoint-header" onclick="toggle(this)">
        <span class="method POST">POST</span>
        <span class="path">/query</span>
        <span class="desc">执行任意 SQL 语句</span>
        <span class="auth-badge">需鉴权</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-row">
          <span class="detail-label">Body</span>
          <span class="detail-val">{ "query": string, "params": any[] }</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">示例</span>
          <pre>POST ${base}/query
Authorization: Bearer &lt;SECRET&gt;
Content-Type: application/json

{
  "query": "SELECT * FROM users WHERE age > ?",
  "params": [18]
}</pre>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
  function toggle(header) {
    header.nextElementSibling.classList.toggle('open');
  }
</script>
</body>
</html>`;
            return c.html(html);
        });

        // CRUD REST endpoints made available to all of our tables
        app.all('/rest/*', authMiddleware, handleRest);

        // Execute a raw SQL statement with parameters with this route
        app.post('/query', authMiddleware, async (c) => {
            try {
                const body = await c.req.json();
                const { query, params } = body;

                if (!query) {
                    return c.json({ error: 'Query is required' }, 400);
                }

                // Execute the query against D1 database
                const results = await env.DB.prepare(query)
                    .bind(...(params || []))
                    .all();

                return c.json(results);
            } catch (error: any) {
                return c.json({ error: error.message }, 500);
            }
        });

        return app.fetch(request, env, ctx);
    }
} satisfies ExportedHandler<Env>;
