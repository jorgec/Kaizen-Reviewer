export interface CalendarStat {
	stat_date: string;
	dow: number;
	week_index: number;
	answered: number | null;
	correct: number | null;
	accuracy: number | null;
	avg_rt_ms: number | null;
}