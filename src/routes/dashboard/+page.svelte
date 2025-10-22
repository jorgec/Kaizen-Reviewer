<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatHuman } from '$lib/datetime';
	import { browser } from '$app/environment';

	// NEW: components
	import Calendar from './components/calendar/Calendar.svelte';
	import { buildCalendarGridFixed, buildMonthLabels } from './components/calendar/utils';
	import type { CalendarDay } from './components/calendar/types';

	import AssessmentsList from './components/assessments/AssessmentsList.svelte';
	import type { AssessmentCard, AssessmentType } from './components/assessments/types';

	// --- state previously in the page (kept to mirror behavior) ---
	let user: any;
	let activeAssessments: AssessmentCard[] = [];
	let completedAssessments: AssessmentCard[] = [];
	let banks: any[] = [];

	// calendar state
	let calendarData: any[] = [];
	let calendarWeeks: CalendarDay[][] = [];
	let calendarLoading = true;
	let calendarError = '';
	let monthLabels: string[] = [];

	// sorting
	let activeSortBy: 'date' | 'title' | 'type' | 'score' = 'date';
	let activeSortDir: 'asc' | 'desc' = 'desc';
	let completedSortBy: 'date' | 'title' | 'type' | 'score' = 'date';
	let completedSortDir: 'asc' | 'desc' = 'desc';

	// filters
	const typeLabels: Record<AssessmentType, string> = {
		prompt: 'Single Question Prompt',
		short_quiz: 'Short Quiz',
		long_quiz: 'Adaptive Quiz',
		mock_exam: 'Mock Exam'
	};
	let activeTypeFilters: Set<AssessmentType> = new Set(['prompt','short_quiz','long_quiz','mock_exam']);
	let completedTypeFilters: Set<AssessmentType> = new Set(['prompt','short_quiz','long_quiz','mock_exam']);

	// pagination
	let activeShowCount = 9;
	let completedShowCount = 9;

	// global loading/error (assessments area)
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

	// dropdown menu
	let showAnalyticsMenu = false;
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.dropdown')) {
			showAnalyticsMenu = false;
		}
	}

	// ---- callbacks passed to components (mirror your previous logic) ----
	function toggleTypeFilter(type: AssessmentType, section: 'active' | 'completed') {
		if (section === 'active') {
			if (activeTypeFilters.has(type)) activeTypeFilters.delete(type);
			else activeTypeFilters.add(type);
			activeTypeFilters = new Set(activeTypeFilters);
		} else {
			if (completedTypeFilters.has(type)) completedTypeFilters.delete(type);
			else completedTypeFilters.add(type);
			completedTypeFilters = new Set(completedTypeFilters);
		}
	}

	function toggleSort(section: 'active' | 'completed') {
		if (section === 'active') {
			activeSortDir = activeSortDir === 'asc' ? 'desc' : 'asc';
		} else {
			completedSortDir = completedSortDir === 'asc' ? 'desc' : 'asc';
		}
	}

	function showMoreActive() { activeShowCount += 9; }
	function showMoreCompleted() { completedShowCount += 9; }

	// ---------- Standard Actions (unchanged) ----------
	async function startPrompt() {
		try {
			const { data, error } = await supabase.rpc('rpc_generate_prompt_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_title: 'Daily Recall Prompt'
			});
			if (error) throw error;
			const instanceId = (data as any)?.instance_id || data;
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
			const instanceId = (data as any)?.instance_id || data;
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
			const instanceId = (data as any)?.instance_id || data;
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
			const instanceId = (data as any)?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function retakeMockExam(instanceId: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		try {
			const { data, error } = await supabase.rpc('rpc_duplicate_assessment_instance', {
				p_instance_id: instanceId
			});
			if (error) throw error;
			const newInstanceId = (data as any)?.instance_id || data;
			goto(`/assessment/${newInstanceId}`);
		} catch (err: any) {
			alert('Error retaking assessment: ' + err.message);
		}
	}

	// ---------- Custom Assessment Creation (unchanged) ----------
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
						p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id,
						p_title: form.title, p_prompt: form.prompt_text || '', p_total_items: 1
					};
					break;
				case 'short':
					rpcName = 'rpc_generate_standard_assessment_from_bank';
					params = { p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id, p_title: form.title, p_total_items: form.total_items };
					break;
				case 'adaptive':
					rpcName = 'rpc_generate_adaptive_assessment_from_bank';
					params = { p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id, p_title: form.title, p_start_items: form.start_items };
					break;
				case 'mock':
					rpcName = 'rpc_generate_mock_exam_from_bank';
					params = {
						p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id, p_title: form.title,
						p_easy_count: form.easy, p_medium_count: form.medium, p_hard_count: form.hard
					};
					break;
			}

			const { data, error } = await supabase.rpc(rpcName, params);
			if (error) throw error;

			const instanceId = (data as any)?.instance_id || data;
			if (!instanceId) throw new Error('No instance_id returned.');

			showCustomModal = false;
			goto(form.type === 'prompt' ? `/prompt/${instanceId}` : `/assessment/${instanceId}`);
		} catch (err: any) {
			alert('Error creating assessment: ' + err.message);
		} finally {
			creating = false;
		}
	}

	// ---------- Data fetch (unchanged endpoints/handling) ----------
	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

		// calendar
		try {
			const { data: rawCalendarData, error: calErr } = await supabase.rpc('rpc_get_user_calendar_grid', {
				p_user_id: user.user_id
			});
			if (calErr) throw calErr;

			calendarData = rawCalendarData || [];
			calendarWeeks = buildCalendarGridFixed(calendarData);
			monthLabels = buildMonthLabels(calendarWeeks);
		} catch (err: any) {
			calendarError = err.message;
		} finally {
			calendarLoading = false;
		}

		// dropdown outside click – browser only
		if (browser) {
			document.addEventListener('click', handleClickOutside);
		}

		// assessments + banks
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
</script>

