<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { supabase } from '$lib/supabaseClient';

	type UUID = string;
	let user: any;

	type AttemptMetric = {
		user_id: UUID;
		assessment_id: UUID;
		root_instance_id: UUID;
		instance_id: UUID;
		attempt_number: number;
		att_time: string;
		items_answered: number;
		correct_count: number;
		accuracy: number;
		avg_rt_ms: number;
		omit_count: number;
		delta_accuracy: number | null;
		delta_avg_rt_ms: number | null;
		delta_correct: number | null;
		delta_items: number | null;
	};

	type SeriesSlope = {
		user_id: UUID;
		assessment_id: UUID;
		root_instance_id: UUID;
		approx_slope_per_attempt: number;
		attempts_so_far: number;
	};

	type ItemFlip = {
		user_id: UUID;
		assessment_id: UUID;
		root_instance_id: UUID;
		question_id: number;
		attempt_number: number;
		x_prev: number;
		x_curr: number;
		flip_class: string;
	};

	type FlipBySubtopic = {
		user_id: UUID;
		assessment_id: UUID;
		root_instance_id: UUID;
		subject_id: number;
		topic_id: number;
		subtopic_id: number;
		cnt_w2r: number;
		cnt_r2w: number;
		cnt_persist_wrong: number;
		cnt_persist_right: number;
	};

	type SubtopicTrend = {
		user_id: UUID;
		assessment_id: UUID;
		root_instance_id: UUID;
		instance_id: UUID;
		attempt_number: number;
		subtopic_id: number;
		n: number;
		k: number;
		accuracy: number;
		delta_accuracy_subtopic: number | null;
	};

	let attemptMetrics: AttemptMetric[] = [];
	let seriesSlopes: SeriesSlope[] = [];
	let itemFlips: ItemFlip[] = [];
	let flipsBySubtopic: FlipBySubtopic[] = [];
	let subtopicTrends: SubtopicTrend[] = [];

	let loading = true;
	let errorMsg: string | null = null;
	const unsubscribe = userStore.subscribe((v) => (user = v));
	const userId = user?.user_id;

	async function loadData() {
		loading = true;
		errorMsg = null;

		try {
			// Run all RPC calls in parallel
			const [
				{ data: metricsData, error: metricsError },
				{ data: slopeData, error: slopeError },
				{ data: flipsData, error: flipsError },
				{ data: flipSubtopicData, error: flipSubtopicError },
				{ data: trendsData, error: trendsError }
			] = await Promise.all([
				supabase.rpc('rpc_mock_attempt_metrics', { p_user_id: userId }),
				supabase.rpc('rpc_mock_series_slope', { p_user_id: userId }),
				supabase.rpc('rpc_mock_item_flips', { p_user_id: userId }),
				supabase.rpc('rpc_mock_flip_by_subtopic', { p_user_id: userId }),
				supabase.rpc('rpc_mock_subtopic_trends', { p_user_id: userId })
			]);

			// Check for errors
			if (metricsError || slopeError || flipsError || flipSubtopicError || trendsError) {
				const errors = [
					metricsError,
					slopeError,
					flipsError,
					flipSubtopicError,
					trendsError
				]
					.filter(Boolean)
					.map((e) => e!.message)
					.join(' | ');
				throw new Error(errors);
			}

			// Assign data
			attemptMetrics = (metricsData ?? []) as AttemptMetric[];
			seriesSlopes = (slopeData ?? []) as SeriesSlope[];
			itemFlips = (flipsData ?? []) as ItemFlip[];
			flipsBySubtopic = (flipSubtopicData ?? []) as FlipBySubtopic[];
			subtopicTrends = (trendsData ?? []) as SubtopicTrend[];
		} catch (err: any) {
			errorMsg = err?.message ?? 'Unknown error occurred';
			console.error('Error loading mock exam metrics:', err);
		} finally {
			loading = false;
		}
	}

	function formatPercent(value: number | null | undefined): string {
		return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '';
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString();
	}

	function formatNumber(value: number | null | undefined, decimals: number = 4): string {
		if (value === null || value === undefined || !Number.isFinite(value)) return '';
		return value.toFixed(decimals);
	}

	onMount(() => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		loadData();
	});
</script>

