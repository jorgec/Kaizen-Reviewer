<script lang="ts">
	import type { CalendarDay } from './types';
	import { getCalendarDayColor } from './utils';

	export let loading: boolean;
	export let error: string | null = null;
	export let weeks: CalendarDay[][] = [];
	export let monthLabels: string[] = [];

	// Local tooltip UI state (purely presentational)
	let tooltip = {
		visible: false,
		x: 0,
		y: 0,
		date: '',
		dow: '',
		week: '',
		answered: 0,
		correct: 0,
		accuracy: null as number | null,
		avg_rt_ms: null as number | null
	};

	function showTooltip(day: any, event: MouseEvent) {
		if (!day?.stat_date) return;
		tooltip = {
			visible: true,
			x: event.pageX + 8,
			y: event.pageY - 8,
			date: day.stat_date,
			dow: day.dow,
			week: day.week_index,
			answered: day.answered,
			correct: day.correct,
			accuracy: day.accuracy,
			avg_rt_ms: day.avg_rt_ms
		};
	}

	function hideTooltip() {
		tooltip.visible = false;
	}
</script>

{#if loading}
	<p>Loading calendar...</p>
{:else if error}
	<p class="has-text-danger">{error}</p>
{:else}
	<div class="calendar-inner">
		<div class="calendar-months" aria-hidden="true">
			{#each monthLabels as m}
				<div class="month-label">{m}</div>
			{/each}
		</div>

		<div class="calendar-grid" role="grid" aria-label="Activity calendar">
			{#each weeks as week}
				<div class="calendar-week" role="row">
					{#each week as day}
						<div
							tabindex="0"
							class="calendar-day"
							role="gridcell"
							style="background-color: {day.isDummy ? 'transparent' : getCalendarDayColor(day.accuracy)}; opacity: {day.isDummy ? 0.25 : 1}"
							class:dummy={day.isDummy}
							on:mousemove={(e) => !day.isDummy && showTooltip(day, e)}
							on:mouseleave={hideTooltip}
						></div>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	{#if tooltip.visible}
		<div class="calendar-tooltip" style="top:{tooltip.y}px; left:{tooltip.x}px">
			<strong style="color:#fff!important;">{tooltip.date}</strong><br />
			Week/DOW: {tooltip.week}/{tooltip.dow}<br />
			Answered: {tooltip.answered}<br />
			Correct: {tooltip.correct}<br />
			Accuracy: {tooltip.accuracy !== null ? (tooltip.accuracy * 100).toFixed(1) + '%' : 'N/A'}<br />
			Avg RT: {tooltip.avg_rt_ms !== null ? Math.round(tooltip.avg_rt_ms / 1000) + 's' : 'N/A'}
		</div>
	{/if}

	<div class="calendar-legend">
		<span>Poor</span>
		<div class="legend-swatch" style="background:#d00000"></div>
		<div class="legend-swatch" style="background:#e36414"></div>
		<div class="legend-swatch" style="background:#f1a651"></div>
		<div class="legend-swatch" style="background:#d8e158"></div>
		<div class="legend-swatch" style="background:#9eb36a"></div>
		<div class="legend-swatch" style="background:#53bf58"></div>
		<div class="legend-swatch" style="background:#11ecec"></div>
		<span>Good</span>
	</div>
{/if}

<style scoped>
    .calendar-inner {
        display: block;
        width: 100%;
        overflow-x: auto;
        position: relative;
        padding-left: 32px;
    }
    .calendar-months {
        display: grid;
        grid-template-columns: repeat(52, 1fr);
        gap: 3px;
        margin-bottom: 6px;
        font-size: 0.75rem;
        color: #666;
    }
    .month-label { text-align: left; white-space: nowrap; }

    .calendar-grid {
        display: flex;
        flex-direction: row;  /* weeks go left→right */
        gap: 3px;
    }
    .calendar-week {
        display: flex;
        flex-direction: column; /* days go top→bottom */
        gap: 3px;
				width: 100%;
    }
    .calendar-day {
        width: 14px; height: 14px; border-radius: 2px; margin-bottom: 2px;
        cursor: pointer; transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .calendar-day.dummy {
        cursor: default; background-color: transparent !important; box-shadow: none !important; transform: none !important;
    }
    .calendar-day:hover:not(.dummy) { transform: scale(1.25); box-shadow: 0 0 5px rgba(0,0,0,0.25); z-index: 10; }
    .calendar-tooltip {
        position: fixed; background: rgba(0,0,0,0.85); color: #fff; padding: 6px 8px; font-size: 0.75rem; border-radius: 4px;
        pointer-events: none; z-index: 1000; white-space: nowrap;
    }
    .calendar-legend {
        display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 6px; font-size: 0.75rem; color: #666;
    }
    .legend-swatch { width: 10px; height: 10px; border-radius: 2px; }
</style>