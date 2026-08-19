---
name: porkbun
description: Use when working with the Porkbun API or a Porkbun-registered domain — DNS records, nameservers, URL forwarding, SSL bundles, DNSSEC, domain availability/registration/renewal. Covers auth, request and response shape, the quirks that bite, and safe-write patterns.
---

# Porkbun API

Porkbun is where Herb's domains are registered, including `herbcaudill.com`. The API is a plain JSON-over-HTTPS interface — no SDK needed, `fetch` or `curl` is enough.

Base URL: `https://api.porkbun.com/api/json/v3`
Current version: 3.15 (every response carries an `X-API-Version` header; the path stays `/v3`)

## Official docs

Porkbun publishes agent-readable docs. Fetch these rather than guessing at an endpoint — they're the source of truth and they change:

| URL                                    | What it is                                       |
| -------------------------------------- | ------------------------------------------------ |
| `https://porkbun.com/llms-full.txt`    | Every endpoint, parameter, and example, one file |
| `https://porkbun.com/llms.txt`         | Short orientation and key-endpoint list          |
| `https://porkbun.com/llms`             | Per-topic index (`/llms/dns`, `/llms/domain`, …) |
| `https://porkbun.com/llms/guides`      | Task walkthroughs (dynamic DNS, registration, …) |
| `https://porkbun.com/api/json/v3/spec` | OpenAPI 3.0 spec                                 |

The flat reference is large (~130KB), so prefer the per-topic page — `https://porkbun.com/llms/dns` covers all DNS and DNSSEC endpoints in about 17KB.

## Credentials

`~/.secrets` holds `PORKBUN_API_KEY` (public, `pk1_…`) and `PORKBUN_SECRET_KEY` (secret, `sk1_…`). Source it before running anything that talks to the API:

```bash
source ~/.secrets
```

Never print key values.

Manage keys at https://porkbun.com/account/api. Keys work whether or not account 2FA is on, and each key can be scoped to specific source IPs and specific domains, which is the right move for anything unattended.

## Request shape

Everything is `POST` with a JSON body containing the credentials plus endpoint fields. Reads also accept `GET` with header auth.

```bash
curl -sX POST https://api.porkbun.com/api/json/v3/dns/retrieve/herbcaudill.com \
  -H 'Content-Type: application/json' \
  -d "{\"apikey\":\"$PORKBUN_API_KEY\",\"secretapikey\":\"$PORKBUN_SECRET_KEY\"}"
```

Header auth is cleaner and works with `GET`, but it only takes effect when there are no body credentials:

```bash
curl -s https://api.porkbun.com/api/json/v3/dns/retrieve/herbcaudill.com \
  -H "X-API-Key: $PORKBUN_API_KEY" -H "X-Secret-API-Key: $PORKBUN_SECRET_KEY"
```

The domain is nearly always a **path** segment, not a body field.

## Quirks that will bite you

These are the ones worth internalizing:

- **HTTP 200 doesn't mean success.** Check `json.status === "SUCCESS"`. Errors carry a stable `code` and usually a `next_action` object; branch on `code`, never on `message`.
- **API access is opt-in per domain.** A domain has to have API access enabled in the dashboard before any call touching it works. `apiAccess: 1` in `/domain/listAll` tells you which ones do.
- **`name` is asymmetric.** You _write_ the bare subdomain (`www`, `*`, or empty for the root), but reads come back with the full FQDN (`www.herbcaudill.com`). Code that round-trips a record has to account for that.
- **Numbers come back as strings.** `id`, `ttl`, and `prio` are strings in responses and integers in requests.
- **The secret field is `secretapikey`**, not `secretkey` — the single most common auth failure.
- **`editByNameType` / `deleteByNameType` hit _every_ matching record**, not just one. Use the by-ID variants when you mean exactly one.
- **`dns/retrieve` hides SOA and Porkbun's default NS records.** They're there, just not editable.
- **Minimum TTL is 600s** (account-dependent). Passing `0` or omitting it means "account minimum".
- **`checkDomain` is rate limited to about 1 call per 10 seconds** per account. A 429 carries `Retry-After`.

## Safe writes

Three mechanisms, all worth using for anything destructive or billable:

**`dryRun: true`** rehearses a write and returns `wouldSucceed` without mutating. Works on DNS record writes, nameserver updates, and the billable domain operations (where it also returns `cost`, `balance`, and `sufficientFunds`).

**`Idempotency-Key: <unique string>`** header on any POST. A retry within 24h replays the original response instead of acting twice. Same key with a different body returns 409 `IDEMPOTENCY_KEY_MISMATCH`.

**Sandbox keys** (`pk1_sb_` / `sk1_sb_`) run the whole API against an isolated environment with fake credit — same base URL, just swap the key. Responses include `"sandbox": true`. Get one instantly with `POST /apikey/request` `{"sandbox": true}`; no account needed.

To learn a response shape with no credentials at all, use the mock server: `GET https://api.porkbun.com/api/json/v3/mock/<path>` (append `?status=error` for the error shape, or hit `/mock` for the list).

## Endpoints you'll actually use

**Sanity check** — `POST /ping` returns your public IP and `credentialsValid: true`. Start here when auth is misbehaving.

**DNS**

