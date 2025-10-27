<script lang="ts">
	import { Chart, registerables } from "chart.js";
	import type { CalendarStat } from "./types";
	import { formatDateLabel } from "./utils";

	Chart.register(...registerables);

	export let data: CalendarStat[] = [];

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	// 🔁 Reactive chart creation
	$: if (canvas && data && data.length > 0) {
		// destroy existing chart first
		chart?.destroy();

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			console.warn("CalendarChart: Canvas 2D context not available");
			chart?.destroy();
		} else {
			const labels = data.map((s) => formatDateLabel(s.stat_date));
			const answered = data.map((s) => s.answered ?? 0);
			const correct = data.map((s) => s.correct ?? 0);

			chart = new Chart(ctx, {
				type: "line",
				data: {
					labels,
					datasets: [
						{
							label: "Answered",
							data: answered,
							borderColor: "#3b82f6",
							backgroundColor: "rgba(59,130,246,0.15)",
							tension: 0.3,
							borderWidth: 2,
							pointRadius: 3,
							fill: false
						},
						{
							label: "Correct",
							data: correct,
							borderColor: "#10b981",
							backgroundColor: "rgba(16,185,129,0.15)",
							tension: 0.3,
							borderWidth: 2,
							pointRadius: 3,
							fill: false
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: { mode: "index", intersect: false },
					scales: {
						x: {
							ticks: { autoSkip: true, maxTicksLimit: 10 },
							grid: { color: "rgba(0,0,0,0.05)" }
						},
						y: {
							beginAtZero: true,
							grid: { color: "rgba(0,0,0,0.05)" }
						}
					},
					plugins: {
						legend: {
							display: true,
							position: "bottom",
							labels: { boxWidth: 14, padding: 16 }
						},
						tooltip: {
							callbacks: {
								label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} items`
							}
						}
					}
				}
			});
		}
	}

	// 🧹 Cleanup when component unmounts
	import { onDestroy } from "svelte";
	onDestroy(() => chart?.destroy());
</script>

<style>
    .chart-container {
        width: 100%;
        height: 350px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>

<div class="chart-container">
	<canvas bind:this={canvas}></canvas>
</div>