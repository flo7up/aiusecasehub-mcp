import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

// Always test the anonymous preview. Never inherit or spend personal-key credits.
const env = { ...process.env };
delete env.AIUSECASEHUB_API_KEY;
const docker = process.argv.includes('--docker');
const exercise = process.argv.includes('--exercise');
const child = spawn(docker ? 'docker' : process.execPath, docker
  ? ['run', '--rm', '-i', 'aiusecasehub-mcp:local']
  : [fileURLToPath(new URL('../server.mjs', import.meta.url))],
{ env, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let nextId = 0;
let failure;
let closing = false;

function fail(error) {
  failure ??= error;
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

child.on('error', fail);
child.on('exit', code => {
  if (!closing) fail(new Error(`Adapter exited unexpectedly (${code})`));
});
// Drain diagnostics without logging response bodies or inherited credentials.
child.stderr.resume();
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  try {
    const message = JSON.parse(line);
    assert.equal(message.jsonrpc, '2.0', 'stdout must contain only MCP JSON-RPC');
    if (message.id === undefined) return;
    const request = pending.get(message.id);
    assert.ok(request, 'Unexpected response ID');
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`${request.method}: JSON-RPC error ${message.error.code}`));
    else request.resolve(message.result);
  } catch (error) { fail(error); }
});

async function rpc(method, params = {}) {
  if (failure) throw failure;
  const id = ++nextId;
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 60000);
      pending.set(id, { resolve, reject, method });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  } finally { clearTimeout(timer); }
}

async function call(name, arguments_) {
  const result = await rpc('tools/call', { name, arguments: arguments_ });
  assert.ok(!result.isError, `${name} returned a tool error`);
  const payload = JSON.parse(result.content.find(item => item.type === 'text').text);
  assert.equal(payload._mcp.access_mode, 'public_preview');
  assert.equal(payload._mcp.credits_used, 0);
  return payload;
}

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-11-25', capabilities: {},
    clientInfo: { name: 'aiusecasehub-stdio-check', version: '1.0.0' },
  });
  assert.equal(init.protocolVersion, '2025-11-25');
  assert.ok(init.capabilities.tools);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const { tools } = await rpc('tools/list');
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    'get_usecase_details', 'hybrid_search_usecases', 'search_usecases', 'vector_search_usecases',
  ]);
  for (const tool of tools) {
    assert.ok(tool.description && tool.inputSchema);
    assert.equal(tool.annotations.readOnlyHint, true);
  }
  await rpc('ping');
  const report = {
    transport: docker ? 'Docker stdio to hosted HTTP' : 'Node stdio to hosted HTTP',
    initialize: 'passed', toolDefinitions: tools.length, ping: 'passed',
    search: 'not run', detailLookup: 'not run', creditsUsed: 0,
  };
  if (exercise) {
    const search = await call('search_usecases', { search_term: 'AI customer service', limit: 20 });
    assert.ok(search.items.length > 0 && search.items.length <= 3);
    assert.ok(search.items.every(item => !item.Description || item.Description.length <= 360));
    const rowKey = search.items[0].RowKey;
    assert.equal(typeof rowKey, 'string');
    const details = await call('get_usecase_details', { row_key: rowKey });
    assert.ok(Object.keys(details).some(key => key !== '_mcp'));
    assert.ok(!('ArchitectureDescription' in details));
    Object.assign(report, { search: 'passed', detailLookup: 'passed', previewAttempts: 2 });
  }
  if (failure) throw failure;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  closing = true;
  lines.close();
  child.stdin.end();
  const timer = setTimeout(() => child.kill(), 3000);
  child.once('exit', () => clearTimeout(timer));
  timer.unref();
}
