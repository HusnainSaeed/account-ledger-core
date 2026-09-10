/**
 * Runnable entrypoint: replay the event stream and print the day report.
 * Prefer `npm run replay` (tsc + node).
 */
import { replay } from "./replay.js";
import { formatDayReport } from "./report.js";

const result = replay();
console.log(formatDayReport(result));
