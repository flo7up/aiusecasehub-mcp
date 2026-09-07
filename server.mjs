#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

// This adapter exposes the real hosted tools. No case data or backend code is bundled.
const endpoint = 'https://basic-backend713-dsd8hygyfkc8d8f5.swedencentral-01.azurewebsites.net/api/mcp';
const proxy = new URL('./node_modules/mcp-remote/dist/proxy.js', import.meta.url);
const args = [endpoint, '--transport', 'http-only', '--silent'];

if (Object.hasOwn(process.env, 'AIUSECASEHUB_API_KEY')) {
  const key = process.env.AIUSECASEHUB_API_KEY;
  if (!key.trim() || /[\r\n]/.test(key)) {
    console.error('AIUSECASEHUB_API_KEY must contain one non-empty key. Unset it for the public preview.');
    process.exit(1);
  }
  // mcp-remote expands the environment placeholder; the secret is never a CLI argument.
  args.push('--header', 'X-API-Key:${AIUSECASEHUB_API_KEY}');
}

process.argv = [process.execPath, fileURLToPath(proxy), ...args];
await import(proxy.href);
