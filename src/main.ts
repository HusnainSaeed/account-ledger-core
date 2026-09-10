/**
 * Runnable entrypoint: replay the assessment stream and print the day report.
 * Prefer `npm run replay` (tsc + node) over tsx under sandboxed agents.
 */
import { replay } from "./replay.js";
import { formatDayReport } from "./report.js";

const result = replay();
console.log(formatDayReport(result));
