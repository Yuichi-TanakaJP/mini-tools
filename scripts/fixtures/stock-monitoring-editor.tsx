import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Editor from "../../app/tools/stock-notes/StockMonitoringEditor";
import type { StockMonitoringMetadata, StockMonitoringSnapshot } from "../../app/tools/stock-notes/types";

// This fixture never creates a database client or uses an authenticated browser profile.
const control = window as unknown as {
  React: typeof React; refresh: () => void; stored: StockMonitoringSnapshot;
  writes: number; failNext: boolean; holdNext: boolean; finish: () => void;
};
control.React = React;
control.stored = { watchPurposes: [], creditMonitoringEnabled: null, updatedAt: "2026-01-01T00:00:00.000Z" };
control.writes = 0;
function Fixture() {
  const [initial, setInitial] = useState(control.stored);
  useEffect(() => { control.refresh = () => setInitial({ ...control.stored }); }, []);
  async function save(value: StockMonitoringMetadata, expected: StockMonitoringSnapshot) {
    if (control.failNext) { control.failNext = false; throw new Error("synthetic failure"); }
    if (control.holdNext) { control.holdNext = false; await new Promise<void>((resolve) => { control.finish = resolve; }); }
    if (JSON.stringify(expected) !== JSON.stringify(control.stored)) throw new Error("synthetic CAS conflict");
    control.stored = { ...value, updatedAt: new Date(Date.parse(control.stored.updatedAt) + 1).toISOString() };
    control.writes++;
  }
  return <>{["A", "B"].map((name) => <section key={name} aria-label={`Editor ${name}`}><Editor initial={initial} archived={false} busy={false} onSave={save} /></section>)}</>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
