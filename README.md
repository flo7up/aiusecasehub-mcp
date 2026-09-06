# AIUseCaseHub MCP

Search source-linked enterprise AI deployments from your agent. Find examples by company, industry, technology, cloud provider and reported outcomes, then retrieve the underlying case for evidence and context.

[Website](https://www.aiusecasehub.com) · [MCP documentation](https://www.aiusecasehub.com/developer-mcp) · [Get an API key](https://www.aiusecasehub.com/developer-api) · [Official registry record](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.flo7up%2Faiusecasehub/versions/latest)

This repository contains the hosted service's integration examples and registry metadata. Connect to the existing endpoint; no server installation, hosting account or npm package is required.

## Connect

1. Choose a client supporting **Streamable HTTP**.
2. Add the endpoint below with **no authentication** to try the public preview. No registration or key is needed.
3. For full results, sign in to [AIUseCaseHub's API page](https://www.aiusecasehub.com/developer-api), generate a personal key and send it as `X-API-Key`.

```text
https://basic-backend713-dsd8hygyfkc8d8f5.swedencentral-01.azurewebsites.net/api/mcp
```

Public preview configuration for clients using an `mcpServers` map:

```json
{
  "mcpServers": {
    "aiusecasehub": {
      "url": "https://basic-backend713-dsd8hygyfkc8d8f5.swedencentral-01.azurewebsites.net/api/mcp"
    }
  }
}
```

Optional full-access configuration:

```json
{
  "mcpServers": {
    "aiusecasehub": {
      "url": "https://basic-backend713-dsd8hygyfkc8d8f5.swedencentral-01.azurewebsites.net/api/mcp",
      "headers": {
        "X-API-Key": "<YOUR_PERSONAL_API_KEY>"
      }
    }
  }
}
```

Use your client's secret storage or environment-variable support for personal keys. Omit the entire authentication header for a free preview; an empty or invalid key remains an authentication error. Configuration formats vary by client.

The service supports the [July 2026 stateless protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) and the older initialization handshake over Streamable HTTP (`2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`). Current clients send request metadata on each POST; older clients negotiate through `initialize`. The direct endpoint offers an anonymous preview and optional personal API-key authentication.

## Free preview and full access

| | Public preview | Personal API key |
| --- | --- | --- |
| Registration | Not required | Required |
| Search results | Up to 3 | Up to 20 |
| Case content | Source/context fields; descriptions up to 360 characters | Full published case data |
| Tool-call credits | 0 | 2 per search; 1 per detail lookup |
| Preview allowance | 10 tool-call attempts per IP per UTC hour | Does not consume the preview allowance |

The anonymous service has a shared budget of 200 tool-call attempts per UTC hour. The limits are stored centrally and remain effective across workers and restarts. Shared gateways may share an IP allowance. Discovery and tool listing do not consume it. Rate-limit errors include retry guidance and a link to full access; a storage failure closes the preview temporarily instead of allowing unlimited calls.

## Four tools

| Tool | Use | Required argument | Credits with a personal key |
| --- | --- | --- | ---: |
| `search_usecases` | General natural-language search with hybrid ranking | `search_term` | 2 |
| `hybrid_search_usecases` | Hybrid search with company, industry, geography, provider and technology filters | `query` | 2 |
| `vector_search_usecases` | Semantic similarity search | `query` | 2 |
| `get_usecase_details` | Retrieve a case returned by search | `row_key` | 1 |

Search tools accept `limit` from 1 to 20, capped at 3 for public previews. Hybrid search also supports `industry`, `country`, `technologies_used`, `cloud_provider`, `customer_name`, `partner_name`, and boolean case-type filters such as `isAgentCase` and `isRag`. See the [complete tool reference](https://www.aiusecasehub.com/developer-docs).

Search payloads include `items`, `total`, `searchMode`, `dataSnapshot`, and `_mcp` credit metadata. Pass an item's `RowKey` to `get_usecase_details`. Parse the MCP text content as JSON; use the source links and evidence fields when interpreting reported outcomes. A deployment example is not a guarantee of the same results elsewhere.

Example prompts:

- Find AI deployments in insurance that report measurable claims-processing outcomes. Retrieve the most relevant cases and cite their sources.
- Find manufacturing examples using retrieval-augmented generation, and compare their implementation approaches.
- Search for a company's AI deployments, retrieve the supporting case records, and separate reported outcomes from missing evidence.

## Verify your connection

The included Node.js 20+ script uses built-in APIs and needs no package installation. By default it uses the anonymous preview. For full access it reads a personal key from a local text file or the `AIUSECASEHUB_API_KEY` environment variable. It never prints the key.

```powershell
# Free discovery and all four tool definitions.
node examples/verify-connection.mjs

# Free search and abbreviated detail lookup; uses 2 preview attempts.
node examples/verify-connection.mjs --exercise

# Discovery and tool listing only; no tool-call credits are consumed.
node examples/verify-connection.mjs --key-file 'C:\private\aiusecasehub-key.txt'

# One search followed by one detail lookup: 3 credits on successful completion.
node examples/verify-connection.mjs --key-file 'C:\private\aiusecasehub-key.txt' --exercise
```

The script verifies all four tool names and stops on HTTP, protocol or tool errors. Its output describes the checks actually completed; it does not imply that a different client or gateway was tested.

## Registry metadata

[Glama also lists the hosted connector](https://glama.ai/mcp/connectors/io.github.flo7up/aiusecasehub), with a Healthy status and all four tools verified on September 6, 2026.

The service is also [listed on Smithery](https://smithery.ai/servers/flo7up/aiusecasehub). Its optional configuration collects each user's personal AIUseCaseHub key; leave it unset for the preview. A public-preview search and detail lookup through Smithery's connection API were verified on September 6, 2026.

Smithery CLI 1.2.0 currently defaults to a gateway address that returned 404 during verification. If affected, use Smithery's documented API base for connections in the current PowerShell session:

```powershell
$env:SMITHERY_CONNECT_BASE_URL = 'https://api.smithery.ai/connect'
smithery mcp add flo7up/aiusecasehub --id aiusecasehub
smithery tool list aiusecasehub
```

Smithery requires its own sign-in for gateway connections. Connecting directly to the hosted endpoint above requires no account for the preview.

The official MCP Registry name is **`io.github.flo7up/aiusecasehub`**, version **`1.1.1`**. `server.json` declares an optional secret header without embedding a credential.

`smithery-config.json` declares the optional personal API-key header for Smithery's configuration UI. Free previews use no key; full-access users supply their own. Publication and working connections are verified separately.

## Credits, data and support

With a personal key, successful searches cost 2 credits and detail lookups cost 1. The public preview, discovery and listing do not deduct credits. The response's `_mcp` object describes preview limits or reports credits used and remaining. Account allowances and purchases are managed on the [API page](https://www.aiusecasehub.com/developer-api).

[Methodology](https://www.aiusecasehub.com/methodology) · [Privacy](https://www.aiusecasehub.com/privacy-policy) · [Terms](https://www.aiusecasehub.com/terms) · [Report an integration issue](https://github.com/flo7up/aiusecasehub-mcp/issues)
