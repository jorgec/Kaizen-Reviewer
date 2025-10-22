export type CalendarDay = {
	stat_date: string | null;
	accuracy: number | null;     // 0..1
	answered: number | null;
	correct: number | null;
	avg_rt_ms: number | null;
	dow?: number | null;         // 0..6
	week_index?: number | null;
	isDummy?: boolean;
};

export type CalendarProps = {
	loading: boolean;
	error?: string | null;
	weeks: CalendarDay[][];
	monthLabels: string[];
};