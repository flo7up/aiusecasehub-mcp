import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const endpoint = 'https://basic-backend713-dsd8hygyfkc8d8f5.swedencentral-01.azurewebsites.net/api/mcp';
const protocolVersion = '2026-07-28';
const expectedTools = ['get_usecase_details', 'hybrid_search_usecases', 'search_usecases', 'vector_search_usecases'];
const args = process.argv.slice(2);
const keyIndex = args.indexOf('--key-file');
const exercise = args.includes('--exercise');
let apiKey;
let requestId = 0;

async function rpc(method, params = {}) {
  const id = ++requestId;
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      'MCP-Protocol-Version': protocolVersion,
      'Mcp-Method': method,
      ...(params.name ? { 'Mcp-Name': params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id, method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': protocolVersion,
          'io.modelcontextprotocol/clientInfo': { name: 'aiusecasehub-connection-check', version: '1.0.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}. Check the personal key, credits and protocol compatibility.`);
  assert.match(response.headers.get('content-type') || '', /application\/json/, `${method}: expected JSON from this hosted service`);
  const message = await response.json();
  assert.equal(message.jsonrpc, '2.0');
  assert.equal(message.id, id);
  if (message.error) throw new Error(`${method}: JSON-RPC error ${message.error.code}`);
  assert.ok(message.result, `${method}: missing result`);
  return message.result;
}

async function callTool(name, arguments_, credits) {
  const result = await rpc('tools/call', { name, arguments: arguments_ });
  assert.equal(result.resultType, 'complete', `${name}: incomplete tool result`);
  if (result.isError) throw new Error(`${name}: tool reported an error. Check the account's available credits and service status.`);
  const text = result.content?.find(item => item.type === 'text')?.text;
  assert.equal(typeof text, 'string', `${name}: missing text payload`);
  const payload = JSON.parse(text);
  assert.equal(payload._mcp?.credits_used, credits, `${name}: unexpected credit charge`);
  return payload;
}

try {
  if (keyIndex >= 0 && (!args[keyIndex + 1] || args[keyIndex + 1].startsWith('--'))) {
    throw new Error('--key-file requires a path to a text file containing the personal API key.');
  }
  apiKey = keyIndex >= 0 ? readFileSync(args[keyIndex + 1], 'utf8').trim() : process.env.AIUSECASEHUB_API_KEY?.trim();
  if (keyIndex >= 0 && !apiKey) throw new Error('The API key file is empty. Omit --key-file to use the public preview.');
  if (apiKey && /[\r\n]/.test(apiKey)) throw new Error('Provide one personal API key via --key-file or AIUSECASEHUB_API_KEY.');
  const discovery = await rpc('server/discover');
  assert.ok(discovery.supportedVersions?.includes(protocolVersion), 'Server did not advertise the expected protocol');
  const list = await rpc('tools/list');
  const tools = list.tools.map(tool => tool.name).sort();
  assert.deepEqual(tools, expectedTools, 'Tool catalog differs from the published four-tool contract');
  const report = { endpoint, protocolVersion, discovery: 'passed', tools, exercised: false, creditsUsed: 0 };
  if (exercise) {
    const search = await callTool('search_usecases', { search_term: 'AI customer service', limit: apiKey ? 1 : 20 }, apiKey ? 2 : 0);
    assert.ok(Array.isArray(search.items) && search.items.length > 0, 'Search returned no case to look up');
    assert.ok(search.dataSnapshot, 'Search omitted its data snapshot');
    const rowKey = search.items[0].RowKey;
    assert.equal(typeof rowKey, 'string', 'Search omitted RowKey');
    if (!apiKey) {
      assert.ok(search.items.length <= 3, 'Public search exceeded its result cap');
      assert.equal(search._mcp.access_mode, 'public_preview');
      assert.ok(search.items.every(item => !item.Description || item.Description.length <= 360));
    }
    const details = await callTool('get_usecase_details', { row_key: rowKey }, apiKey ? 1 : 0);
    assert.ok(Object.keys(details).some(key => key !== '_mcp'), 'Detail lookup returned no case data');
    if (!apiKey) assert.ok(!('ArchitectureDescription' in details), 'Public detail leaked full analysis');
    Object.assign(report, { accessMode: apiKey ? 'personal_key' : 'public_preview', exercised: true, search: 'passed', detailLookup: 'passed', creditsUsed: apiKey ? 3 : 0 });
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // No response bodies, headers, environment variables or credentials are logged.
  let message = error instanceof Error ? error.message : 'Connection check failed';
  if (apiKey) message = message.replaceAll(apiKey, '[redacted]');
  console.error(message);
  process.exitCode = 1;
}
