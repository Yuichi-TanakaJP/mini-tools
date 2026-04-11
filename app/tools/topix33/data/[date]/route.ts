import { loadTopix33DayData } from "../../data-loader";
import { buildDateDataRoute } from "@/app/tools/_shared/date-data-route";

export const GET = buildDateDataRoute(loadTopix33DayData);