<section class="section">
	<div class="container">
		<h1 class="title">Mock Exam Metrics</h1>

		{#if loading}
			<div class="notification is-info">
				<p>Loading metrics...</p>
			</div>
		{:else if errorMsg}
			<article class="message is-danger">
				<div class="message-body">{errorMsg}</div>
			</article>
		{:else}
			<!-- Attempt Metrics -->
			<div class="box">
				<h2 class="subtitle">Mock Attempt Metrics</h2>
				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>Attempt</th>
							<th>Time</th>
							<th>Items</th>
							<th>Correct</th>
							<th>Accuracy</th>
							<th>Avg RT (ms)</th>
							<th>Omits</th>
							<th>Δ Accuracy</th>
							<th>Δ RT</th>
							<th>Δ Correct</th>
							<th>Δ Items</th>
						</tr>
						</thead>
						<tbody>
						{#if attemptMetrics.length === 0}
							<tr>
								<td colspan="11" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each attemptMetrics as metric}
								<tr>
									<td>{metric.attempt_number}</td>
									<td>{formatDateTime(metric.att_time)}</td>
									<td>{metric.items_answered}</td>
									<td>{metric.correct_count}</td>
									<td>{formatPercent(metric.accuracy)}</td>
									<td>{metric.avg_rt_ms}</td>
									<td>{metric.omit_count}</td>
									<td>{metric.delta_accuracy ?? '-'}</td>
									<td>{metric.delta_avg_rt_ms ?? '-'}</td>
									<td>{metric.delta_correct ?? '-'}</td>
									<td>{metric.delta_items ?? '-'}</td>
								</tr>
							{/each}
						{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Series Slope -->
			<div class="box">
				<h2 class="subtitle">Mock Series Slope</h2>
				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>Assessment ID</th>
							<th>Root Instance ID</th>
							<th>Slope per Attempt</th>
							<th>Attempts So Far</th>
						</tr>
						</thead>
						<tbody>
						{#if seriesSlopes.length === 0}
							<tr>
								<td colspan="4" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each seriesSlopes as slope}
								<tr>
									<td class="is-family-monospace" style="font-size: 0.85em;"
									>{slope.assessment_id}</td
									>
									<td class="is-family-monospace" style="font-size: 0.85em;"
									>{slope.root_instance_id}</td
									>
									<td>{formatNumber(slope.approx_slope_per_attempt, 4)}</td>
									<td>{slope.attempts_so_far}</td>
								</tr>
							{/each}
						{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Item Flips -->
			<div class="box">
				<h2 class="subtitle">Mock Item Flips</h2>
				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>Question ID</th>
							<th>Attempt</th>
							<th>Previous</th>
							<th>Current</th>
							<th>Flip Class</th>
						</tr>
						</thead>
						<tbody>
						{#if itemFlips.length === 0}
							<tr>
								<td colspan="5" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each itemFlips as flip}
								<tr>
									<td>{flip.question_id}</td>
									<td>{flip.attempt_number}</td>
									<td>{flip.x_prev}</td>
									<td>{flip.x_curr}</td>
									<td>
											<span
												class="tag {flip.flip_class === 'wrong_to_right'
													? 'is-success'
													: 'is-danger'}"
											>
												{flip.flip_class}
											</span>
									</td>
								</tr>
							{/each}
						{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Flips by Subtopic -->
			<div class="box">
				<h2 class="subtitle">Flips by Subtopic</h2>
				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>Subject</th>
							<th>Topic</th>
							<th>Subtopic</th>
							<th>Wrong → Right</th>
							<th>Right → Wrong</th>
							<th>Persist Wrong</th>
							<th>Persist Right</th>
						</tr>
						</thead>
						<tbody>
						{#if flipsBySubtopic.length === 0}
							<tr>
								<td colspan="7" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each flipsBySubtopic as flip}
								<tr>
									<td>{flip.subject_id}</td>
									<td>{flip.topic_id}</td>
									<td>{flip.subtopic_id}</td>
									<td class="has-text-success">{flip.cnt_w2r}</td>
									<td class="has-text-danger">{flip.cnt_r2w}</td>
									<td>{flip.cnt_persist_wrong}</td>
									<td>{flip.cnt_persist_right}</td>
								</tr>
							{/each}
						{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Subtopic Trends -->
			<div class="box">
				<h2 class="subtitle">Subtopic Trends</h2>
				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>Attempt</th>
							<th>Subtopic</th>
							<th>N</th>
							<th>K (Correct)</th>
							<th>Accuracy</th>
							<th>Δ Accuracy</th>
						</tr>
						</thead>
						<tbody>
						{#if subtopicTrends.length === 0}
							<tr>
								<td colspan="6" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each subtopicTrends as trend}
								<tr>
									<td>{trend.attempt_number}</td>
									<td>{trend.subtopic_id}</td>
									<td>{trend.n}</td>
									<td>{trend.k}</td>
									<td>{formatPercent(trend.accuracy)}</td>
									<td>{trend.delta_accuracy_subtopic ?? '-'}</td>
								</tr>
							{/each}
						{/if}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
    .box {
        margin-bottom: 2rem;
    }

    .table-container {
        overflow-x: auto;
    }

		table td, table th{
				line-height: 1rem;
		}

    .subtitle {
        margin-bottom: 1rem;
    }
</style>