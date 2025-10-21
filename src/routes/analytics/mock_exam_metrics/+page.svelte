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
		subject_id: number;
		topic_id: number;
		subtopic_id: number;
		subtopic_name: string;
		topic_name: string;
		subject_name: string;
		stem: string;
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
		subtopic_name: string;
		topic_name: string;
		subject_name: string;
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
		topic_id: number;
		subject_id: number;
		subtopic_name: string;
		topic_name: string;
		subject_name: string;
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

	// ---------- Item Flips Filtering & Sorting State ----------
	let selectedSubject: string = '';
	let selectedTopic: string = '';
	let selectedSubtopic: string = '';

	type FlipSortKey = 'subject' | 'topic' | 'subtopic';
	type SortDir = 'asc' | 'desc' | '';
	let flipSortKey: FlipSortKey | '' = '';
	let flipSortDir: SortDir = '';

	function setFlipSort(column: FlipSortKey) {
		if (flipSortKey !== column) {
			flipSortKey = column;
			flipSortDir = 'asc';
		} else {
			flipSortDir = flipSortDir === 'asc' ? 'desc' : flipSortDir === 'desc' ? '' : 'asc';
			if (flipSortDir === '') {
				flipSortKey = '';
			}
		}
	}

	// Options computed from current data and selections (Item Flips)
	$: subjectOptions = Array.from(
		new Set(itemFlips.map((f) => f.subject_name).filter((v) => v && v.trim().length > 0))
	).sort((a, b) => a.localeCompare(b));

	$: topicOptions = Array.from(
		new Set(
			itemFlips
				.filter((f) => (selectedSubject ? f.subject_name === selectedSubject : true))
				.map((f) => f.topic_name)
				.filter((v) => v && v.trim().length > 0)
		)
	).sort((a, b) => a.localeCompare(b));

	$: subtopicOptions = Array.from(
		new Set(
			itemFlips
				.filter((f) => (selectedSubject ? f.subject_name === selectedSubject : true))
				.filter((f) => (selectedTopic ? f.topic_name === selectedTopic : true))
				.map((f) => f.subtopic_name)
				.filter((v) => v && v.trim().length > 0)
		)
	).sort((a, b) => a.localeCompare(b));

	// Reset invalid downstream selections
	$: if (selectedSubject && !subjectOptions.includes(selectedSubject)) selectedSubject = '';
	$: if (selectedTopic && !topicOptions.includes(selectedTopic)) selectedTopic = '';
	$: if (selectedSubtopic && !subtopicOptions.includes(selectedSubtopic)) selectedSubtopic = '';

	// Filtered + sorted list (Item Flips)
	$: filteredItemFlips = itemFlips
		.filter((f) => (selectedSubject ? f.subject_name === selectedSubject : true))
		.filter((f) => (selectedTopic ? f.topic_name === selectedTopic : true))
		.filter((f) => (selectedSubtopic ? f.subtopic_name === selectedSubtopic : true));

	$: sortedItemFlips = (() => {
		if (!flipSortKey || !flipSortDir) return filteredItemFlips;
		const keyMap: Record<FlipSortKey, (f: ItemFlip) => string> = {
			subject: (f) => f.subject_name || '',
			topic: (f) => f.topic_name || '',
			subtopic: (f) => f.subtopic_name || ''
		};
		const getter = keyMap[flipSortKey];
		return [...filteredItemFlips].sort((a, b) => {
			const v1 = getter(a).toLowerCase();
			const v2 = getter(b).toLowerCase();
			const cmp = v1.localeCompare(v2);
			return flipSortDir === 'asc' ? cmp : -cmp;
		});
	})();

	// ---------- Flips by Subtopic Filtering & Sorting State ----------
	let selectedSubjectFbs: string = '';
	let selectedTopicFbs: string = '';
	let selectedSubtopicFbs: string = '';

	type FbsSortKey = 'subject' | 'topic' | 'subtopic';
	let fbsSortKey: FbsSortKey | '' = '';
	let fbsSortDir: SortDir = '';

	function setFbsSort(column: FbsSortKey) {
		if (fbsSortKey !== column) {
			fbsSortKey = column;
			fbsSortDir = 'asc';
		} else {
			fbsSortDir = fbsSortDir === 'asc' ? 'desc' : fbsSortDir === 'desc' ? '' : 'asc';
			if (fbsSortDir === '') {
				fbsSortKey = '';
			}
		}
	}

	// Options computed from current data and selections (Flips by Subtopic)
	$: subjectOptionsFbs = Array.from(
		new Set(flipsBySubtopic.map((f) => f.subject_name).filter((v) => v && v.trim().length > 0))
	).sort((a, b) => a.localeCompare(b));

	$: topicOptionsFbs = Array.from(
		new Set(
			flipsBySubtopic
				.filter((f) => (selectedSubjectFbs ? f.subject_name === selectedSubjectFbs : true))
				.map((f) => f.topic_name)
				.filter((v) => v && v.trim().length > 0)
		)
	).sort((a, b) => a.localeCompare(b));

	$: subtopicOptionsFbs = Array.from(
		new Set(
			flipsBySubtopic
				.filter((f) => (selectedSubjectFbs ? f.subject_name === selectedSubjectFbs : true))
				.filter((f) => (selectedTopicFbs ? f.topic_name === selectedTopicFbs : true))
				.map((f) => f.subtopic_name)
				.filter((v) => v && v.trim().length > 0)
		)
	).sort((a, b) => a.localeCompare(b));

	// Reset invalid downstream selections (FBS)
	$: if (selectedSubjectFbs && !subjectOptionsFbs.includes(selectedSubjectFbs)) selectedSubjectFbs = '';
	$: if (selectedTopicFbs && !topicOptionsFbs.includes(selectedTopicFbs)) selectedTopicFbs = '';
	$: if (selectedSubtopicFbs && !subtopicOptionsFbs.includes(selectedSubtopicFbs)) selectedSubtopicFbs = '';

	// Filtered + sorted list (FBS)
	$: filteredFlipsBySubtopic = flipsBySubtopic
		.filter((f) => (selectedSubjectFbs ? f.subject_name === selectedSubjectFbs : true))
		.filter((f) => (selectedTopicFbs ? f.topic_name === selectedTopicFbs : true))
		.filter((f) => (selectedSubtopicFbs ? f.subtopic_name === selectedSubtopicFbs : true));

	$: sortedFlipsBySubtopic = (() => {
		if (!fbsSortKey || !fbsSortDir) return filteredFlipsBySubtopic;
		const keyMap: Record<FbsSortKey, (f: FlipBySubtopic) => string> = {
			subject: (f) => f.subject_name || '',
			topic: (f) => f.topic_name || '',
			subtopic: (f) => f.subtopic_name || ''
		};
		const getter = keyMap[fbsSortKey];
		return [...filteredFlipsBySubtopic].sort((a, b) => {
			const v1 = getter(a).toLowerCase();
			const v2 = getter(b).toLowerCase();
			const cmp = v1.localeCompare(v2);
			return fbsSortDir === 'asc' ? cmp : -cmp;
		});
	})();

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

	// --- Subtopic Trends Filtering & Sorting State ---
	let stSelectedSubject: string = '';
	let stSelectedTopic: string = '';
	let stSelectedSubtopic: string = '';

	type StSortKey = 'subject' | 'topic' | 'subtopic' | 'accuracy' | 'delta';
	let stSortKey: StSortKey | '' = '';
	let stSortDir: SortDir = '';

	function setStSort(column: StSortKey) {
		if (stSortKey !== column) {
			stSortKey = column;
			stSortDir = 'asc';
		} else {
			stSortDir = stSortDir === 'asc' ? 'desc' : stSortDir === 'desc' ? '' : 'asc';
			if (stSortDir === '') {
				stSortKey = '';
			}
		}
	}

	// Subject/Topic/Subtopic options for Subtopic Trends
	$: stSubjectOptions = Array.from(
		new Set(subtopicTrends.map((t) => t.subject_name).filter((v) => v && v.trim().length > 0))
	).sort((a, b) => a.localeCompare(b));

	$: stTopicOptions = Array.from(
		new Set(
			subtopicTrends
				.filter((t) => (stSelectedSubject ? t.subject_name === stSelectedSubject : true))
				.map((t) => t.topic_name)
				.filter((v) => v && v.trim().length > 0)
		)
	).sort((a, b) => a.localeCompare(b));

	$: stSubtopicOptions = Array.from(
		new Set(
			subtopicTrends
				.filter((t) => (stSelectedSubject ? t.subject_name === stSelectedSubject : true))
				.filter((t) => (stSelectedTopic ? t.topic_name === stSelectedTopic : true))
				.map((t) => t.subtopic_name)
				.filter((v) => v && v.trim().length > 0)
		)
	).sort((a, b) => a.localeCompare(b));

	// Reset invalid downstream selections
	$: if (stSelectedSubject && !stSubjectOptions.includes(stSelectedSubject)) stSelectedSubject = '';
	$: if (stSelectedTopic && !stTopicOptions.includes(stSelectedTopic)) stSelectedTopic = '';
	$: if (stSelectedSubtopic && !stSubtopicOptions.includes(stSelectedSubtopic)) stSelectedSubtopic = '';

	// Filtered + sorted list (Subtopic Trends)
	$: filteredSubtopicTrends = subtopicTrends
		.filter((t) => (stSelectedSubject ? t.subject_name === stSelectedSubject : true))
		.filter((t) => (stSelectedTopic ? t.topic_name === stSelectedTopic : true))
		.filter((t) => (stSelectedSubtopic ? t.subtopic_name === stSelectedSubtopic : true));

	$: sortedSubtopicTrends = (() => {
		if (!stSortKey || !stSortDir) return filteredSubtopicTrends;
		const keyMap: Record<StSortKey, (t: SubtopicTrend) => string | number | null> = {
			subject: (t) => t.subject_name || '',
			topic: (t) => t.topic_name || '',
			subtopic: (t) => t.subtopic_name || '',
			accuracy: (t) => typeof t.accuracy === 'number' ? t.accuracy : -Infinity,
			delta: (t) => typeof t.delta_accuracy_subtopic === 'number' ? t.delta_accuracy_subtopic : -Infinity
		};
		const getter = keyMap[stSortKey];
		return [...filteredSubtopicTrends].sort((a, b) => {
			const v1 = getter(a);
			const v2 = getter(b);
			if (typeof v1 === 'number' && typeof v2 === 'number') {
				return stSortDir === 'asc' ? v1 - v2 : v2 - v1;
			} else {
				const s1 = (v1 ?? '').toString().toLowerCase();
				const s2 = (v2 ?? '').toString().toLowerCase();
				const cmp = s1.localeCompare(s2);
				return stSortDir === 'asc' ? cmp : -cmp;
			}
		});
	})();

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

				<!-- Filters: Subject / Topic / Subtopic -->
				<div class="filters is-flex is-flex-wrap-wrap mb-3" style="gap: 0.75rem;">
					<div class="select is-small">
						<select bind:value={selectedSubject} aria-label="Filter by subject">
							<option value=''>All Subjects</option>
							{#each subjectOptions as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<div class="select is-small">
						<select bind:value={selectedTopic} aria-label="Filter by topic">
							<option value=''>All Topics</option>
							{#each topicOptions as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="select is-small">
						<select bind:value={selectedSubtopic} aria-label="Filter by subtopic">
							<option value=''>All Subtopics</option>
							{#each subtopicOptions as st}
								<option value={st}>{st}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setFlipSort('subject')}>
									<span>Subject</span>
									<span class="icon is-small ml-1">
										{#if flipSortKey === 'subject' && flipSortDir === 'asc'}▲{:else if flipSortKey === 'subject' && flipSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setFlipSort('topic')}>
									<span>Topic</span>
									<span class="icon is-small ml-1">
										{#if flipSortKey === 'topic' && flipSortDir === 'asc'}▲{:else if flipSortKey === 'topic' && flipSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setFlipSort('subtopic')}>
									<span>Subtopic</span>
									<span class="icon is-small ml-1">
										{#if flipSortKey === 'subtopic' && flipSortDir === 'asc'}▲{:else if flipSortKey === 'subtopic' && flipSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>Question</th>
							<th>Attempt</th>
							<th>Previous</th>
							<th>Current</th>
							<th>Flip Class</th>
						</tr>
						</thead>
						<tbody>
						{#if sortedItemFlips.length === 0}
							<tr>
								<td colspan="8" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each sortedItemFlips as flip}
								<tr>
									<td>{flip.subject_name}</td>
									<td>{flip.topic_name}</td>
									<td>{flip.subtopic_name}</td>
									<td>{flip.stem}</td>
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

				<!-- Filters: Subject / Topic / Subtopic -->
				<div class="filters is-flex is-flex-wrap-wrap mb-3" style="gap: 0.75rem;">
					<div class="select is-small">
						<select bind:value={selectedSubjectFbs} aria-label="Filter FBS by subject">
							<option value=''>All Subjects</option>
							{#each subjectOptionsFbs as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<div class="select is-small">
						<select bind:value={selectedTopicFbs} aria-label="Filter FBS by topic">
							<option value=''>All Topics</option>
							{#each topicOptionsFbs as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="select is-small">
						<select bind:value={selectedSubtopicFbs} aria-label="Filter FBS by subtopic">
							<option value=''>All Subtopics</option>
							{#each subtopicOptionsFbs as st}
								<option value={st}>{st}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setFbsSort('subject')}>
									<span>Subject</span>
									<span class="icon is-small ml-1">
										{#if fbsSortKey === 'subject' && fbsSortDir === 'asc'}▲{:else if fbsSortKey === 'subject' && fbsSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setFbsSort('topic')}>
									<span>Topic</span>
									<span class="icon is-small ml-1">
										{#if fbsSortKey === 'topic' && fbsSortDir === 'asc'}▲{:else if fbsSortKey === 'topic' && fbsSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setFbsSort('subtopic')}>
									<span>Subtopic</span>
									<span class="icon is-small ml-1">
										{#if fbsSortKey === 'subtopic' && fbsSortDir === 'asc'}▲{:else if fbsSortKey === 'subtopic' && fbsSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>Wrong → Right</th>
							<th>Right → Wrong</th>
							<th>Persist Wrong</th>
							<th>Persist Right</th>
						</tr>
						</thead>
						<tbody>
						{#if sortedFlipsBySubtopic.length === 0}
							<tr>
								<td colspan="7" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each sortedFlipsBySubtopic as flip}
								<tr>
									<td>{flip.subject_name}</td>
									<td>{flip.topic_name}</td>
									<td>{flip.subtopic_name}</td>
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

				<!-- Filters: Subject / Topic / Subtopic -->
				<div class="filters is-flex is-flex-wrap-wrap mb-3" style="gap: 0.75rem;">
					<div class="select is-small">
						<select bind:value={stSelectedSubject} aria-label="Filter ST by subject">
							<option value=''>All Subjects</option>
							{#each stSubjectOptions as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<div class="select is-small">
						<select bind:value={stSelectedTopic} aria-label="Filter ST by topic">
							<option value=''>All Topics</option>
							{#each stTopicOptions as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="select is-small">
						<select bind:value={stSelectedSubtopic} aria-label="Filter ST by subtopic">
							<option value=''>All Subtopics</option>
							{#each stSubtopicOptions as st}
								<option value={st}>{st}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="table-container">
					<table class="table is-striped is-fullwidth is-hoverable is-narrow">
						<thead>
						<tr>
							<th>Attempt</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setStSort('subject')}>
									<span>Subject</span>
									<span class="icon is-small ml-1">
										{#if stSortKey === 'subject' && stSortDir === 'asc'}▲{:else if stSortKey === 'subject' && stSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setStSort('topic')}>
									<span>Topic</span>
									<span class="icon is-small ml-1">
										{#if stSortKey === 'topic' && stSortDir === 'asc'}▲{:else if stSortKey === 'topic' && stSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setStSort('subtopic')}>
									<span>Subtopic</span>
									<span class="icon is-small ml-1">
										{#if stSortKey === 'subtopic' && stSortDir === 'asc'}▲{:else if stSortKey === 'subtopic' && stSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>N</th>
							<th>K (Correct)</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setStSort('accuracy')}>
									<span>Accuracy</span>
									<span class="icon is-small ml-1">
										{#if stSortKey === 'accuracy' && stSortDir === 'asc'}▲{:else if stSortKey === 'accuracy' && stSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
							<th>
								<button class="button is-white is-small px-0 has-text-left" on:click={() => setStSort('delta')}>
									<span>Δ Accuracy</span>
									<span class="icon is-small ml-1">
										{#if stSortKey === 'delta' && stSortDir === 'asc'}▲{:else if stSortKey === 'delta' && stSortDir === 'desc'}▼{:else}◀▶{/if}
									</span>
								</button>
							</th>
						</tr>
						</thead>
						<tbody>
						{#if sortedSubtopicTrends.length === 0}
							<tr>
								<td colspan="8" class="has-text-centered">No data available</td>
							</tr>
						{:else}
							{#each sortedSubtopicTrends as trend}
								<tr>
									<td>{trend.attempt_number}</td>
									<td>{trend.subject_name}</td>
									<td>{trend.topic_name}</td>
									<td>{trend.subtopic_name}</td>
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

    table td, table th {
        line-height: 1rem;
        font-size: 0.85rem !important;
    }

    .subtitle {
        margin-bottom: 1rem;
    }

    .filters .select select {
        min-width: 180px;
    }
</style>
