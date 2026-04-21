---
name: sql-server-dev
description: Use when the user wants to run SQL queries against the dev SQL Server database on the Parallels Windows VM from the Mac host.
---

# SQL Server dev

Use `sqlcmd` from the Mac with the connection details from `~/.secrets`.

## Prerequisites

```bash
command -v sqlcmd || brew install sqlcmd
source ~/.secrets
```

## Quick check

```bash
sqlcmd \
  -S "tcp:${SQL_SERVER_DEV_HOST},${SQL_SERVER_DEV_PORT}" \
  -U "$SQL_SERVER_DEV_USER" \
  -P "$SQL_SERVER_DEV_PASSWORD" \
  -d "$SQL_SERVER_DEV_DATABASE" \
  -Q "SELECT @@SERVERNAME AS server_name, DB_NAME() AS database_name"
```

## Run a query

```bash
sqlcmd \
  -S "tcp:${SQL_SERVER_DEV_HOST},${SQL_SERVER_DEV_PORT}" \
  -U "$SQL_SERVER_DEV_USER" \
  -P "$SQL_SERVER_DEV_PASSWORD" \
  -d "$SQL_SERVER_DEV_DATABASE" \
  -Q "SELECT TOP 10 * FROM dbo.YourTable"
```

## Run a script file

```bash
sqlcmd \
  -S "tcp:${SQL_SERVER_DEV_HOST},${SQL_SERVER_DEV_PORT}" \
  -U "$SQL_SERVER_DEV_USER" \
  -P "$SQL_SERVER_DEV_PASSWORD" \
  -d "$SQL_SERVER_DEV_DATABASE" \
  -i ./script.sql
```

## Notes

- This uses SQL auth, not Windows integrated auth.
- The VM is currently reachable at `10.211.55.3:1433` from the Mac host.
- If the VM IP changes after a restart, update `~/.secrets`.