<section class="section">
	<div class="container py-0">
		<!-- Assessment tiles (unchanged) -->
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

		<!-- Sub-buttons and analytics dropdown (unchanged) -->
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

		<!-- Calendar block now uses component -->
		{#if user?.user_id}
			<div class="calendar-container mt-6 mb-6">
				<h3 class="title is-5 mb-3">Activity Calendar</h3>
				<Calendar
					loading={calendarLoading}
					error={calendarError}
					weeks={calendarWeeks}
					monthLabels={monthLabels}
				/>
			</div>
		{/if}

		<!-- Assessments list now uses component; all state+callbacks come from this page -->
		<AssessmentsList
			loading={loading}
			error={error}
			{activeAssessments}
			{completedAssessments}
			{activeSortBy}
			{activeSortDir}
			{completedSortBy}
			{completedSortDir}
			{activeTypeFilters}
			{completedTypeFilters}
			typeLabels={typeLabels}
			{activeShowCount}
			{completedShowCount}
			onToggleSort={toggleSort}
			onToggleTypeFilter={toggleTypeFilter}
			onShowMoreActive={showMoreActive}
			onShowMoreCompleted={showMoreCompleted}
			onRetakeMockExam={retakeMockExam}
		/>
	</div>
</section>

<!-- ---------- Modal (unchanged) ---------- -->
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
    /* keep your existing styles verbatim (trimmed where now handled by components) */

    .assessment-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem; margin-bottom: 1.5rem;
    }
    .assessment-tile { background:#fff; border-radius:14px; padding:1.75rem 1.25rem; text-align:center; box-shadow:0 3px 8px rgba(0,0,0,0.08); cursor:pointer; transition:all 0.25s ease; }
    .assessment-tile:hover { transform: translateY(-4px); box-shadow:0 6px 16px rgba(0,0,0,0.12); }
    .assessment-tile .icon { font-size:2rem; margin-bottom:0.5rem; }
    .assessment-tile h3 { font-size:1.25rem; font-weight:600; margin-bottom:0.25rem; color:var(--color-text-primary); }
    .assessment-tile p { font-size:0.95rem; color:#666; line-height:1.4; }
    .assessment-tile.prompt { background:linear-gradient(135deg, #fef6e4, #fff); border-top:4px solid #f4a261; }
    .assessment-tile.short { background:linear-gradient(135deg, #f1f7ff, #fff); border-top:4px solid #9ad4d6; }
    .assessment-tile.adaptive { background:linear-gradient(135deg, #f4f9f9, #fff); border-top:4px solid #2a9d8f; }
    .assessment-tile.mock { background:linear-gradient(135deg, #f9f7ff, #fff); border-top:4px solid #264653; }

    .sub-buttons { display:flex; flex-wrap:wrap; gap:1rem; }
    .sub-buttons .button { font-size:0.95rem; padding:0.6rem 1.2rem; }

    .dropdown { position:relative; }
    .dropdown-menu { display:none; position:absolute; z-index:20; }
    .dropdown.is-active .dropdown-menu { display:block; }
    .dropdown-content { min-width:220px; background-color:#fff; box-shadow:0 2px 10px rgba(0,0,0,0.5); }
    .dropdown-item { background-color:#fff; }

    .calendar-container { width:100%; overflow-x:auto; padding-bottom:0.5rem; font-size:0.8rem; }
</style>

<script context="module" lang="ts">
	// Keep CSR if you already had it; if you want SSR, remove this.
	export const ssr = false;
</script>