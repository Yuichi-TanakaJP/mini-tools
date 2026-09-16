"""PostgreSQL integration regressions using ONLY synthetic data.

Run with PGHOST=127.0.0.1 PGDATABASE=origin_followup_test and psql on PATH.
This test deliberately refuses a different DB or non-loopback host. It creates
fixture tables, not a production bootstrap, and needs no Python dependency.
"""
from __future__ import annotations
import copy
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
APPLY = (ROOT / 'operations/apply_origin_followup.sql').read_text()
VERIFY = (ROOT / 'operations/verify_origin_followup.sql').read_text()
BATCH = 'origin-followup-583-588-v1'
TABLES = ['registry.external_resources', 'knowledge.items', 'knowledge.evolution_events',
          'knowledge.item_products', 'knowledge.item_resources', 'knowledge.evolution_event_products',
          'knowledge.evolution_event_resources', 'knowledge.evolution_event_items', 'registry.product_relations',
          'registry.products', 'registry.product_functions', 'registry.product_capabilities',
          'flow.value_flows', 'flow.flow_versions', 'flow.flow_steps', 'flow.flow_edges']


def sql_literal(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def psql(sql: str) -> str:
    env = os.environ.copy()
    if env.get('PGHOST') not in ('127.0.0.1', 'localhost') or env.get('PGDATABASE') != 'origin_followup_test':
        raise RuntimeError('Tests require loopback origin_followup_test; no production connection allowed')
    result = subprocess.run(['psql', '-X', '-w', '-At', '-v', 'ON_ERROR_STOP=1'],
                            input=sql, text=True, capture_output=True, timeout=60, env=env)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout


def fixture_manifest() -> dict:
    sha = '0' * 40
    resources = [dict(key=f'r{n}', system='github', external_id=f'fixture:{n}', type='test_fixture',
                      title=f'fixture {n}', url=None, summary='synthetic only', metadata={'fixture': True})
                 for n in range(1, 9)]
    resources[-1].update(type='github_commit', url=f'https://github.com/example/fixture/commit/{sha}',
                         metadata={'fixture': True, 'commit_sha': sha, 'evidence_path': 'README.md'})
    products = [[['todo-app', 'informs']], [['todo-app', 'informs']], [], [],
                [['test-antigravity', 'informs']], [['test-antigravity', 'informs'], ['sensoria-portfolio', 'informs']],
                [['test-antigravity', 'informs']], [['test-antigravity', 'informs'], ['sensoria-portfolio', 'informs']]]
    items = [dict(key=f'fixture-item-{n}', kind='pattern' if n in (2, 8) else 'goal', title=f'item {n}',
                  statement='synthetic statement', status='provisional' if n in (2, 8) else 'confirmed',
                  source='test-fixture', confidence=0.7 if n in (2, 8) else 1,
                  metadata={'claim_type': 'user_report', 'scope': 'workspace' if n in (3, 4) else 'product'},
                  products=products[n-1], resources=[f'r{n}'] + (['r4'] if n == 3 else []))
             for n in range(1, 9)]
    ep = [[['todo-app', 'subject']], [], [], [['test-antigravity', 'subject']],
          [['sensoria-portfolio', 'result'], ['test-antigravity', 'context']],
          [['test-antigravity', 'subject'], ['sensoria-portfolio', 'context']]]
    ei = [[[1, 'cause'], [2, 'context']], [[4, 'context']], [[3, 'subject'], [4, 'context']],
          [[5, 'context'], [6, 'context']], [[8, 'context']], [[8, 'context']]]
    events = [dict(key=f'event-{n}', type='milestone', title=f'fixture event {n}', summary='synthetic event',
                   start=None if n in (2, 3) else '2025-06-01',
                   end=None if n in (2, 3) else ('2025-06-30' if n == 1 else '2025-06-01'),
                   precision='unknown' if n in (2, 3) else ('month' if n == 1 else 'day'),
                   source='test-fixture', metadata={'time_basis': 'fixture, not historical evidence'},
                   products=ep[n-1], items=[[f'fixture-item-{i}', role] for i, role in ei[n-1]],
                   resources=[f'r{n}'] + (['r8'] if n in (1, 2, 3, 5) else [])) for n in range(1, 7)]
    return dict(version=1, batch=BATCH, resources=resources, items=items, events=events,
                predecessor_evidence_url=f'https://github.com/example/fixture/blob/{sha}/README.md')


def configure(m: dict, checksum: str | None = None) -> str:
    value = sql_literal(json.dumps(m, ensure_ascii=True)) + '::jsonb'
    expected = f'md5(({value})::text)' if checksum is None else sql_literal(checksum)
    return (f"select set_config('workspace_core.origin_followup_manifest',({value})::text,true);\n"
            f"select set_config('workspace_core.origin_followup_expected_md5',{expected},true);\n")


def fingerprint() -> str:
    parts = [f"'{t}',(select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from {t} x)" for t in TABLES]
    return 'select md5(jsonb_build_object(' + ','.join(parts) + ')::text)'


def fixture_schema() -> str:
    # Minimal structural fixture for the exercised columns, keys and FK paths.
    # Not labelled as a fresh replay of Workspace Core migrations.
    audit = 'created_at timestamptz not null default now(), updated_at timestamptz not null default now()'
    sql = """do $$ begin if current_database()<>'origin_followup_test' then raise exception 'wrong test db'; end if; end $$;
create schema platform; create schema registry; create schema knowledge; create schema flow;
create table platform.source_systems(id uuid primary key default gen_random_uuid(),code text unique not null);
insert into platform.source_systems(code) values('github'),('supabase');
create table registry.products(id uuid primary key default gen_random_uuid(),slug text unique not null,lifecycle_status text,importance int);
insert into registry.products(slug,lifecycle_status,importance) values('todo-app','active',2),('test-antigravity','archived',0),('sensoria-portfolio','active',2);
"""
    sql += f"create table registry.external_resources(id uuid primary key default gen_random_uuid(),source_system_id uuid references platform.source_systems(id),external_id text,resource_type text,title text,url text,summary text,status text,metadata jsonb not null default '{{}}', {audit},unique(source_system_id,external_id,resource_type));\n"
    sql += f"create table knowledge.items(id uuid primary key default gen_random_uuid(),canonical_key text unique,kind text,title text,statement text,lifecycle_status text,verification_status text,source text,confidence numeric,verified_at timestamptz,metadata jsonb not null default '{{}}', {audit});\n"
    sql += f"create table knowledge.evolution_events(id uuid primary key default gen_random_uuid(),event_type text,title text,summary text,period_start date,period_end date,time_precision text,verification_status text,source text,confidence numeric,verified_at timestamptz,metadata jsonb not null default '{{}}', {audit});\n"
    sql += "create unique index event_natural on knowledge.evolution_events(event_type,title,coalesce(period_start,'0001-01-01'::date),coalesce(period_end,'0001-01-01'::date));\n"
    for table, owner, target, target_table, relation, has_updated in [
        ('knowledge.item_products','item','product','registry.products','relation_type',True),
        ('knowledge.item_resources','item','resource','registry.external_resources','relation_type',True),
        ('knowledge.evolution_event_products','event','product','registry.products','role',False),
        ('knowledge.evolution_event_items','event','item','knowledge.items','role',False)]:
        owner_table = 'knowledge.items' if owner == 'item' else 'knowledge.evolution_events'
        times = audit if has_updated else 'created_at timestamptz not null default now()'
        sql += f"create table {table}({owner}_id uuid references {owner_table}(id) on delete cascade,{target}_id uuid references {target_table}(id) on delete cascade,{relation} text,source text,confidence numeric,verified_at timestamptz,notes text,{times},primary key({owner}_id,{target}_id,{relation}));\n"
    sql += "create table knowledge.evolution_event_resources(event_id uuid references knowledge.evolution_events(id) on delete cascade,resource_id uuid references registry.external_resources(id),relation_type text,notes text,created_at timestamptz not null default now(),primary key(event_id,resource_id,relation_type));\n"
    sql += f"create table registry.product_relations(source_product_id uuid references registry.products(id),target_product_id uuid references registry.products(id),relation_type text,source text,confidence numeric,verified_at timestamptz,notes text,{audit},primary key(source_product_id,target_product_id,relation_type));\n"
    for t in TABLES[10:]:
        sql += f"create table {t}(id int primary key,payload text); insert into {t} values(1,'must not change');\n"
    return sql


M = fixture_manifest()
I1 = "item_id=(select id from knowledge.items where canonical_key='fixture-item-1')"
E1 = "event_id=(select id from knowledge.evolution_events where title='fixture event 1')"
# Each corruption is isolated in an outer ROLLBACK. Both entrypoints must reject
# conflicts; their failure is caught in a subtransaction and must leave no writes.
CORRUPTIONS = {
    'item_claim_unchanged_hash': "update knowledge.items set metadata=jsonb_set(metadata,'{claim_type}','\"wrong\"') where canonical_key='fixture-item-1';",
    'event_time_unchanged_hash': "update knowledge.evolution_events set metadata=jsonb_set(metadata,'{time_basis}','\"wrong\"') where title='fixture event 1';",
    'resource_metadata_unchanged_hash': "update registry.external_resources set metadata=metadata||'{\"fixture\":false}' where external_id='fixture:1';",
    'extra_metadata_key': "update knowledge.items set metadata=metadata||'{\"extra\":true}' where canonical_key='fixture-item-1';",
    'item_confidence': f'update knowledge.item_products set confidence=0.5 where {I1};',
    'item_source': f"update knowledge.item_products set source='different' where {I1};",
    'item_verified_null': f'update knowledge.item_products set verified_at=null where {I1};',
    'item_notes': f"update knowledge.item_products set notes='different' where {I1};",
    'item_evidence_notes': f"update knowledge.item_resources set notes='different' where {I1};",
    'event_product_confidence': f'update knowledge.evolution_event_products set confidence=0.5 where {E1};',
    'event_item_source': f"update knowledge.evolution_event_items set source='different' where {E1};",
    'event_evidence_notes': f"update knowledge.evolution_event_resources set notes='different' where {E1};",
    'predecessor_notes': "update registry.product_relations set notes='different';",
    'predecessor_confidence': 'update registry.product_relations set confidence=0.5;',
    'predecessor_verified_null': 'update registry.product_relations set verified_at=null;',
    'wrong_target_same_count': f"update knowledge.item_products set product_id=(select id from registry.products where slug='sensoria-portfolio') where {I1};",
    'extra_foreign_source': f"insert into knowledge.item_products select item_id,(select id from registry.products where slug='sensoria-portfolio'),relation_type,'different',confidence,verified_at,notes,created_at,updated_at from knowledge.item_products where {I1};",
    'earlier_insert_rolled_back': "update knowledge.items set metadata=metadata||'{\"claim_type\":\"wrong\"}' where canonical_key='fixture-item-1'; delete from knowledge.item_resources where resource_id=(select id from registry.external_resources where external_id='fixture:7'); delete from registry.external_resources where external_id='fixture:7';",
}


class ReplayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        psql(fixture_schema())
        psql('begin isolation level repeatable read;\n'+configure(M)+APPLY+VERIFY+'commit;')

    def assert_rejected(self, operation: str, mutation: str = '', manifest: dict | None = None,
                        checksum: str | None = None, missing_row: bool = False):
        sql = 'begin isolation level repeatable read;\n' + configure(M if manifest is None else manifest, checksum) + mutation
        accepted_state = "sqlstate='P0002'" if missing_row else "sqlstate='P0001' and sqlerrm like 'origin follow-up:%'"
        sql += f"""do $case$ declare before_hash text; after_hash text; rejected boolean:=false; begin
{fingerprint()} into before_hash;
begin execute {sql_literal(operation)};
exception when others then if not ({accepted_state}) then raise; end if; rejected:=true; end;
if not rejected then raise exception 'expected rejection'; end if;
{fingerprint()} into after_hash;
if before_hash is distinct from after_hash then raise exception 'failed operation wrote data'; end if;
end $case$; rollback;"""
        psql(sql)

    def test_independent_replay_preserves_all_rows_and_timestamps(self):
        sql = 'begin isolation level repeatable read;\n'+configure(M)
        sql += f"""do $case$ declare a text; z text; begin
{fingerprint()} into a; execute {sql_literal(APPLY)}; execute {sql_literal(VERIFY)};
{fingerprint()} into z; if a is distinct from z then raise exception 'replay changed committed rows'; end if;
end $case$; rollback;"""
        psql(sql)

    def test_shared_verifier_is_identical(self):
        def shared(s): return s.split('-- BEGIN SHARED ACCEPTANCE\n',1)[1].split('\n-- END SHARED ACCEPTANCE',1)[0]
        self.assertEqual(shared(APPLY),shared(VERIFY))

    def test_verifier_detects_missing_link(self):
        self.assert_rejected(VERIFY, f'delete from knowledge.item_products where {I1};')

    def test_verifier_detects_missing_item(self):
        self.assert_rejected(VERIFY, "delete from knowledge.items where canonical_key='fixture-item-2';",missing_row=True)

    def test_missing_checksum(self): self.assert_rejected(APPLY, checksum='')
    def test_wrong_checksum(self): self.assert_rejected(APPLY, checksum='0'*32)


for name, mutation in CORRUPTIONS.items():
    for entry, code in [('apply',APPLY),('verify',VERIFY)]:
        def case(self, mutation=mutation, code=code): self.assert_rejected(code,mutation)
        setattr(ReplayTest,f'test_{entry}_{name}',case)
for name, value in [('absent',None),('empty',''),('space','  '),('wrong_resource','https://github.com/example/other/blob/'+'1'*40+'/README.md')]:
    def case(self,value=value,name=name):
        m=copy.deepcopy(M)
        if name=='absent': del m['predecessor_evidence_url']
        else: m['predecessor_evidence_url']=value
        self.assert_rejected(APPLY,manifest=m)
    setattr(ReplayTest,f'test_evidence_url_{name}',case)

if __name__=='__main__': unittest.main(verbosity=2)
