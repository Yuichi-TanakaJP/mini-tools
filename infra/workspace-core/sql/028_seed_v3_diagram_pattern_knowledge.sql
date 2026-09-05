-- Workspace Core V3 / reusable visual modeling knowledge
-- Captures the diagram-selection rule discovered during Product DB work.

begin;

insert into knowledge.items(canonical_key,kind,title,statement,lifecycle_status,verification_status,source,confidence,verified_at)
values
 ('diagram-pattern-system-landscape','pattern','System Landscape / System構成図','複数System・DB・外部Source・User Touchpointを役割Groupごとに配置し、中心Systemとの関係とData Flowを俯瞰する。一直線Pipelineではなく構造・責務・境界を見せたいときのDefault。','active','confirmed','user-confirmed',1.000,now()),
 ('diagram-pattern-data-flow','pattern','Data Flow Diagram','Source→取得→変換→保存→配信のData移動を中心に描く。処理順序やData lineageを説明したい場合に使う。','active','confirmed','user-confirmed',1.000,now()),
 ('diagram-pattern-deployment','pattern','Deployment / Infrastructure Diagram','VPC・Cloud・Runtime・DB・Load Balancer等の実行配置とNetwork/Availability境界を描く。','active','confirmed','user-confirmed',1.000,now()),
 ('diagram-pattern-erd','pattern','ERD / Data Model Diagram','Table/Entity・Key・Relationを中心に描く。System間の役割よりData schema理解が主目的の場合に使う。','active','confirmed','user-confirmed',1.000,now()),
 ('diagram-pattern-sequence','pattern','Sequence Diagram','Actor/System間のRequest/Responseを時間順に描く。1 ScenarioのInteraction詳細を説明する場合に使う。','active','confirmed','user-confirmed',1.000,now()),
 ('diagram-pattern-service-blueprint','pattern','Service Blueprint / Human-System Journey','System/Data FlowにHuman action・Touchpoint・Frontstage/Backstageを重ねる。技術連携と人間の行動を同時に区別したい場合に使う。','active','confirmed','user-confirmed',1.000,now()),
 ('diagram-selection-principle','principle','DiagramはUI都合ではなく説明したいQuestionで選ぶ','「何がどこと繋がるか」ならSystem Landscape、「Dataがどう動くか」ならDFD、「どこにDeployされるか」ならInfrastructure、「Data構造」ならERD、「Interaction順序」ならSequenceを選び、必要ならLandscapeにData FlowをOverlayする。','active','confirmed','user-confirmed',1.000,now())
on conflict (canonical_key) do update
set kind=excluded.kind,title=excluded.title,statement=excluded.statement,lifecycle_status=excluded.lifecycle_status,
 verification_status=excluded.verification_status,source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

commit;
