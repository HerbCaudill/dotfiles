---
name: cloudflare
description: Use for DNS records on domains whose DNS is on Cloudflare, including devresults.com. Look up, add, change or remove records through the API.
---

# Cloudflare DNS

`devresults.com` DNS is on Cloudflare (nameservers `*.ns.cloudflare.com`). Domains registered at Porkbun with Porkbun DNS use the `porkbun` skill instead; `dig +short <domain> NS` tells you which.

`~/.secrets` holds `CLOUDFLARE_API_TOKEN`, a user API token named "Agents DNS (Herb's Mac)" with **Zone → DNS → Edit** and **Zone → Zone → Read** on all zones. It cannot change zone settings, SSL, Workers or anything else. Manage it at https://dash.cloudflare.com/profile/api-tokens; if it is lost or leaked, roll it there and replace the line in `~/.secrets`. Never print it, and pass it on stdin rather than in a command's arguments:

```sh
source ~/.secrets
cf() { printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN" | curl -s -H @- -H "Content-Type: application/json" "$@"; }
api=https://api.cloudflare.com/client/v4
zone=$(cf "$api/zones?name=devresults.com" | jq -r '.result[0].id')   # devresults.com: 3329a6ba04c0737369c5970bf91644f3
```

## Records

```sh
cf "$api/zones/$zone/dns_records?name=x3.devresults.com" | jq -c '.result[] | {id,type,name,content,proxied,ttl}'
cf -X POST  "$api/zones/$zone/dns_records" --data '{"type":"CNAME","name":"new.devresults.com","content":"target.example.com","proxied":false,"ttl":1,"comment":"what it is for"}'
cf -X PATCH "$api/zones/$zone/dns_records/<id>" --data '{"content":"other.example.com"}'
cf -X DELETE "$api/zones/$zone/dns_records/<id>"
```

Check `.success` and `.errors` on every response. `ttl: 1` means automatic. Leave a `comment` saying what the record serves.

- **Proxied (orange cloud) or not.** Keep `proxied: false` for hosts that get their own certificates (Caddy, Azure, Let's Encrypt HTTP-01) or carry WebSockets you don't want Cloudflare in front of. x3.devresults.com is DNS only.
- **Before changing or deleting a record,** read it and say what it points at now. A DNS change is outward-facing: name the record and the new target when you report it.
- **Verify** against a public resolver: `dig +short @1.1.1.1 <name>`. Cloudflare's own nameservers answer within seconds; other caches follow the old TTL.

## Known records

| Name | Points at | Serves |
| --- | --- | --- |
| `x3.devresults.com` | CNAME `x3-qf7dpqqe.eastus.cloudapp.azure.com` | x3's Azure VM (`DevResults/x3`, `infra/host`) |
