// assessment_stats/utils.js
// JS port that mirrors the strengths/weaknesses logic from --utils.ts
// while preserving the existing helpers used by +page.svelte.

// -----------------------------
// Helpers (formatting)
// -----------------------------
export function asPercent(x) {
	if (x === undefined || x === null || isNaN(x)) return '—';
	return (Math.round(x * 1000) / 10).toFixed(1) + '%';
}

export function msToSec(ms) {
	if (!Number.isFinite(ms)) return '—';
	return (Math.round(ms / 100) / 10).toFixed(1);
}

export function bandFromLB(lb) {
	const n = Number(lb);
	if (!Number.isFinite(n)) return 'Unknown';
	if (n >= 0.90) return 'Mastered';
	if (n >= 0.80) return 'Strong';
	if (n >= 0.70) return 'Developing';
	return 'Needs work';
}

export function toAdvicePills(insights) {
	const pills = [];
	const o = insights?.overall || {};
	const lb = o?.wilsonLB95 ?? 0; // prefer LB if available
	if (lb >= 0.9) pills.push({ text: 'Keep momentum—try harder sets', tone: 'pro' });
	else if (lb >= 0.8) pills.push({ text: 'Great base—mix in timed drills', tone: 'pro' });
	else pills.push({ text: 'Build consistency—short daily reps', tone: 'focus' });

	if ((insights?.slowOutliers || []).length > 0) pills.push({ text: 'Pacing practice on a few topics', tone: 'focus' });
	if ((insights?.lowSampleGaps || []).length > 0) pills.push({ text: 'Fill a couple of coverage gaps', tone: 'pro' });
	if ((insights?.highAttemptsLowAccuracy || []).length > 0) pills.push({ text: 'Revisit tricky frequent items', tone: 'focus' });
	return pills.slice(0, 5);
}

// -----------------------------
// Types (JS equivalents)
// -----------------------------
const defaultInsightConfig = {
	minAttempts: 5,
	strongWilsonLB: 0.8,
	weakWilsonLB: 0.5,
	slowMedianMs: 30000,
	fastMedianMs: 4000,
	topN: 8,
	focusMetricKeys: ['subtopic', 'topic', 'subject'],
};

function isFiniteNumber(x) {
	return typeof x === 'number' && Number.isFinite(x);
}

const msToWords = (ms) => {
	if (!isFiniteNumber(ms) || ms < 0) return '—';
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const r = s % 60;
	return r ? `${m}m ${r}s` : `${m}m`;
};

const toPct = (v, digits = 1) => (isFiniteNumber(v) ? `${(v * 100).toFixed(digits)}%` : '—');

// -----------------------------
// Parsing / labeling helpers (ported from --utils.ts)
// -----------------------------
export function parseSummaryPayload(payload) {
	if (!Array.isArray(payload)) return [];
	return payload.filter((r) => {
		return (
			r &&
			typeof r === 'object' &&
			typeof r.metric_key === 'string' &&
			typeof r.dim_path === 'string'
		);
	});
}

function labelFor(r) {
	return (
		r.subtopic_label ??
		r.topic_label ??
		r.subject_label ??
		r.assessment_type ??
		r.difficulty ??
		r.bloom_level ??
		r.dim_path ??
		'—'
	);
}

function byMetric(rows, metric) {
	return rows.filter((r) => r.metric_key === metric);
}

function safeAccuracy(r) {
	if (isFiniteNumber(r.wilson_lb_95)) return r.wilson_lb_95;
	return isFiniteNumber(r.pct_correct) ? r.pct_correct : 0;
}

