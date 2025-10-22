import type { CalendarDay } from './types';

/**
 * Enforce a 52 x 7 grid using week_index and dow.
 * Accepts raw rows from rpc_get_user_calendar_grid.
 */
export function buildCalendarGridFixed(data: any[]): CalendarDay[][] {
	if (!data || data.length === 0) return [];

	// Group by week_index
	const weeksByIndex: Record<number, any[]> = {};
	for (const d of data) {
		(weeksByIndex[d.week_index] ??= []).push(d);
	}

	// Exactly 52 weeks ending at max week
	const maxWeek = Math.max(...Object.keys(weeksByIndex).map(Number));
	const minWeek = maxWeek - 51;

	const grid: CalendarDay[][] = [];
	for (let w = minWeek; w <= maxWeek; w++) {
		const days = weeksByIndex[w] ?? [];
		const col: CalendarDay[] = Array.from({ length: 7 }, () => ({
			stat_date: null,
			accuracy: null,
			answered: null,
			correct: null,
			avg_rt_ms: null,
			isDummy: true
		}));

		for (const d of days) {
			if (d.dow >= 0 && d.dow <= 6) col[d.dow] = { ...d, isDummy: false };
		}
		grid.push(col);
	}
	return grid;
}

/**
 * Month labels aligned to columns: use the month of the first real day in each column.
 */
export function buildMonthLabels(weeks: CalendarDay[][]): string[] {
	const labels: string[] = [];
	const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	let lastMonth: number | null = null;

	for (const col of weeks) {
		const firstReal = col.find((d) => d && d.stat_date);
		if (!firstReal) { labels.push(''); continue; }
		const m = new Date(firstReal.stat_date!).getMonth();
		if (m !== lastMonth) {
			labels.push(months[m]);
			lastMonth = m;
		} else {
			labels.push('');
		}
	}
	return labels;
}

export function getCalendarDayColor(acc: number | null): string {
	if (acc === null || isNaN(acc as any)) return '#aaaaaa';
	if (acc < 0.3) return '#d00000';
	if (acc < 0.5) return '#e36414';
	if (acc < 0.75) return '#fb8b24';
	if (acc < 0.8) return '#98c1d9';
	if (acc < 0.85) return '#4b8a6f';
	if (acc < 0.9) return '#07f6c3';
	return '#07f6c3';
}