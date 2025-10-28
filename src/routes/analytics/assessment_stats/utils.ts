// Types
// -----------------------------
export type MetricKey =
	| "overall"
	| "assessment_type"
	| "difficulty"
	| "bloom_level"
	| "subject"
	| "topic"
	| "subtopic";

export type DimScope = "overall" | "other" | "by_subtopic";

export interface SummaryRow {
	dim_scope: DimScope;
	dim_path: string; // e.g., "Advanced ... › Topic › Subtopic"
	assessment_type: string | null;
	difficulty: "easy" | "medium" | "hard" | null;
	bloom_level:
		| "remember"
		| "understand"
		| "apply"
		| "analyze"
		| "evaluate"
		| "create"
		| null;

	subject_id: number | null;
	subject_label: string | null;
	topic_id: number | null;
	topic_label: string | null;
	subtopic_id: number | null;
	subtopic_label: string | null;

	attempts: number;                 // n
	correct: number;                  // k
	pct_correct: number;              // k/n as [0..1]
	wilson_lb_95: number;             // lower bound @95%
	avg_rt_ms: number | null;         // mean RT
	median_rt_ms: number | null;      // median RT
	speed_accuracy_corr: number | null; // Pearson r
	expected_correct_by_chance: number | null;
	guessing_share: number | null;    // estimated guessing proportion [0..1]
	excess_correct_over_chance: number | null;

	signal: "strong_area" | null;
	metric_key: MetricKey;
	sort_order: number;
}

export interface InsightConfig {
	// Minimum attempts required before we trust the accuracy signal
	minAttempts: number;             // default 5
	// Heuristics for strength/weakness using Wilson lower bound (more robust for small n)
	strongWilsonLB: number;          // default 0.80
	weakWilsonLB: number;            // default 0.50
	// Latency thresholds (ms) — tune per device/user base
	slowMedianMs: number;            // default 30000 (30s)
	fastMedianMs: number;            // optional, default 4000 (4s) just for reference
	// Selection caps
	topN: number;                    // default 8
	// Flag: require subtopic/subject/topic only for strengths/weaknesses
	focusMetricKeys?: MetricKey[];   // default ["subtopic","topic","subject"]
}

export interface KPI {
	attempts: number;
	correct: number;
	accuracy: number;         // [0..1]
	wilsonLB95?: number;
	avgRtMs?: number | null;
	medianRtMs?: number | null;
	speedAccuracyCorr?: number | null;
	guessingShare?: number | null;
	excessCorrectOverChance?: number | null;
}

export interface RankedItem {
	key: string;              // label to display
	metric_key: MetricKey;
	attempts: number;
	accuracy: number;
	wilsonLB95: number;
	medianRtMs?: number | null;
	subject_label?: string | null;
	topic_label?: string | null;
	subtopic_label?: string | null;
	dim_path: string;
	row: SummaryRow;          // original record for drill-through
}

export interface Insights {
	overall: KPI | null;
	byAssessmentType: SummaryRow[];
	byDifficulty: SummaryRow[];
	byBloom: SummaryRow[];

	strengths: RankedItem[];             // high confidence strong areas
	weaknesses: RankedItem[];            // high confidence weak areas
	highAttemptsLowAccuracy: RankedItem[]; // “work-on-next” list

	slowOutliers: RankedItem[];
	lowSampleGaps: RankedItem[];         // interesting but under-sampled
}

// -----------------------------
// Defaults
// -----------------------------
export const defaultInsightConfig: InsightConfig = {
	minAttempts: 5,
	strongWilsonLB: 0.8,
	weakWilsonLB: 0.5,
	slowMedianMs: 30000,
	fastMedianMs: 4000,
	topN: 8,
	focusMetricKeys: ["subtopic", "topic", "subject"],
};

// -----------------------------
// Helpers
// -----------------------------
export function isFiniteNumber(x: unknown): x is number {
	return typeof x === "number" && Number.isFinite(x);
}

export const toPct = (v: number | null | undefined, digits = 1) =>
	isFiniteNumber(v) ? `${(v * 100).toFixed(digits)}%` : "—";

