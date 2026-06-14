import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type {
  DisclosureEventsManifest,
  DisclosureEventsPageData,
  DisclosureEventsResponse,
} from "./types";

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function loadDisclosureEvents(): Promise<DisclosureEventsPageData | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    const [latest, manifest] = await Promise.all([
      fetchJson<DisclosureEventsResponse>(
        `${apiBase}/disclosure-events/latest`,
        300,
      ),
      fetchJson<DisclosureEventsManifest>(
        `${apiBase}/disclosure-events/manifest`,
        300,
      ),
    ]);
    const referenceDate = manifest.dates.at(-1) ?? latest.target_date;
    const cutoff = addDays(referenceDate, -29);
    const historyDates = manifest.dates.filter(
      (date) => date >= cutoff && date !== latest.target_date,
    );
    const history = await Promise.all(
      historyDates.map(async (date) => {
        try {
          return await fetchJson<DisclosureEventsResponse>(
            `${apiBase}/disclosure-events/${date}`,
            300,
          );
        } catch {
          return null;
        }
      }),
    );
    const responses = [
      latest,
      ...history.filter(
        (item): item is DisclosureEventsResponse => item !== null,
      ),
    ];
    const items = responses
      .flatMap((response) => response.items)
      .filter(
        (item, index, all) =>
          all.findIndex((candidate) => candidate.event_id === item.event_id) ===
          index,
      )
      .sort((a, b) =>
        `${b.disclosure_date} ${b.disclosure_time}`.localeCompare(
          `${a.disclosure_date} ${a.disclosure_time}`,
        ),
      );

    return {
      latestDate: latest.target_date,
      referenceDate,
      loadedDates: responses.map((response) => response.target_date).sort(),
      items,
    };
  } catch {
    return null;
  }
}
