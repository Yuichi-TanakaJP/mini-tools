import { expect, it } from "vitest";
import { selectScopeDisplay, withScopeFocus, type ScopeContext, type ScopeSnapshot } from "./scope-display";
const requested: ScopeContext = { mode: "group", groupId: "new", centerId: "", baseId: "", hops: 2, verifiedOnly: true, categories: ["capital"], showGroups: true };
const old: ScopeSnapshot = { key: "old", data: { companies: [], relationships: [], memberships: [], functions: [] }, context: { ...requested, groupId: "old", mode: "company", centerId: "old-company" } };
it("keeps old scope and its own labels together while another scope is pending or failed", () => {
  const display = selectScopeDisplay(old, "new", requested);
  expect(display.previous).toBe(true); expect(display.current).toBeNull();
  expect(display.context.centerId).toBe("old-company"); expect(display.context.groupId).toBe("old");
  expect(display.data).toBe(old.data);
});
it("uses current local display choices only after the matching scope is ready", () => {
  const currentChoices = { ...old.context, baseId: "local-highlight" };
  const display = selectScopeDisplay(old, "old", currentChoices);
  expect(display.previous).toBe(false); expect(display.current).toBe(old.data);
  expect(display.context).toBe(currentChoices);
  expect(display.context.centerId).toBe("old-company");
});
it("does not invent an old display on initial load", () => expect(selectScopeDisplay(null, "new", requested).data).toBeNull());

it("retains the latest group focus across pending/failed scope changes and restoration", () => {
  const group = { ...old, context: { ...old.context, mode: "group" as const, centerId: "" } };
  const focused = withScopeFocus(group, "old", "focused-company");
  const pending = selectScopeDisplay(focused, "new", requested);
  expect(pending.previous).toBe(true);
  expect(pending.context.baseId).toBe("focused-company");
  const restored = selectScopeDisplay(focused, "old", pending.context);
  expect(restored.context.baseId).toBe("focused-company");
  expect(restored.current).toBe(group.data);
  expect(withScopeFocus(focused, "new", "unresolved-company")).toBe(focused);
});
