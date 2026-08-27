import type { PortfolioPosition } from "./types";

export type PortfolioPositionAggregate = {
  instrumentId: string;
  identifier: string;
  name: string;
  assetType: string;
  quantity: number;
  marketValue: number | null;
  costBasis: number | null;
  unrealizedPnl: number | null;
  accounts: string[];
};

function addCompleteAmount(current: number | null, next: number | null) {
  return current === null || next === null ? null : current + next;
}

export function sumCompleteAmounts(values: Array<number | null>) {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function aggregatePortfolioPositions(positions: PortfolioPosition[]): PortfolioPositionAggregate[] {
  const groups = new Map<string, PortfolioPositionAggregate>();

  for (const position of positions) {
    const current = groups.get(position.instrumentId) ?? {
      instrumentId: position.instrumentId,
      identifier: position.identifier,
      name: position.name,
      assetType: position.assetType,
      quantity: 0,
      marketValue: 0,
      costBasis: 0,
      unrealizedPnl: 0,
      accounts: [],
    };

    current.quantity += position.quantity;
    current.marketValue = addCompleteAmount(current.marketValue, position.marketValue);
    current.costBasis = addCompleteAmount(current.costBasis, position.costBasis);
    current.unrealizedPnl = addCompleteAmount(current.unrealizedPnl, position.unrealizedPnl);
    if (!current.accounts.includes(position.accountName)) current.accounts.push(position.accountName);
    groups.set(position.instrumentId, current);
  }

  return [...groups.values()].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
}