| Endpoint                                                 | Purpose                                 |
| -------------------------------------------------------- | --------------------------------------- |
| `GET/POST /dns/retrieve/{domain}`                        | All editable records                    |
| `GET/POST /dns/retrieve/{domain}/{id}`                   | One record by ID                        |
| `GET/POST /dns/retrieveByNameType/{domain}/{type}/{sub}` | Records matching a subdomain and type   |
| `POST /dns/create/{domain}`                              | Create; returns `id`                    |
| `POST /dns/edit/{domain}/{id}`                           | Edit one record                         |
| `POST /dns/editByNameType/{domain}/{type}/{sub}`         | Replace content on all matching records |
| `POST /dns/delete/{domain}/{id}`                         | Delete one record                       |
| `POST /dns/deleteByNameType/{domain}/{type}/{sub}`       | Delete all matching records             |

Create/edit body: `name` (bare subdomain, optional), `type` (required), `content` (required), `ttl`, `prio`, `notes`. Supported types include A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, TLSA, SSHFP, ALIAS, HTTPS, SVCB.

Leave the `{sub}` path segment off entirely to target the root domain.

**Domains** — `GET/POST /domain/listAll` (filters: `tlds[]`, `expiringWithinDays`, `autoRenew`, `apiAccess`, `nameContains`), `GET /domain/get/{domain}`, `POST /domain/checkDomain/{domain}` for availability and price, `POST /domain/create|renew|transfer/{domain}`, `POST /domain/updateAutoRenew/{domain}`.

**Nameservers** — `GET/POST /domain/getNs/{domain}`, `POST /domain/updateNs/{domain}` with `{"ns": ["ns1…", "ns2…"]}`. Pointing nameservers away from Porkbun disables Porkbun DNS for that domain.

**URL forwarding** — `GET/POST /domain/getUrlForwarding/{domain}`, `POST /domain/addUrlForward/{domain}` (`subdomain`, `location`, `type` = permanent/temporary/masked, `includePath`, `wildcard`), `POST /domain/deleteUrlForward/{domain}/{id}`.

**SSL** — `GET/POST /ssl/retrieve/{domain}` returns the free Let's Encrypt bundle as `certificatechain`, `privatekey`, `publickey`. Treat the private key as a secret.

**DNSSEC** — `getDnssecRecords`, `createDnssecRecord` (`keyTag`, `alg`, `digestType`, `digest`), `deleteDnssecRecord/{domain}/{keytag}`.

## A reusable client

Prefer TypeScript over bash for anything beyond a one-off call:

```ts
const API = "https://api.porkbun.com/api/json/v3"

/** A DNS record as returned by the API — note that all numeric fields are strings. */
export type DnsRecord = {
  id: string
  /** Full FQDN on read, e.g. `www.herbcaudill.com` */
  name: string
  type: string
  content: string
  ttl: string
  prio: string
  notes: string
}

/** Call a Porkbun endpoint, throwing on any non-SUCCESS response. */
export const porkbun = async <T>(
  /** Path below the v3 base, e.g. `/dns/retrieve/herbcaudill.com` */
  path: string,
  /** Endpoint-specific fields; credentials are added automatically */
  body: Record<string, unknown> = {},
): Promise<T> => {
  const apikey = process.env.PORKBUN_API_KEY
  const secretapikey = process.env.PORKBUN_SECRET_KEY
  if (!apikey || !secretapikey) throw new Error("Missing PORKBUN_API_KEY or PORKBUN_SECRET_KEY")

  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey, secretapikey, ...body }),
  })

  const json = (await res.json()) as { status: string; message?: string; code?: string }
  if (json.status !== "SUCCESS") {
    throw new Error(
      `Porkbun ${path} failed: ${json.code ?? res.status} — ${json.message ?? "unknown error"}`,
    )
  }
  return json as T
}
```

Upserting a record is the most common operation, and it's the one place the FQDN asymmetry matters:

```ts
/** Create or update a single record, matching on subdomain and type. */
export const upsertRecord = async (domain: string, name: string, type: string, content: string) => {
  const { records } = await porkbun<{ records: DnsRecord[] }>(`/dns/retrieve/${domain}`)
  const fqdn = name ? `${name}.${domain}` : domain
  const existing = records.find(r => r.name === fqdn && r.type === type)

  if (existing?.content === content) return "unchanged"
  if (existing) {
    await porkbun(`/dns/edit/${domain}/${existing.id}`, { name, type, content })
    return "updated"
  }
  await porkbun(`/dns/create/${domain}`, { name, type, content })
  return "created"
}
```

## Error codes

`INVALID_API_KEYS_001` (bad key pair), `MISSING_SECRETAPIKEY` (usually a misnamed field), `IP_NOT_ALLOWED` / `DOMAIN_NOT_ALLOWED` (key scoping), `INVALID_DOMAIN` (not in your account, or API access not enabled), `INVALID_RECORD_ID`, `INVALID_TYPE`, `RATE_LIMIT_EXCEEDED` (429, honor `Retry-After`), `INSUFFICIENT_FUNDS`, `IDEMPOTENCY_KEY_MISMATCH` / `IDEMPOTENCY_KEY_IN_USE`.

## Related

The `deploy` skill uses this API to point a `*.herbcaudill.com` CNAME at Vercel; see `skills/deploy/setup-vercel-domain.ts` for a worked example.

Porkbun also ships a first-party MCP server (`npx -y @porkbunllc/mcp-server`) if tool-calling is preferable to raw HTTP, but for scripted work the plain API is simpler and has no setup.
