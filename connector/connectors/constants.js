/**
 * connector/connectors/constants.js
 *
 * Shared constants used across all connector implementations.
 */

/** Default per-request timeout in milliseconds before a service is considered offline. */
export const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Latency threshold in milliseconds above which a responding service is reported
 * as "degraded" rather than "online".
 */
export const DEGRADED_LATENCY_MS = 3_000;
