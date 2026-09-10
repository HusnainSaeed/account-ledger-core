/**
 * Runnable entrypoint: replay the assessment stream and print the day report.
 */
import { replay } from "./replay.js";
import { formatDayReport } from "./report.js";

const result = replay();
console.log(formatDayReport(result));