export const msToWords = (ms?: number | null): string => {
	if (!isFiniteNumber(ms) || ms! < 0) return "—";
	const s = Math.round(ms! / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const r = s % 60;
	return r ? `${m}m ${r}s` : `${m}m`;
};

export const labelFor = (r: SummaryRow): string => {
	// Prefer most specific label available for display
	return (
		r.subtopic_label ??
		r.topic_label ??
		r.subject_label ??
		r.assessment_type ??
		r.difficulty ??
		r.bloom_level ??
		r.dim_path
	) ?? "—";
};

export function byMetric<T extends SummaryRow>(
	rows: T[],
	metric: MetricKey
): T[] {
	return rows.filter((r) => r.metric_key === metric);
}

export function safeAccuracy(r: SummaryRow): number {
	// Prefer wilsonLB as conservative accuracy if available; fallback to pct_correct
	if (isFiniteNumber(r.wilson_lb_95)) return r.wilson_lb_95!;
	return isFiniteNumber(r.pct_correct) ? r.pct_correct! : 0;
}

export function mapRankItem(r: SummaryRow): RankedItem {
	return {
		key: labelFor(r),
		metric_key: r.metric_key,
		attempts: r.attempts ?? 0,
		accuracy: r.pct_correct ?? 0,
		wilsonLB95: r.wilson_lb_95 ?? 0,
		medianRtMs: r.median_rt_ms ?? null,
		subject_label: r.subject_label,
		topic_label: r.topic_label,
		subtopic_label: r.subtopic_label,
		dim_path: r.dim_path,
		row: r,
	};
}

function sortDesc<T>(arr: T[], proj: (t: T) => number): T[] {
	return [...arr].sort((a, b) => proj(b) - proj(a));
}

function sortAsc<T>(arr: T[], proj: (t: T) => number): T[] {
	return [...arr].sort((a, b) => proj(a) - proj(b));
}

// -----------------------------
// Core API
// -----------------------------
/**
 * Parse an unknown payload into SummaryRow[] with basic validation.
 */
export function parseSummaryPayload(payload: unknown): SummaryRow[] {
	if (!Array.isArray(payload)) return [];
	return payload.filter((r) => {
		// minimal shape checks
		return (
			r &&
			typeof r === "object" &&
			typeof (r as any).metric_key === "string" &&
			typeof (r as any).dim_path === "string"
		);
	}) as SummaryRow[];
}

/**
 * Extract key performance indicators for the overall row.
 */
export function getOverallKPI(rows: SummaryRow[]): KPI | null {
	// Prefer metric_key === "overall" and dim_path === "overall"
	const overall =
		rows.find((r) => r.metric_key === "overall" && r.dim_path === "overall") ??
		rows.find((r) => r.metric_key === "overall") ??
		null;

	if (!overall) return null;

	return {
		attempts: overall.attempts ?? 0,
		correct: overall.correct ?? 0,
		accuracy: overall.pct_correct ?? 0,
		wilsonLB95: overall.wilson_lb_95 ?? undefined,
		avgRtMs: overall.avg_rt_ms ?? null,
		medianRtMs: overall.median_rt_ms ?? null,
		speedAccuracyCorr: overall.speed_accuracy_corr ?? null,
		guessingShare: overall.guessing_share ?? null,
		excessCorrectOverChance: overall.excess_correct_over_chance ?? null,
	};
}

/**
 * Compute actionable insights with sane defaults.
 * Follows OWASP-style defensive programming (validate inputs, avoid surprises).
 */
export function computeInsights(
	rowsInput: unknown,
	cfg: Partial<InsightConfig> = {}
): Insights {
	const c: InsightConfig = { ...defaultInsightConfig, ...cfg };

	// Accept either a Supabase response object ({ data, error }) or a raw array
	const rows = Array.isArray((rowsInput as any)?.data)
		? (rowsInput as any).data
		: rowsInput;

	const payload = parseSummaryPayload(rows);

	const overall = getOverallKPI(payload);

	// Slices for simple dashboards
	const byAssessmentType = byMetric(payload, 'assessment_type');
	const byDifficulty = byMetric(payload, 'difficulty');
	const byBloom = byMetric(payload, 'bloom_level');

	// Focus on human-facing curriculum cuts
	const focusKeys = c.focusMetricKeys ?? ['subtopic', 'topic', 'subject'];
	const focusRows = payload.filter((r) => focusKeys.includes(r.metric_key));

	// Low-sample rows (interesting but not yet reliable)
	const lowSampleGaps = focusRows
		.filter((r) => r.attempts > 0 && r.attempts < c.minAttempts)
		.map(mapRankItem)
		.slice(0, c.topN);

	// High-confidence strengths: adequate attempts + high Wilson lower bound
	const strengths = sortDesc(
		focusRows.filter(
			(r) => r.attempts >= c.minAttempts && (r.wilson_lb_95 ?? 0) >= c.strongWilsonLB
		),
		(r) => r.wilson_lb_95 ?? 0
	)
		.map(mapRankItem)
		.slice(0, c.topN);

	// High-confidence weaknesses: adequate attempts + low Wilson lower bound
	const weaknesses = sortAsc(
		focusRows.filter((r) => r.attempts >= c.minAttempts && (r.wilson_lb_95 ?? 1) <= c.weakWilsonLB),
		(r) => r.wilson_lb_95 ?? 1
	)
		.map(mapRankItem)
		.slice(0, c.topN);

	// Work-on-next: many attempts but not (yet) strong — prioritize impact
	const highAttemptsLowAccuracy = sortAsc(
		focusRows.filter(
			(r) =>
				r.attempts >= Math.max(c.minAttempts, 10) && (r.wilson_lb_95 ?? r.pct_correct ?? 1) < 0.75
		),
		(r) => r.wilson_lb_95 ?? r.pct_correct ?? 1
	)
		.map(mapRankItem)
		.slice(0, c.topN);

	// Latency outliers (slow medians)
	const slowOutliers = sortDesc(
		focusRows.filter(
			(r) => isFiniteNumber(r.median_rt_ms) && (r.median_rt_ms as number) >= c.slowMedianMs
		),
		(r) => r.median_rt_ms ?? 0
	)
		.map(mapRankItem)
		.slice(0, c.topN);

	return {
		overall,
		byAssessmentType,
		byDifficulty,
		byBloom,
		strengths,
		weaknesses,
		highAttemptsLowAccuracy,
		slowOutliers,
		lowSampleGaps
	};
}

export function toTableRows(rankeds: RankedItem[]) {
	return rankeds.map((r) => ({
		label: r.key,
		accuracy: toPct(r.accuracy),
		wilsonLB: toPct(r.wilsonLB95),
		attempts: r.attempts.toLocaleString(),
		medianRT: msToWords(r.medianRtMs ?? undefined),
		dim_path: r.dim_path,
		metric_key: r.metric_key,
	}));
}

export function toKPIBadges(kpi: KPI | null) {
	if (!kpi) return [];
	return [
		{ label: "Accuracy", value: toPct(kpi.accuracy, 1) },
		{ label: "Attempts", value: kpi.attempts.toLocaleString() },
		{ label: "Median RT", value: msToWords(kpi.medianRtMs ?? undefined) },
		...(isFiniteNumber(kpi.guessingShare)
			? [{ label: "Guessing Share", value: toPct(kpi.guessingShare!) }]
			: []),
	];
}
