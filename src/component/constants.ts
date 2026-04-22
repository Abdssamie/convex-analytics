export const defaultSettings = {
	sessionTimeoutMs: 30 * 60 * 1000,
	retentionDays: 90,
	rawEventRetentionDays: 90,
	hourlyRollupRetentionDays: 90,
	dedupeRetentionMs: 24 * 60 * 60 * 1000,
	rollupShardCount: 1,
};
export const hourMs = 60 * 60 * 1000;
export const dayMs = 24 * hourMs;
export const maxBatchSize = 50;
export const maxPropertyKeys = 32;
export const aggregationBatchLimit = 100;
export const cleanupBatchLimit = 100;
