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

<div class="analytics-container">
	<div class="analytics-wrapper">
		<!-- Header -->
		<div class="analytics-header">
			<h1 class="analytics-title">Mock Exam Metrics</h1>
			<p class="analytics-subtitle">Comprehensive performance analysis across mock exam attempts and retakes</p>
		</div>

		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p class="loading-text">Loading metrics...</p>
			</div>
		{:else if errorMsg}
			<div class="error-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<p class="error-text">{errorMsg}</p>
			</div>
		{:else}
			<!-- Attempt Metrics -->
			<div class="metric-card">
				<div class="metric-header">
					<h2 class="metric-title">Mock Attempt Metrics</h2>
					<p class="metric-description">
						Per-attempt performance showing accuracy, response times, and improvements. Positive deltas indicate improvement; watch speed-accuracy tradeoffs.
					</p>
				</div>
				<div class="table-wrapper">
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th>Attempt</th>
								<th>Time</th>
								<th class="col-number">Items</th>
								<th class="col-number">Correct</th>
								<th class="col-number">Accuracy</th>
								<th class="col-number">Avg RT (ms)</th>
								<th class="col-number">Omits</th>
								<th class="col-number">Δ Accuracy</th>
								<th class="col-number">Δ RT</th>
								<th class="col-number">Δ Correct</th>
								<th class="col-number">Δ Items</th>
							</tr>
						</thead>
						<tbody>
							{#if attemptMetrics.length === 0}
								<tr>
									<td colspan="11" class="empty-cell">No data available</td>
								</tr>
							{:else}
								{#each attemptMetrics as metric}
									<tr>
										<td><span class="attempt-badge">{metric.attempt_number}</span></td>
										<td class="time-cell">{formatDateTime(metric.att_time)}</td>
										<td class="col-number">{metric.items_answered}</td>
										<td class="col-number">{metric.correct_count}</td>
										<td class="col-number"><span class="metric-value">{formatPercent(metric.accuracy)}</span></td>
										<td class="col-number"><span class="metric-value">{metric.avg_rt_ms}</span></td>
										<td class="col-number">{metric.omit_count}</td>
										<td class="col-number delta-cell">{metric.delta_accuracy ?? '—'}</td>
										<td class="col-number delta-cell">{metric.delta_avg_rt_ms ?? '—'}</td>
										<td class="col-number delta-cell">{metric.delta_correct ?? '—'}</td>
										<td class="col-number delta-cell">{metric.delta_items ?? '—'}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Series Slope -->
			<div class="metric-card">
				<div class="metric-header">
					<h2 class="metric-title">Mock Series Slope</h2>
					<p class="metric-description">
						Trend analysis per exam lineage. Positive slope = improvement per attempt; negative = regression.
					</p>
				</div>
				<div class="table-wrapper">
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th>Assessment ID</th>
								<th>Root Instance ID</th>
								<th class="col-number">Slope per Attempt</th>
								<th class="col-number">Attempts So Far</th>
							</tr>
						</thead>
						<tbody>
							{#if seriesSlopes.length === 0}
								<tr>
									<td colspan="4" class="empty-cell">No data available</td>
								</tr>
							{:else}
								{#each seriesSlopes as slope}
									<tr>
										<td class="id-cell">{slope.assessment_id}</td>
										<td class="id-cell">{slope.root_instance_id}</td>
										<td class="col-number"><span class="metric-value">{formatNumber(slope.approx_slope_per_attempt, 4)}</span></td>
										<td class="col-number">{slope.attempts_so_far}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Item Flips -->
			<div class="metric-card">
				<div class="metric-header">
					<h2 class="metric-title">Mock Item Flips</h2>
					<p class="metric-description">
						Question-level performance changes across attempts. Focus on wrong→right improvements and right→wrong regressions.
					</p>
				</div>

				<!-- Filters: Subject / Topic / Subtopic -->
				<div class="filters-row">
					<div class="filter-group">
						<label class="filter-label">Subject</label>
						<select bind:value={selectedSubject} class="modern-select" aria-label="Filter by subject">
							<option value=''>All Subjects</option>
							{#each subjectOptions as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label class="filter-label">Topic</label>
						<select bind:value={selectedTopic} class="modern-select" aria-label="Filter by topic">
							<option value=''>All Topics</option>
							{#each topicOptions as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label class="filter-label">Subtopic</label>
						<select bind:value={selectedSubtopic} class="modern-select" aria-label="Filter by subtopic">
							<option value=''>All Subtopics</option>
							{#each subtopicOptions as st}
								<option value={st}>{st}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="table-wrapper">
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th>
									<button class="sort-btn" type="button" on:click={() => setFlipSort('subject')}>
										Subject
										<span class="sort-icon">
											{#if flipSortKey === 'subject' && flipSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if flipSortKey === 'subject' && flipSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setFlipSort('topic')}>
										Topic
										<span class="sort-icon">
											{#if flipSortKey === 'topic' && flipSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if flipSortKey === 'topic' && flipSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setFlipSort('subtopic')}>
										Subtopic
										<span class="sort-icon">
											{#if flipSortKey === 'subtopic' && flipSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if flipSortKey === 'subtopic' && flipSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>Question</th>
								<th class="col-number">Attempt</th>
								<th class="col-number">Previous</th>
								<th class="col-number">Current</th>
								<th>Flip Class</th>
							</tr>
						</thead>
						<tbody>
							{#if sortedItemFlips.length === 0}
								<tr>
									<td colspan="8" class="empty-cell">No data available</td>
								</tr>
							{:else}
								{#each sortedItemFlips as flip}
									<tr>
										<td>{flip.subject_name}</td>
										<td>{flip.topic_name}</td>
										<td>{flip.subtopic_name}</td>
										<td class="question-cell">{flip.stem}</td>
										<td class="col-number"><span class="attempt-badge">{flip.attempt_number}</span></td>
										<td class="col-number">{flip.x_prev}</td>
										<td class="col-number">{flip.x_curr}</td>
										<td>
											<span class="flip-badge flip-{flip.flip_class}">
												{flip.flip_class.replace(/_/g, ' ')}
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
			<div class="metric-card">
				<div class="metric-header">
					<h2 class="metric-title">Flips by Subtopic</h2>
					<p class="metric-description">
						Aggregate flip counts per subtopic. Net improvement = wrong→right minus right→wrong. Prioritize subtopics with high right→wrong counts.
					</p>
				</div>

				<!-- Filters: Subject / Topic / Subtopic -->
				<div class="filters-row">
					<div class="filter-group">
						<label class="filter-label">Subject</label>
						<select bind:value={selectedSubjectFbs} class="modern-select" aria-label="Filter FBS by subject">
							<option value=''>All Subjects</option>
							{#each subjectOptionsFbs as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label class="filter-label">Topic</label>
						<select bind:value={selectedTopicFbs} class="modern-select" aria-label="Filter FBS by topic">
							<option value=''>All Topics</option>
							{#each topicOptionsFbs as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label class="filter-label">Subtopic</label>
						<select bind:value={selectedSubtopicFbs} class="modern-select" aria-label="Filter FBS by subtopic">
							<option value=''>All Subtopics</option>
							{#each subtopicOptionsFbs as st}
								<option value={st}>{st}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="table-wrapper">
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th>
									<button class="sort-btn" type="button" on:click={() => setFbsSort('subject')}>
										Subject
										<span class="sort-icon">
											{#if fbsSortKey === 'subject' && fbsSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if fbsSortKey === 'subject' && fbsSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setFbsSort('topic')}>
										Topic
										<span class="sort-icon">
											{#if fbsSortKey === 'topic' && fbsSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if fbsSortKey === 'topic' && fbsSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setFbsSort('subtopic')}>
										Subtopic
										<span class="sort-icon">
											{#if fbsSortKey === 'subtopic' && fbsSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if fbsSortKey === 'subtopic' && fbsSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th class="col-number">Wrong → Right</th>
								<th class="col-number">Right → Wrong</th>
								<th class="col-number">Persist Wrong</th>
								<th class="col-number">Persist Right</th>
							</tr>
						</thead>
						<tbody>
							{#if sortedFlipsBySubtopic.length === 0}
								<tr>
									<td colspan="7" class="empty-cell">No data available</td>
								</tr>
							{:else}
								{#each sortedFlipsBySubtopic as flip}
									<tr>
										<td>{flip.subject_name}</td>
										<td>{flip.topic_name}</td>
										<td>{flip.subtopic_name}</td>
										<td class="col-number"><span style="color: #059669; font-weight: 600;">{flip.cnt_w2r}</span></td>
										<td class="col-number"><span style="color: #dc2626; font-weight: 600;">{flip.cnt_r2w}</span></td>
										<td class="col-number">{flip.cnt_persist_wrong}</td>
										<td class="col-number">{flip.cnt_persist_right}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Subtopic Trends -->
			<div class="metric-card">
				<div class="metric-header">
					<h2 class="metric-title">Subtopic Trends</h2>
					<p class="metric-description">
						Performance changes per subtopic across attempts. Positive delta indicates improving mastery; watch regressions and low sample sizes.
					</p>
				</div>

				<!-- Filters: Subject / Topic / Subtopic -->
				<div class="filters-row">
					<div class="filter-group">
						<label class="filter-label">Subject</label>
						<select bind:value={stSelectedSubject} class="modern-select" aria-label="Filter ST by subject">
							<option value=''>All Subjects</option>
							{#each stSubjectOptions as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label class="filter-label">Topic</label>
						<select bind:value={stSelectedTopic} class="modern-select" aria-label="Filter ST by topic">
							<option value=''>All Topics</option>
							{#each stTopicOptions as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="filter-group">
						<label class="filter-label">Subtopic</label>
						<select bind:value={stSelectedSubtopic} class="modern-select" aria-label="Filter ST by subtopic">
							<option value=''>All Subtopics</option>
							{#each stSubtopicOptions as st}
								<option value={st}>{st}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="table-wrapper">
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th class="col-number">Attempt</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setStSort('subject')}>
										Subject
										<span class="sort-icon">
											{#if stSortKey === 'subject' && stSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if stSortKey === 'subject' && stSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setStSort('topic')}>
										Topic
										<span class="sort-icon">
											{#if stSortKey === 'topic' && stSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if stSortKey === 'topic' && stSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th>
									<button class="sort-btn" type="button" on:click={() => setStSort('subtopic')}>
										Subtopic
										<span class="sort-icon">
											{#if stSortKey === 'subtopic' && stSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if stSortKey === 'subtopic' && stSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th class="col-number">N</th>
								<th class="col-number">K (Correct)</th>
								<th class="col-number">
									<button class="sort-btn" type="button" on:click={() => setStSort('accuracy')}>
										Accuracy
										<span class="sort-icon">
											{#if stSortKey === 'accuracy' && stSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if stSortKey === 'accuracy' && stSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
								<th class="col-number">
									<button class="sort-btn" type="button" on:click={() => setStSort('delta')}>
										Δ Accuracy
										<span class="sort-icon">
											{#if stSortKey === 'delta' && stSortDir === 'asc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
											{:else if stSortKey === 'delta' && stSortDir === 'desc'}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
											{/if}
										</span>
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							{#if sortedSubtopicTrends.length === 0}
								<tr>
									<td colspan="8" class="empty-cell">No data available</td>
								</tr>
							{:else}
								{#each sortedSubtopicTrends as trend}
									<tr>
										<td class="col-number"><span class="attempt-badge">{trend.attempt_number}</span></td>
										<td>{trend.subject_name}</td>
										<td>{trend.topic_name}</td>
										<td>{trend.subtopic_name}</td>
										<td class="col-number">{trend.n}</td>
										<td class="col-number">{trend.k}</td>
										<td class="col-number"><span class="metric-value">{formatPercent(trend.accuracy)}</span></td>
										<td class="col-number delta-cell">{trend.delta_accuracy_subtopic ?? '—'}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
    /* Container */
    .analytics-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
        padding: 2rem 1rem;
    }

    .analytics-wrapper {
        max-width: 1400px;
        margin: 0 auto;
    }

    /* Header */
    .analytics-header {
        background: #ffffff;
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(139, 92, 246, 0.1);
    }

    .analytics-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.75rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.5rem 0;
    }

    .analytics-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #6b7280;
        margin: 0;
        line-height: 1.5;
    }

    /* Loading/Error States */
    .loading-state,
    .error-state {
        background: #ffffff;
        border-radius: 12px;
        padding: 3rem 2rem;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #f3f4f6;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 1rem;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .loading-text,
    .error-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #6b7280;
        margin: 0;
    }

    .error-state svg {
        color: #ef4444;
        margin-bottom: 1rem;
    }

    /* Metric Card */
    .metric-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(0, 0, 0, 0.05);
        margin-bottom: 1.5rem;
        overflow: hidden;
    }

    .metric-header {
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #f3f4f6;
    }

    .metric-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.5rem 0;
    }

    .metric-description {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6b7280;
        margin: 0;
        line-height: 1.5;
    }

    /* Filters */
    .filters-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #f3f4f6;
        background: linear-gradient(135deg, #faf9fc, #f9f8fb);
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 200px;
    }

    .filter-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .modern-select {
        padding: 0.625rem 0.875rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #374151;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .modern-select:hover {
        border-color: #8b5cf6;
    }

    .modern-select:focus {
        outline: none;
        border-color: #8b5cf6;
        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    }

    /* Table */
    .table-wrapper {
        overflow-x: auto;
    }

    .modern-analytics-table {
        width: 100%;
        border-collapse: collapse;
        font-family: 'Inter', sans-serif;
    }

    .modern-analytics-table thead {
        background: linear-gradient(135deg, #faf9fc, #f5f3f7);
        border-bottom: 2px solid rgba(139, 92, 246, 0.1);
    }

    .modern-analytics-table thead th {
        padding: 1rem;
        text-align: left;
        font-size: 0.8125rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .modern-analytics-table thead th.col-number {
        text-align: right;
    }

    .modern-analytics-table tbody tr {
        border-bottom: 1px solid #f3f4f6;
        transition: all 0.15s ease;
    }

    .modern-analytics-table tbody tr:hover {
        background: #faf9fc;
    }

    .modern-analytics-table tbody td {
        padding: 0.875rem 1rem;
        font-size: 0.875rem;
        color: #374151;
    }

    .modern-analytics-table tbody td.col-number {
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: #6b7280;
    }

    /* Sort Button */
    .sort-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        background: transparent;
        border: none;
        padding: 0;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: color 0.2s ease;
    }

    .sort-btn:hover {
        color: #8b5cf6;
    }

    .sort-icon {
        display: flex;
        align-items: center;
        color: #9ca3af;
        transition: color 0.2s ease;
    }

    .sort-btn:hover .sort-icon {
        color: #8b5cf6;
    }

    /* Cell Types */
    .empty-cell {
        text-align: center;
        color: #9ca3af;
        font-style: italic;
        padding: 2rem !important;
    }

    .attempt-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0 0.5rem;
        background: linear-gradient(135deg, #a855f7, #8b5cf6);
        color: #ffffff;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
    }

    .time-cell {
        font-size: 0.8125rem;
        color: #6b7280;
        white-space: nowrap;
    }

    .id-cell {
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 0.75rem;
        color: #6b7280;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .question-cell {
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .metric-value {
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        color: #374151;
    }

    .delta-cell {
        font-variant-numeric: tabular-nums;
        color: #9ca3af;
    }

    /* Flip Badges */
    .flip-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: capitalize;
        white-space: nowrap;
    }

    .flip-badge.flip-wrong_to_right {
        background: rgba(16, 185, 129, 0.15);
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .flip-badge.flip-right_to_wrong {
        background: rgba(239, 68, 68, 0.15);
        color: #dc2626;
        border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .flip-badge.flip-persistent_right {
        background: rgba(99, 102, 241, 0.15);
        color: #4f46e5;
        border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .flip-badge.flip-persistent_wrong {
        background: rgba(245, 158, 11, 0.15);
        color: #d97706;
        border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .flip-badge.flip-first_seen {
        background: rgba(156, 163, 175, 0.15);
        color: #6b7280;
        border: 1px solid rgba(156, 163, 175, 0.3);
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        .analytics-container {
            padding: 1rem 0.5rem;
        }

        .analytics-header {
            padding: 1.5rem;
        }

        .analytics-title {
            font-size: 1.5rem;
        }

        .analytics-subtitle {
            font-size: 0.875rem;
        }

        .metric-header {
            padding: 1rem 1.5rem;
        }

        .filters-row {
            flex-direction: column;
            padding: 1rem 1.5rem;
        }

        .filter-group {
            min-width: 100%;
        }

        .modern-analytics-table {
            font-size: 0.8125rem;
        }

        .modern-analytics-table thead th,
        .modern-analytics-table tbody td {
            padding: 0.75rem 0.5rem;
        }

        .question-cell {
            max-width: 200px;
        }
    }
</style>
