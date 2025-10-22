<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatHuman, formatUTC, formatPattern } from '$lib/datetime';
	import { browser } from '$app/environment';

	let user: any;
	let activeAssessments: any[] = [];
	let completedAssessments: any[] = [];
	let banks: any[] = [];

	// calendar state
	let calendarData: any[] = [];
	let calendarWeeks: any[][] = [];
	let calendarLoading = true;
	let calendarError = '';
	let tooltip = { visible: false, x: 0, y: 0, date: '', answered: 0, correct: 0, accuracy: null, avg_rt_ms: null };

	let monthLabels: string[] = [];

	function getCalendarDayColor(acc: number | null): string {
		if (acc === null || isNaN(acc)) return '#aaaaaa';
		if (acc < 0.3) return '#d00000';
		if (acc < 0.5) return '#e36414';
		if (acc < 0.75) return '#fb8b24';
		if (acc < 0.8) return '#98c1d9';
		if (acc < 0.85) return '#4b8a6f';
		if (acc < 0.9) return '#07f6c3';
		return '#07f6c3';
	}

	function showTooltip(day: any, event: MouseEvent) {
		if (!day.stat_date) return;
		tooltip = {
			visible: true,
			x: event.pageX + 8,
			y: event.pageY - 8,
			date: day.stat_date,
			answered: day.answered,
			correct: day.correct,
			accuracy: day.accuracy,
			avg_rt_ms: day.avg_rt_ms
		};
	}

	function hideTooltip() {
		tooltip.visible = false;
	}


	// Sorting state variables
	let activeSortBy: 'date' | 'title' | 'type' | 'score' = 'date';
	let activeSortDir: 'asc' | 'desc' = 'desc';
	let completedSortBy: 'date' | 'title' | 'type' | 'score' = 'date';
	let completedSortDir: 'asc' | 'desc' = 'desc';

	// Filter state variables
	type AssessmentType = 'prompt' | 'short_quiz' | 'long_quiz' | 'mock_exam';
	let activeTypeFilters: Set<AssessmentType> = new Set(['prompt', 'short_quiz', 'long_quiz', 'mock_exam']);
	let completedTypeFilters: Set<AssessmentType> = new Set(['prompt', 'short_quiz', 'long_quiz', 'mock_exam']);

	const typeLabels: Record<AssessmentType, string> = {
		prompt: 'Single Question Prompt',
		short_quiz: 'Short Quiz',
		long_quiz: 'Adaptive Quiz',
		mock_exam: 'Mock Exam'
	};

	function toggleTypeFilter(type: AssessmentType, section: 'active' | 'completed') {
		if (section === 'active') {
			if (activeTypeFilters.has(type)) {
				activeTypeFilters.delete(type);
			} else {
				activeTypeFilters.add(type);
			}
			activeTypeFilters = new Set(activeTypeFilters);
		} else {
			if (completedTypeFilters.has(type)) {
				completedTypeFilters.delete(type);
			} else {
				completedTypeFilters.add(type);
			}
			completedTypeFilters = new Set(completedTypeFilters);
		}
	}

	function filterByType(list: any[], typeFilters: Set<AssessmentType>) {
		return list.filter(item => typeFilters.has(item.type as AssessmentType));
	}

	// Toggle sorting direction for a section
	function toggleSort(type: 'active' | 'completed') {
		if (type === 'active') {
			activeSortDir = activeSortDir === 'asc' ? 'desc' : 'asc';
		} else {
			completedSortDir = completedSortDir === 'asc' ? 'desc' : 'asc';
		}
	}

	/**
	 * Sorts a list of assessments by a given key and direction.
	 * @param list Array of assessments
	 * @param key Sort key: 'date' | 'title' | 'type' | 'score'
	 * @param dir 'asc' | 'desc'
	 */
	function sortAssessments(list: any[], key: 'date' | 'title' | 'type' | 'score', dir: 'asc' | 'desc') {
		const sorted = [...list].sort((a, b) => {
			let v1: any, v2: any;
			switch (key) {
				case 'date':
					// Use assigned_at for active, completed_at for completed
					v1 = a.assigned_at || a.completed_at;
					v2 = b.assigned_at || b.completed_at;
					return (new Date(v1).getTime() - new Date(v2).getTime()) * (dir === 'asc' ? 1 : -1);
				case 'title':
					v1 = (a.title || '').toLowerCase();
					v2 = (b.title || '').toLowerCase();
					return v1.localeCompare(v2) * (dir === 'asc' ? 1 : -1);
				case 'type':
					v1 = (a.type || '').toLowerCase();
					v2 = (b.type || '').toLowerCase();
					return v1.localeCompare(v2) * (dir === 'asc' ? 1 : -1);
				case 'score':
					// If score is missing, sort those last
					v1 = a.score ?? -Infinity;
					v2 = b.score ?? -Infinity;
					return (v1 - v2) * (dir === 'asc' ? 1 : -1);
				default:
					return 0;
			}
		});
		return sorted;
	}

	/**
	 * Returns a CSS color for a mastery score (0-100)
	 * @param score number
	 * @returns CSS color string
	 */
	function getMasteryColor(score: number | undefined): string {
		if (score === undefined || score === null) return 'var(--grey-light)';
		if (score >= 90) return 'var(--kaizen-mastery-excellent, #2ecc40)';
		if (score >= 75) return 'var(--kaizen-mastery-high, #00bfae)';
		if (score >= 60) return 'var(--kaizen-mastery-good, #ffd600)';
		if (score >= 40) return 'var(--kaizen-mastery-fair, #ff9800)';
		return 'var(--kaizen-mastery-low, #e74c3c)';
	}

	// Pagination for dashboard lists
	let activeShowCount = 9;
	let completedShowCount = 9;

	let loading = true;
	let error = '';


	let showCustomModal = false;
	let creating = false;

	let form = {
		type: 'short',
		title: '',
		bank_id: '',
		total_items: 10,
		easy: 30,
		medium: 40,
		hard: 30,
		start_items: 10,
		prompt_text: ''
	};

	const unsubscribe = userStore.subscribe((v) => (user = v));

	let showAnalyticsMenu = false;

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.dropdown')) {
			showAnalyticsMenu = false;
		}
	}

	function buildCalendarGridFixed(data: any[]): any[][] {
		// group incoming rows by week
		const weeksByIndex: Record<number, any[]> = {};
		for (const d of data) {
			(weeksByIndex[d.week_index] ??= []).push(d);
		}

		// determine the visible window: exactly 52 weeks ending in the max week we have
		const maxWeek = Math.max(...Object.keys(weeksByIndex).map(Number));
		const minWeek = maxWeek - 51;

		const grid: any[][] = [];
		for (let w = minWeek; w <= maxWeek; w++) {
			const days = weeksByIndex[w] ?? [];
			// start the column with 7 dummy slots
			const col = Array.from({ length: 7 }, () => ({
				stat_date: null,
				accuracy: null,
				answered: null,
				correct: null,
				avg_rt_ms: null,
				isDummy: true
			}));

			// drop the real days into their dow slots
			for (const d of days) {
				if (d.dow >= 0 && d.dow <= 6) col[d.dow] = { ...d, isDummy: false };
			}
			grid.push(col);
		}
		return grid;
	}

	/**
	 * Month labels aligned to columns.
	 * We label a column with the month of its **first real day** when that month changes.
	 */
	function buildMonthLabels(weeks: any[][]): string[] {
		const labels: string[] = [];
		const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		let lastMonth: number | null = null;

		for (const col of weeks) {
			const firstReal = col.find((d) => d && d.stat_date);
			if (!firstReal) { labels.push(''); continue; }
			const m = new Date(firstReal.stat_date).getMonth();
			if (m !== lastMonth) {
				labels.push(months[m]);
				lastMonth = m;
			} else {
				labels.push('');
			}
		}
		return labels;
	}

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

		// calendar funcs
		try {
			const { data: rawCalendarData, error: calErr } = await supabase.rpc(
				'rpc_get_user_calendar_grid',
				{ p_user_id: user.user_id }
			);
			if (calErr) throw calErr;

			calendarData = rawCalendarData || [];

			// Build the strict 52x7 grid
			calendarWeeks = buildCalendarGridFixed(calendarData);

			// Month labels that align to the columns
			monthLabels = buildMonthLabels(calendarWeeks);
		} catch (err: any) {
			calendarError = err.message;
		} finally {
			calendarLoading = false;
		}

		// dropdown outside click – browser only
		if (browser) document.addEventListener('click', handleClickOutside);

		try {
			const [activeRes, completedRes, bankRes] = await Promise.all([
				supabase.rpc('rpc_fetch_active_assessments', { p_user_id: user.user_id }),
				supabase.rpc('rpc_fetch_completed_assessments', { p_user_id: user.user_id }),
				supabase.rpc('rpc_get_user_banks', { p_user_id: user.user_id })
			]);

			if (activeRes.error) throw activeRes.error;
			if (completedRes.error) throw completedRes.error;
			if (bankRes.error) throw bankRes.error;

			activeAssessments = activeRes.data || [];
			completedAssessments = completedRes.data || [];
			banks = bankRes.data || [];
		} catch (err: any) {
			console.error(err);
			error = err.message || 'Failed to load dashboard data.';
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {

	});

	// ---------- Standard Actions ----------
	async function startPrompt() {
		try {
			const { data, error } = await supabase.rpc('rpc_generate_prompt_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_title: 'Daily Recall Prompt'
			});
			if (error) throw error;
			const instanceId = data?.instance_id || data;
			goto(`/prompt/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function startShortQuiz() {
		try {
			const { data, error } = await supabase.rpc('rpc_generate_standard_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_total: 10,
				p_title: 'Short Quiz'
			});
			if (error) throw error;
			const instanceId = data?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function startAdaptiveQuiz() {
		try {
			const { data, error } = await supabase.rpc('rpc_generate_adaptive_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_total: 15,
				p_title: 'Adaptive Diagnostic Quiz'
			});
			if (error) throw error;
			const instanceId = data?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function startMockExam() {
		try {
			const { data, error } = await supabase.rpc('rpc_generate_mock_exam', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_title: 'Mock Exam'
			});
			if (error) throw error;
			const instanceId = data?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	// ---------- Retake Mock Exam ----------
	async function retakeMockExam(instanceId: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();

		try {
			const { data, error } = await supabase.rpc('rpc_duplicate_assessment_instance', {
				p_instance_id: instanceId
			});
			if (error) throw error;
			const newInstanceId = data?.instance_id || data;
			goto(`/assessment/${newInstanceId}`);
		} catch (err: any) {
			alert('Error retaking assessment: ' + err.message);
		}
	}

	// ---------- Custom Assessment Creation ----------
	async function createCustomAssessment() {
		if (!form.bank_id || !form.title) {
			alert('Please provide a title and select a bank.');
			return;
		}

		creating = true;

		const org_id = user.orgs?.[0]?.org_id;
		const uid = user.user_id;
		let rpcName = '';
		let params: any = {};

		try {
			switch (form.type) {
				case 'prompt':
					rpcName = 'rpc_generate_prompt_assessment_from_bank';
					params = {
						p_org_id: org_id,
						p_user_id: uid,
						p_bank_id: form.bank_id,
						p_title: form.title,
						p_prompt: form.prompt_text || '',
						p_total_items: 1
					};
					break;
				case 'short':
					rpcName = 'rpc_generate_standard_assessment_from_bank';
					params = {
						p_org_id: org_id,
						p_user_id: uid,
						p_bank_id: form.bank_id,
						p_title: form.title,
						p_total_items: form.total_items
					};
					break;
				case 'adaptive':
					rpcName = 'rpc_generate_adaptive_assessment_from_bank';
					params = {
						p_org_id: org_id,
						p_user_id: uid,
						p_bank_id: form.bank_id,
						p_title: form.title,
						p_start_items: form.start_items
					};
					break;
				case 'mock':
					rpcName = 'rpc_generate_mock_exam_from_bank';
					params = {
						p_org_id: org_id,
						p_user_id: uid,
						p_bank_id: form.bank_id,
						p_title: form.title,
						p_easy_count: form.easy,
						p_medium_count: form.medium,
						p_hard_count: form.hard
					};
					break;
			}

			const { data, error } = await supabase.rpc(rpcName, params);
			if (error) throw error;

			const instanceId = data?.instance_id || data;
			if (!instanceId) throw new Error('No instance_id returned.');

			showCustomModal = false;
			// alert('Assessment created successfully!');

			goto(form.type === 'prompt' ? `/prompt/${instanceId}` : `/assessment/${instanceId}`);
		} catch (err: any) {
			alert('Error creating assessment: ' + err.message);
		} finally {
			creating = false;
		}
	}
</script>

<section class="section">
	<div class="container py-0">
		<div class="assessment-grid mb-5">
			<button type="button" class="assessment-tile prompt" on:click={startPrompt}>
				<div class="icon">📋</div>
				<h3>Daily Prompt</h3>
				<p>Quick single-question recall exercise</p>
			</button>

			<button type="button" class="assessment-tile short" on:click={startShortQuiz}>
				<div class="icon">🧠</div>
				<h3>Short Quiz</h3>
				<p>10 randomized questions for quick practice</p>
			</button>

			<button type="button" class="assessment-tile adaptive" on:click={startAdaptiveQuiz}>
				<div class="icon">📊</div>
				<h3>Adaptive Quiz</h3>
				<p>Progressive difficulty based on performance</p>
			</button>

			<button type="button" class="assessment-tile mock" on:click={startMockExam}>
				<div class="icon">🏁</div>
				<h3>Mock Exam</h3>
				<p>Full-length simulation of real exams</p>
			</button>
		</div>

		<div class="sub-buttons">
			<button class="button is-info" on:click={() => (showCustomModal = true)}>⚙️ Custom Assessment</button>
			<div class="dropdown {showAnalyticsMenu ? 'is-active' : ''}">
				<div class="dropdown-trigger">
					<button
						class="button is-link"
						aria-haspopup="true"
						aria-controls="analytics-menu"
						on:click={() => (showAnalyticsMenu = !showAnalyticsMenu)}
					>
						<span>📈 View Analytics</span>
						<span class="icon is-small">▾</span>
					</button>
				</div>
				<div class="dropdown-menu" id="analytics-menu" role="menu">
					<div class="dropdown-content">
						<a href="/analytics/subtopic_summary" class="dropdown-item">Subtopic Summary</a>
						<a href="/analytics/mock_exam_metrics" class="dropdown-item">Mock Exam Trends</a>
					</div>
				</div>
			</div>
		</div>

		<!-- calendar grid goes here -->
		{#if user?.user_id}
			<div class="calendar-container mt-6 mb-6">
				<h3 class="title is-5 mb-3">Activity Calendar</h3>

				{#if calendarLoading}
					<p>Loading calendar...</p>
				{:else if calendarError}
					<p class="has-text-danger">{calendarError}</p>
				{:else}
					<div class="calendar-inner">
						<div class="calendar-months" aria-hidden="true">
							{#each monthLabels as m}
								<div class="month-label">{m}</div>
							{/each}
						</div>
						<!-- Calendar grid -->
						<div class="calendar-grid">
							{#each calendarWeeks as week}
								<div class="calendar-week">
									{#each week as day}
										<div
											class="calendar-day"
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

					<!-- Tooltip -->
					{#if tooltip.visible}
						<div
							class="calendar-tooltip"
							style="top:{tooltip.y}px; left:{tooltip.x}px"
						>
							<strong style="color: #fff!important;">{tooltip.date}</strong><br />
							Answered: {tooltip.answered}<br />
							Correct: {tooltip.correct}<br />
							Accuracy:
							{tooltip.accuracy !== null
								? (tooltip.accuracy * 100).toFixed(1) + '%'
								: 'N/A'}<br />
							Avg RT:
							{tooltip.avg_rt_ms !== null
								? Math.round(tooltip.avg_rt_ms / 1000) + 's'
								: 'N/A'}
						</div>
					{/if}

					<!-- Legend -->
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
			</div>
		{/if}
		<!-- /calendar grid -->

		{#if loading}
			<p>Loading your assessments...</p>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else}
			<div class="list-header mt-5 mb-2">
				<h3 class="title is-5 mb-0">Active Assessments</h3>
				<div class="sort-controls">
					<label for="active-sort-select" class="is-sr-only">Sort Active Assessments</label>
					<select id="active-sort-select" bind:value={activeSortBy} class="select is-small mr-2">
						<option value="date">By Date</option>
						<option value="title">By Title</option>
						<option value="type">By Type</option>
						<option value="score">By Score</option>
					</select>
					<button class="button is-small" type="button" aria-label="Toggle sort direction"
									on:click={() => toggleSort('active')}>
						{#if activeSortDir === 'asc'}
							<span>▲</span>
						{:else}
							<span>▼</span>
						{/if}
					</button>
				</div>
			</div>
			<div class="type-filters mb-3">
				{#each Object.entries(typeLabels) as [type, label]}
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={activeTypeFilters.has(type as AssessmentType)}
							on:change={() => toggleTypeFilter(type as AssessmentType, 'active')}
						/>
						<span>{label}</span>
					</label>
				{/each}
			</div>
			{#if filterByType(activeAssessments, activeTypeFilters).length === 0}
				<p>No active assessments.</p>
			{:else}
				<!-- Responsive grid for active assessments -->
				<div class="dashboard-grid">
					{#each sortAssessments(filterByType(activeAssessments, activeTypeFilters), activeSortBy, activeSortDir).slice(0, activeShowCount) as a (a.instance_id)}
						<a href={`/assessment/${a.instance_id}`} class="card assessment-card dashboard-card">
							<div class="card-content">
								<p class="title is-6 mb-2">{a.title}</p>
								<p class="subtitle is-7 mb-2">{a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : ''}
									Assessment</p>
								{#if a.description}
									<p class="is-size-7 mb-2 has-text-grey">{a.description}</p>
								{/if}
								<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
									<span class="is-size-7 has-text-grey">Status: {a.status}</span>
									<span
										class="is-size-7">{a.total_items ? `${a.progress}% (${a.answered_items || 0}/${a.total_items})` : ''}</span>
								</div>
								{#if a.total_items}
									<progress class="progress is-info is-small" value={a.progress} max="100">{a.progress}%</progress>
								{/if}
								{#if a.score !== undefined && a.score !== null}
									<p class="is-size-7 mt-2">Current Score: {a.score}%</p>
								{/if}
								<p class="is-size-7 mt-2">Assigned: {formatHuman(a.assigned_at, { timeZone: 'Asia/Manila' })}</p>
								{#if a.last_activity_at}
									<p class="is-size-7">Last Activity: {formatHuman(a.last_activity_at, { timeZone: 'Asia/Manila' })}</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
				{#if activeShowCount < filterByType(activeAssessments, activeTypeFilters).length}
					<div class="has-text-centered mt-3">
						<button class="button is-small is-link" on:click={() => (activeShowCount += 9)}>
							Show More
						</button>
					</div>
				{/if}
			{/if}

			<div class="list-header mt-6 mb-2">
				<h3 class="title is-5 mb-0">Completed Assessments</h3>
				<div class="sort-controls">
					<label for="completed-sort-select" class="is-sr-only">Sort Completed Assessments</label>
					<select id="completed-sort-select" bind:value={completedSortBy} class="select is-small mr-2">
						<option value="date">By Date</option>
						<option value="title">By Title</option>
						<option value="type">By Type</option>
						<option value="score">By Score</option>
					</select>
					<button class="button is-small" type="button" aria-label="Toggle sort direction"
									on:click={() => toggleSort('completed')}>
						{#if completedSortDir === 'asc'}
							<span>▲</span>
						{:else}
							<span>▼</span>
						{/if}
					</button>
				</div>
			</div>
			<div class="type-filters mb-3">
				{#each Object.entries(typeLabels) as [type, label]}
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={completedTypeFilters.has(type as AssessmentType)}
							on:change={() => toggleTypeFilter(type as AssessmentType, 'completed')}
						/>
						<span>{label}</span>
					</label>
				{/each}
			</div>
			{#if filterByType(completedAssessments, completedTypeFilters).length === 0}
				<p>No completed assessments yet.</p>
			{:else}
				<!-- Responsive grid for completed assessments -->
				<div class="dashboard-grid">
					{#each sortAssessments(filterByType(completedAssessments, completedTypeFilters), completedSortBy, completedSortDir).slice(0, completedShowCount) as c (c.instance_id)}
						<div class="card assessment-card dashboard-card"
							 style="border-left: 4px solid {getMasteryColor(c.score)};"
						>
							<a href={`/results/${c.instance_id}`} class="card-link">
								<div class="card-content">
									<p class="title is-6 mb-2">{c.title}</p>
									<p class="subtitle is-7 mb-2">{c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : ''}
										Assessment</p>
									{#if c.description}
										<p class="is-size-7 mb-2 has-text-grey">{c.description}</p>
									{/if}
									<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
										<span class="is-size-7">Score: {c.score}%</span>
										<span
											class="is-size-7">{c.raw_score !== undefined && c.total_items ? `(${c.raw_score}/${c.total_items})` : ''}</span>
									</div>
									{#if c.completed_at}
										<p class="is-size-7 mt-2">Completed: {formatHuman(c.completed_at, { timeZone: 'Asia/Manila' })}</p>
									{/if}
									{#if c.duration_seconds}
										<p class="is-size-7">Duration: {Math.round(c.duration_seconds / 60)} min</p>
									{/if}
								</div>
							</a>
							{#if c.parent_id !== null}
								<div class="card-footer card-footer-item">
										<a href="{`/results/${c.parent_id}`}" class="is-size-6 card-link">Parent Detail</a>
								</div>
							{/if}
							{#if c.type === 'mock_exam'}
								<div class="card-footer">
									<button
										class="button is-small is-primary card-footer-item"
										on:click={(e) => retakeMockExam(c.instance_id, e)}
									>
										🔄 Retake
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				{#if completedShowCount < filterByType(completedAssessments, completedTypeFilters).length}
					<div class="has-text-centered mt-3">
						<button class="button is-small is-link" on:click={() => (completedShowCount += 9)}>
							Show More
						</button>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</section>

<!-- ---------- Modal ---------- -->
{#if showCustomModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={() => (showCustomModal = false)}></div>
		<div class="modal-card" style="width: 90%; max-width: 600px;">
			<header class="modal-card-head">
				<p class="modal-card-title">Create Custom Assessment</p>
				<button class="delete" aria-label="close" on:click={() => (showCustomModal = false)}></button>
			</header>
			<section class="modal-card-body">
				<div class="field">
					<label class="label">Type</label>
					<div class="control">
						<div class="select is-fullwidth">
							<select bind:value={form.type}>
								<option value="prompt">Prompt</option>
								<option value="short">Short Quiz</option>
								<option value="adaptive">Adaptive</option>
								<option value="mock">Mock Exam</option>
							</select>
						</div>
					</div>
				</div>

				<div class="field">
					<label class="label">Question Bank</label>
					<div class="control">
						<div class="select is-fullwidth">
							<select bind:value={form.bank_id}>
								<option value="">Select Bank</option>
								{#each banks as b}
									<option value={b.bank_id}>{b.name}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div class="field">
					<label class="label">Title</label>
					<div class="control">
						<input class="input" type="text" bind:value={form.title} placeholder="Assessment title" />
					</div>
				</div>

				{#if form.type === 'short'}
					<div class="field">
						<label class="label">Total Items</label>
						<input class="input" type="number" min="1" bind:value={form.total_items} />
					</div>
				{:else if form.type === 'mock'}
					<div class="field">
						<label class="label">Difficulty Split</label>
						<div class="columns">
							<div class="column">
								<label class="label is-small">Easy</label>
								<input class="input" type="number" min="0" bind:value={form.easy} />
							</div>
							<div class="column">
								<label class="label is-small">Medium</label>
								<input class="input" type="number" min="0" bind:value={form.medium} />
							</div>
							<div class="column">
								<label class="label is-small">Hard</label>
								<input class="input" type="number" min="0" bind:value={form.hard} />
							</div>
						</div>
					</div>
				{:else if form.type === 'adaptive'}
					<div class="field">
						<label class="label">Starting Items</label>
						<input class="input" type="number" min="1" bind:value={form.start_items} />
					</div>
				{/if}
			</section>
			<footer class="modal-card-foot">
				<button class="button is-success" on:click={createCustomAssessment} disabled={creating}>
					{creating ? 'Creating...' : 'Create'}
				</button>
				<button class="button" on:click={() => (showCustomModal = false)}>Cancel</button>
			</footer>
		</div>
	</div>
{/if}

<style>
    .list-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        gap: 1rem;
    }

    .sort-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .is-sr-only {
        position: absolute !important;
        height: 1px;
        width: 1px;
        overflow: hidden;
        clip: rect(1px, 1px, 1px, 1px);
        white-space: nowrap;
    }

    .type-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 0.75rem 0;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.95rem;
    }

    .checkbox-label input[type="checkbox"] {
        cursor: pointer;
    }

    .checkbox-label span {
        user-select: none;
    }

    .assessment-card {
        display: block;
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
    }

    .assessment-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .card-link {
        display: block;
        color: inherit;
        text-decoration: none;
    }

    .card-footer {
        border-top: 1px solid #ededed;
    }

    .card-footer-item {
        border: none;
        border-radius: 0;
        width: 100%;
    }

    /* Responsive dashboard grid */
    .dashboard-grid {
        display: grid;
        grid-gap: 1.5rem;
        grid-template-columns: 1fr;
        margin-bottom: 1.5rem;
    }

    @media (min-width: 600px) {
        .dashboard-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (min-width: 900px) {
        .dashboard-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    .dashboard-card {
        min-width: 0;
    }

    .assessment-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem;
        margin-bottom: 1.5rem;
    }

    .assessment-tile {
        background: #ffffff;
        border-radius: 14px;
        padding: 1.75rem 1.25rem;
        text-align: center;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
        cursor: pointer;
        transition: all 0.25s ease;
    }

    .assessment-tile:hover {
        transform: translateY(-4px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    }

    .assessment-tile .icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }

    .assessment-tile h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
        color: var(--color-text-primary);
    }

    .assessment-tile p {
        font-size: 0.95rem;
        color: #666;
        line-height: 1.4;
    }

    /* Sub buttons row */
    .sub-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .sub-buttons .button {
        font-size: 0.95rem;
        padding: 0.6rem 1.2rem;
    }

    /* Color accents per tile */
    .assessment-tile.prompt {
        background: linear-gradient(135deg, #fef6e4, #fff);
        border-top: 4px solid #f4a261;
    }

    .assessment-tile.short {
        background: linear-gradient(135deg, #f1f7ff, #fff);
        border-top: 4px solid #9ad4d6;
    }

    .assessment-tile.adaptive {
        background: linear-gradient(135deg, #f4f9f9, #fff);
        border-top: 4px solid #2a9d8f;
    }

    .assessment-tile.mock {
        background: linear-gradient(135deg, #f9f7ff, #fff);
        border-top: 4px solid #264653;
    }

    @media (max-width: 768px) {
        .assessment-tile {
            padding: 1.25rem;
        }

        .assessment-tile h3 {
            font-size: 1.1rem;
        }
    }

    .dropdown {
        position: relative;
    }

    .dropdown-menu {
        display: none;
        position: absolute;
        z-index: 20;
    }

    .dropdown.is-active .dropdown-menu {
        display: block;
    }

    .dropdown-content {
        min-width: 220px;
				background-color: #fff;
				box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    }

		.dropdown-item {
				background-color: #fff;
		}

		/*    calendar*/
    /* === ACTIVITY CALENDAR === */

    .calendar-container {
        width: 100%;
        overflow-x: auto;
        padding-bottom: 0.5rem;
        font-size: 0.8rem;
    }

    .calendar-inner {
        display: inline-block;
        position: relative;
        padding-left: 32px; /* space for Mon/Wed/Fri labels */
    }



    .month-label {
        text-align: left;
        white-space: nowrap;
    }

    /* Day of week labels */
    .calendar-dow {
        position: absolute;
        left: 0;
        top: 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: calc(7 * 14px + 6 * 3px);
        font-size: 0.75rem;
        color: #666;
    }

    /* Stretch full width with fixed proportional columns */
    .calendar-inner {
        display: block;
        width: 100%;
        overflow-x: auto;
        position: relative;
        padding-left: 32px; /* for Mon/Wed/Fri */
    }

    /* Each of 52 columns should evenly fill width */
    .calendar-grid {
        display: grid;
        grid-template-rows: repeat(7, 14px);
        grid-template-columns: repeat(52, 1fr);
        gap: 3px;
        width: 100%;
    }

    .calendar-months {
        display: grid;
        grid-template-columns: repeat(52, 1fr);
        gap: 3px;
        margin-bottom: 6px;
        font-size: 0.75rem;
        color: #666;
    }

    .calendar-day {
        width: 14px;
        height: 14px;
        border-radius: 2px;
				margin-bottom: 2px;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    }

    .calendar-day.dummy {
        cursor: default;
        background-color: transparent !important;
        box-shadow: none !important;
        transform: none !important;
    }

    .calendar-day:hover:not(.dummy) {
        transform: scale(1.25);
        box-shadow: 0 0 5px rgba(0,0,0,0.25);
        z-index: 10;
    }

    .calendar-tooltip {
        position: fixed;
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 6px 8px;
        font-size: 0.75rem;
        border-radius: 4px;
        pointer-events: none;
        z-index: 1000;
        white-space: nowrap;
    }

    .calendar-legend {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 6px;
        font-size: 0.75rem;
        color: #666;
    }

    .legend-swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
    }

</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>