function mapRankItem(r) {
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

function sortDesc(arr, proj) { return [...arr].sort((a, b) => proj(b) - proj(a)); }
function sortAsc(arr, proj) { return [...arr].sort((a, b) => proj(a) - proj(b)); }

// -----------------------------
// Overall KPI extraction (ported)
// -----------------------------
function getOverallKPI(rows) {
	const overall =
		rows.find((r) => r.metric_key === 'overall' && r.dim_path === 'overall') ??
		rows.find((r) => r.metric_key === 'overall') ??
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

// -----------------------------
// Core: computeInsights (mirrors --utils.ts logic)
// -----------------------------
export function computeInsights(rowsInput, cfg = {}) {
	const c = { ...defaultInsightConfig, ...cfg };

	// Accept either a Supabase response ({ data, error }) or a raw array
	const rows = Array.isArray(rowsInput?.data) ? rowsInput.data : rowsInput;
	const payload = parseSummaryPayload(rows);

	const overall = getOverallKPI(payload);

	// Slices needed by UI
	const byAssessmentType = byMetric(payload, 'assessment_type');
	const byDifficulty = byMetric(payload, 'difficulty');
	const byBloom = byMetric(payload, 'bloom_level');

	// Focus keys for strengths/weaknesses lists
	const focusKeys = Array.isArray(c.focusMetricKeys) && c.focusMetricKeys.length
		? c.focusMetricKeys
		: ['subtopic', 'topic', 'subject'];
	const focusRows = payload.filter((r) => focusKeys.includes(r.metric_key));

	// Low-sample rows
	const lowSampleGaps = focusRows
		.filter((r) => (r.attempts ?? 0) > 0 && (r.attempts ?? 0) < c.minAttempts)
		.map(mapRankItem)
		.slice(0, c.topN);

	// Strengths
	const strengths = sortDesc(
		focusRows.filter(
			(r) => (r.attempts ?? 0) >= c.minAttempts && (r.wilson_lb_95 ?? 0) >= c.strongWilsonLB
		),
		(r) => r.wilson_lb_95 ?? 0
	).map(mapRankItem).slice(0, c.topN);

	// Weaknesses
	const weaknesses = sortAsc(
		focusRows.filter(
			(r) => (r.attempts ?? 0) >= c.minAttempts && (r.wilson_lb_95 ?? 1) <= c.weakWilsonLB
		),
		(r) => r.wilson_lb_95 ?? 1
	).map(mapRankItem).slice(0, c.topN);

	// Work on next: high attempts but < 0.75 LB (or pct)
	const highAttemptsLowAccuracy = sortAsc(
		focusRows.filter(
			(r) => (r.attempts ?? 0) >= Math.max(c.minAttempts, 10) && (safeAccuracy(r) ?? 1) < 0.75
		),
		(r) => safeAccuracy(r) ?? 1
	).map(mapRankItem).slice(0, c.topN);

	// Slow outliers
	const slowOutliers = sortDesc(
		focusRows.filter(
			(r) => isFiniteNumber(r.median_rt_ms) && r.median_rt_ms >= c.slowMedianMs
		),
		(r) => r.median_rt_ms ?? 0
	).map(mapRankItem).slice(0, c.topN);

	return {
		overall,               // KPI
		byAssessmentType,      // SummaryRow[] (non-null assessment_type)
		byDifficulty,          // SummaryRow[]
		byBloomLevel: byBloom,
		strengths,             // RankedItem[]
		weaknesses,            // RankedItem[]
		highAttemptsLowAccuracy, // RankedItem[]
		slowOutliers,          // RankedItem[]
		lowSampleGaps,         // RankedItem[]
	};
}

// -----------------------------
// Mappers for UI strips/cards
// -----------------------------
export function toKPIBadges(kpi) {
	if (!kpi) return [];
	return [
		{ label: 'Accuracy', value: toPct(kpi.accuracy, 1) },
		{ label: 'Attempts', value: (kpi.attempts ?? 0).toLocaleString() },
		{ label: 'Median RT', value: msToWords(kpi.medianRtMs ?? undefined) },
		...(isFiniteNumber(kpi.guessingShare)
			? [{ label: 'Guessing Share', value: toPct(kpi.guessingShare) }]
			: []),
	];
}

// Accepts either RankedItem[] OR SummaryRow[] and normalizes to the same card shape
export function toTableRows(list = []) {
	const isRanked = (o) => 'key' in o || 'wilsonLB95' in o;
	return (list || []).map((r) => {
		if (isRanked(r)) {
			// RankedItem → card
			return {
				label: r.key,
				accuracy: toPct(r.accuracy),
				wilsonLB: toPct(r.wilsonLB95),
				attempts: (r.attempts ?? 0).toLocaleString(),
				medianRT: msToWords(r.medianRtMs ?? undefined),
				dim_path: r.dim_path,
				metric_key: r.metric_key,
			};
		}
		// SummaryRow → card (for grouped panels)
		const acc = isFiniteNumber(r.pct_correct) ? r.pct_correct : 0;
		const lb = isFiniteNumber(r.wilson_lb_95) ? r.wilson_lb_95 : undefined;
		return {
			label: labelFor(r),
			accuracy: toPct(acc),
			wilsonLB: toPct(lb),
			attempts: (r.attempts ?? 0).toLocaleString(),
			medianRT: msToWords(r.median_rt_ms ?? undefined),
			dim_path: r.dim_path,
			metric_key: r.metric_key,
		};
	});
}