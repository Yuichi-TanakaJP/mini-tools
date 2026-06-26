import { NextResponse } from "next/server";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type {
  EconCalendarEvent,
  EconCalendarWeeklyResponse,
} from "@/app/tools/econ-calendar/types";

const CACHE_CONTROL = "public, max-age=300";
const TARGET_DAYS = 2;
const MIN_IMPACT = 4;

type EconNotificationEvent = EconCalendarEvent & { date: string };

type EconNotificationDay = {
  date: string;
  events: EconNotificationEvent[];
};

function todayJstKey() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekStartMonday(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function sortEvents(events: EconNotificationEvent[]) {
  return [...events].sort((a, b) => {
    const aKey = `${a.time ?? "99:99"} ${a.country_tag ?? ""} ${a.indicator}`;
    const bKey = `${b.time ?? "99:99"} ${b.country_tag ?? ""} ${b.indicator}`;
    return aKey.localeCompare(bKey);
  });
}

export async function GET() {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json({ error: "API not configured" }, { status: 503 });
  }

  const today = todayJstKey();
  const dates = Array.from({ length: TARGET_DAYS }, (_, index) => addDays(today, index));
  const weekStarts = Array.from(new Set(dates.map(weekStartMonday)));

  try {
    const weeklyResponses = await Promise.all(
      weekStarts.map((weekStart) =>
        fetchJson<EconCalendarWeeklyResponse>(
          `${apiBase}/econ-calendar/weekly/${weekStart}`,
          3600,
        ),
      ),
    );
    const dayMap = new Map(
      weeklyResponses.flatMap((weekly) => weekly.calendar.map((day) => [day.date, day])),
    );
    const days: EconNotificationDay[] = dates.map((date) => {
      const events = (dayMap.get(date)?.events ?? [])
        .filter((event) => (event.impact ?? 0) >= MIN_IMPACT)
        .map((event) => ({ ...event, date }));
      return { date, events: sortEvents(events) };
    });

    return NextResponse.json(
      {
        schema_version: "econ-calendar-home-notifications-v1",
        generated_at: new Date().toISOString(),
        min_impact: MIN_IMPACT,
        days,
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch econ calendar notifications" }, { status: 502 });
  }
}