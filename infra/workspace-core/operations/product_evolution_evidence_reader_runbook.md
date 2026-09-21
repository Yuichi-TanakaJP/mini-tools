# Product Evolution Evidence reader runbook

This runbook owns the credential lifecycle for
`health_monitor_workspace_reader`. Database role/RLS policy belongs to Workspace
Core; the credential value belongs only in the Health Monitor OS Credential
Store.

Never paste the password or a DSN containing it into GitHub, chat, SQL files,
shell arguments, screenshots, logs, or committed configuration.

## Preconditions

1. PR #678 has passed independent review and been approved for the permission change.
2. `029_product_evolution_evidence_reader.sql` has been applied to Workspace Core.
3. `verify_product_evolution_evidence_reader.sql` passes as an administrative role.
4. Post-apply Supabase advisors show no new WARN/ERROR.

## Initial password and actual-login UAT

Use an administrative `psql` session and set the password interactively:

```text
\password health_monitor_workspace_reader
```

`\password` prompts without placing the cleartext password in the SQL or shell
history.

Before putting the DSN into Health Monitor, connect as the real principal. Do
not use `SET ROLE`; the UAT must load the principal's own role settings.

Use the project's real Pooler host from the Supabase connection settings:

```powershell
psql "host=<pooler-host> port=6543 dbname=postgres user=health_monitor_workspace_reader.<project-ref> sslmode=require" -W -f infra/workspace-core/operations/uat_product_evolution_evidence_reader.sql
```

The `-W` prompt asks for the password without putting it in the command line.
The UAT asserts:

- actual `session_user/current_user`
- `default_transaction_read_only=on`
- `transaction_read_only=on`
- `search_path=knowledge, pg_catalog`
- only active `product-evolution-review-*` rows are visible
- `statement` / `metadata` are denied
- INSERT / UPDATE / DELETE are denied
- another Knowledge table and Registry are denied

Only after that UAT passes, store the complete DSN on the Windows machine:

```powershell
uv run --directory core health-center credential set WORKSPACE_CORE_READ_DB_URL
```

The Health Monitor command prompts for the value and reads it back without
printing it. Then run the Routine Evidence refresh from the Health Monitor UI
and confirm the current month's Evidence becomes verified.

## Rotation

Because this reader opens short-lived connections only for explicit Evidence
refreshes, rotation uses a short fail-closed cutover:

1. In an administrative `psql` session, run
   `\password health_monitor_workspace_reader` and enter a new random password.
2. Run the actual-login UAT above with the new password.
3. Replace `WORKSPACE_CORE_READ_DB_URL` using Health Monitor
   `credential set`.
4. Run one Health Monitor Evidence refresh and confirm success.
5. If step 2-4 fails, fix the connection/credential immediately; the previous
   password no longer opens new sessions.

Do not keep the old password in a fallback file or environment variable.

## Emergency revoke

If the reader credential may be exposed, contain first and investigate second:

```sql
alter role health_monitor_workspace_reader nologin;
alter role health_monitor_workspace_reader password null;
revoke product_evolution_evidence_reader from health_monitor_workspace_reader;

select pg_terminate_backend(pid)
from pg_stat_activity
where usename = 'health_monitor_workspace_reader'
  and pid <> pg_backend_pid();
```

Then remove the local credential:

```powershell
uv run --directory core health-center credential delete WORKSPACE_CORE_READ_DB_URL
```

`NOLOGIN` blocks new sessions; terminating backends removes existing sessions;
revoking the capability removes inherited data access even if login is later
re-enabled accidentally.

## Recovery after emergency revoke

1. Re-run the privileged verification and inspect why containment was needed.
2. Restore only the intended membership:
   ```sql
   grant product_evolution_evidence_reader
     to health_monitor_workspace_reader
     with admin false, inherit true, set false;
   alter role health_monitor_workspace_reader login;
   ```
3. Set a fresh password interactively with `\password`.
4. Run the actual-login UAT.
5. Store the new DSN with Health Monitor `credential set`.
6. Run one Evidence refresh.
7. Record the incident/rotation without recording the secret.

## Responsibility boundary

- Workspace Core owner: role attributes, membership, RLS policies, grants,
  catalog verification, advisors, emergency database containment.
- Health Monitor owner: OS Credential Store value, Routine connection test,
  credential deletion/replacement.
- GitHub/PRs: procedure and non-secret verification evidence only.
