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
	import CalendarChart from './components/calendar_chart/CalendarChart.svelte';

	// --- state previously in the page (kept to mirror behavior) ---
	let user: any;
	let activeAssessments: AssessmentCard[] = [];
	let completedAssessments: AssessmentCard[] = [];
	let banks: any[] = [];
	let currentDiscipline: any = null;
	let currentOrg: any = null;

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
	$: currentDiscipline = user?.currentDiscipline ?? null;
	$: currentOrg = user?.currentOrg ?? null;

	// dropdown menu
	let showAnalyticsMenu = false;
	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.modern-dropdown')) {
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
		const discipline_name = " for " + user.currentDiscipline.discipline_name;
		try {
			const { data, error } = await supabase.rpc('rpc_generate_prompt_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_title: 'Daily Recall Prompt' + discipline_name,
				p_discipline_id: user.currentDiscipline.discipline_id,
			});
			if (error) throw error;
			const instanceId = (data as any)?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function startShortQuiz() {
		const discipline_name = " for " + user.currentDiscipline.discipline_name;
		try {
			const { data, error } = await supabase.rpc('rpc_generate_standard_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_total: 10,
				p_title: 'Short Quiz' + discipline_name,
				p_discipline_id: user.currentDiscipline.discipline_id,
			});
			if (error) throw error;
			const instanceId = (data as any)?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function startAdaptiveQuiz() {
		const discipline_name = " for " + user.currentDiscipline.discipline_name;
		try {
			const { data, error } = await supabase.rpc('rpc_generate_adaptive_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_total: 15,
				p_title: 'Adaptive Diagnostic Quiz' + discipline_name,
				p_discipline_id: user.currentDiscipline.discipline_id,
			});
			if (error) throw error;
			const instanceId = (data as any)?.instance_id || data;
			goto(`/assessment/${instanceId}`);
		} catch (err: any) {
			alert(err.message);
		}
	}

	async function startMockExam() {
		const discipline_name = " for " + user.currentDiscipline.discipline_name;
		try {
			const { data, error } = await supabase.rpc('rpc_generate_mock_exam', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_title: 'Mock Exam' + discipline_name,
				p_discipline_id: user.currentDiscipline.discipline_id,
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
						p_title: form.title, p_prompt: form.prompt_text || '', p_discipline_id: currentDiscipline.discipline_id
					};
					break;
				case 'short':
					rpcName = 'rpc_generate_standard_assessment_from_bank';
					params = { p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id, p_title: form.title, p_total_items: form.total_items, p_discipline_id: currentDiscipline.discipline_id };
					break;
				case 'adaptive':
					rpcName = 'rpc_generate_adaptive_assessment_from_bank';
					params = { p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id, p_title: form.title, p_start_items: form.start_items, p_discipline_id: currentDiscipline.discipline_id };
					break;
				case 'mock':
					rpcName = 'rpc_generate_mock_exam_from_bank';
					params = {
						p_org_id: org_id, p_user_id: uid, p_bank_id: form.bank_id, p_title: form.title,
						p_easy_count: form.easy, p_medium_count: form.medium, p_hard_count: form.hard, p_discipline_id: currentDiscipline.discipline_id
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


	// Refactored: calendar load logic
	async function loadCalendar() {
		if (!user?.user_id || !currentDiscipline?.discipline_id) return;
		calendarLoading = true;
		calendarError = '';
		try {
			const { data: rawCalendarData, error: calErr } = await supabase.rpc('rpc_get_user_calendar_grid', {
				p_user_id: user.user_id,
				p_discipline_id: currentDiscipline?.discipline_id,
				p_weeks: 52
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
	}

	// Load banks based on discipline and org
	async function loadBanks() {
		if (!user?.user_id || !currentDiscipline?.discipline_id || !currentOrg?.org_id) return;
		try {
			const { data, error: bankErr } = await supabase.rpc('rpc_get_user_banks_by_discipline', {
				p_user_id: user.user_id,
				p_discipline_id: currentDiscipline.discipline_id,
				p_org_id: currentOrg.org_id
			});
			if (bankErr) throw bankErr;
			banks = data || [];
		} catch (err: any) {
			console.error('Error loading banks:', err);
		}
	}

	// Reload calendar when discipline changes
	$: if (currentDiscipline && user?.user_id) {
		loadCalendar();
	}

	// Reload banks when discipline or org changes
	$: if (currentDiscipline && currentOrg && user?.user_id) {
		loadBanks();
	}

	// ---------- Data fetch (unchanged endpoints/handling) ----------
	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

		// dropdown outside click – browser only
		if (browser) {
			document.addEventListener('click', handleClickOutside);
		}

		// assessments (banks and calendar now handled by reactive statements)
		try {
			const [activeRes, completedRes] = await Promise.all([
				supabase.rpc('rpc_fetch_active_assessments', { p_user_id: user.user_id }),
				supabase.rpc('rpc_fetch_completed_assessments', { p_user_id: user.user_id })
			]);

			if (activeRes.error) throw activeRes.error;
			if (completedRes.error) throw completedRes.error;

			activeAssessments = activeRes.data || [];
			completedAssessments = completedRes.data || [];
		} catch (err: any) {
			console.error(err);
			error = err.message || 'Failed to load dashboard data.';
		} finally {
			loading = false;
		}
	});
</script>
<svelte:head>
	<title>Kaizen :: Transform your learning journey with the philosophy of continuous improvement</title>
	<meta name="description" content="Transform your learning journey with the philosophy of continuous improvement" />
</svelte:head>

<section class="section">
	<div class="container py-0">
		<!-- Modern Assessment Tiles -->
		<div class="assessment-grid mb-5">
			<button type="button" class="assessment-tile prompt" on:click={startPrompt}>
				<div class="tile-icon-wrapper prompt-icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
						<line x1="9" y1="13" x2="15" y2="13"></line>
						<line x1="9" y1="17" x2="15" y2="17"></line>
					</svg>
				</div>
				<div class="tile-content">
					<h3 class="tile-title">Daily Prompt</h3>
					<p class="tile-description">Quick single-question recall exercise</p>
				</div>
				<div class="tile-arrow">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="5" y1="12" x2="19" y2="12"></line>
						<polyline points="12 5 19 12 12 19"></polyline>
					</svg>
				</div>
			</button>

			<button type="button" class="assessment-tile short" on:click={startShortQuiz}>
				<div class="tile-icon-wrapper short-icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
						<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
					</svg>
				</div>
				<div class="tile-content">
					<h3 class="tile-title">Short Quiz</h3>
					<p class="tile-description">10 randomized questions for quick practice</p>
				</div>
				<div class="tile-arrow">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="5" y1="12" x2="19" y2="12"></line>
						<polyline points="12 5 19 12 12 19"></polyline>
					</svg>
				</div>
			</button>

			<button type="button" class="assessment-tile adaptive" on:click={startAdaptiveQuiz}>
				<div class="tile-icon-wrapper adaptive-icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
					</svg>
				</div>
				<div class="tile-content">
					<h3 class="tile-title">Adaptive Quiz</h3>
					<p class="tile-description">Progressive difficulty based on performance</p>
				</div>
				<div class="tile-arrow">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="5" y1="12" x2="19" y2="12"></line>
						<polyline points="12 5 19 12 12 19"></polyline>
					</svg>
				</div>
			</button>

			<button type="button" class="assessment-tile mock" on:click={startMockExam}>
				<div class="tile-icon-wrapper mock-icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
				</div>
				<div class="tile-content">
					<h3 class="tile-title">Mock Exam</h3>
					<p class="tile-description">Full-length simulation of real exams</p>
				</div>
				<div class="tile-arrow">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="5" y1="12" x2="19" y2="12"></line>
						<polyline points="12 5 19 12 12 19"></polyline>
					</svg>
				</div>
			</button>
		</div>

		<!-- Sub-buttons with modern SaaS styling -->
		<div class="sub-buttons">
			<button class="modern-button custom-button" on:click={() => (showCustomModal = true)}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="3"></circle>
					<path d="M12 1v6m0 6v6m5.656-13.656l-4.243 4.243m-2.828 2.828l-4.243 4.243m13.657-1.414l-6-6m-6 6l-6-6"></path>
				</svg>
				<span>Custom Assessment</span>
			</button>
			<div class="modern-dropdown {showAnalyticsMenu ? 'is-active' : ''}">
				<button
					class="modern-button analytics-button"
					aria-haspopup="true"
					aria-controls="analytics-menu"
					on:click={() => (showAnalyticsMenu = !showAnalyticsMenu)}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="20" x2="12" y2="10"></line>
						<line x1="18" y1="20" x2="18" y2="4"></line>
						<line x1="6" y1="20" x2="6" y2="16"></line>
					</svg>
					<span>View Analytics</span>
					<svg
						class="chevron"
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>
				<div class="modern-dropdown-menu" id="analytics-menu" role="menu">
					<a href="/analytics/subtopic_summary" class="modern-dropdown-item">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="3" width="7" height="7"></rect>
							<rect x="14" y="3" width="7" height="7"></rect>
							<rect x="14" y="14" width="7" height="7"></rect>
							<rect x="3" y="14" width="7" height="7"></rect>
						</svg>
						<span>Subtopic Summary</span>
					</a>
					<a href="/analytics/mock_exam_metrics" class="modern-dropdown-item">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
							<polyline points="17 6 23 6 23 12"></polyline>
						</svg>
						<span>Mock Exam Trends</span>
					</a>
				</div>
			</div>
		</div>

		<!-- Calendar block now uses component -->
		{#if user?.user_id}
			<div class="calendar-container mt-2 mb-2">
				<h3 class="title is-5 mb-3">Activity Calendar</h3>
				<Calendar
					loading={calendarLoading}
					error={calendarError}
					weeks={calendarWeeks}
					monthLabels={monthLabels}
				/>
			</div>
		{/if}

		<!-- ...somewhere in your dashboard layout -->
		<div class="metric-card">
			<div class="metric-header">
			</div>
			<CalendarChart data={calendarData} />
		</div>

		<!-- Assessments list now uses component; all state+callbacks come from this page -->
		<AssessmentsList
			{currentDiscipline}
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

<!-- Modern Custom Assessment Modal -->
{#if showCustomModal}
	<div class="modern-modal-overlay" on:click={() => (showCustomModal = false)}>
		<div class="modern-modal-card" on:click={(e) => e.stopPropagation()}>
			<header class="modern-modal-header">
				<div class="modal-title-section">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="modal-title-icon"
					>
						<circle cx="12" cy="12" r="3"></circle>
						<path d="M12 1v6m0 6v6m5.656-13.656l-4.243 4.243m-2.828 2.828l-4.243 4.243m13.657-1.414l-6-6m-6 6l-6-6"></path>
					</svg>
					<h2 class="modal-title">Create Custom Assessment</h2>
				</div>
				<button class="modern-close-button" aria-label="close" on:click={() => (showCustomModal = false)}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</header>

			<section class="modern-modal-body">
				<div class="modern-form-group">
					<label class="modern-label">Assessment Type</label>
					<div class="modern-select-wrapper">
						<select class="modern-select" bind:value={form.type}>
							<option value="prompt">Prompt</option>
							<option value="short">Short Quiz</option>
							<option value="adaptive">Adaptive</option>
							<option value="mock">Mock Exam</option>
						</select>
					</div>
				</div>

				<div class="modern-form-group">
					<label class="modern-label">Question Bank</label>
					<div class="modern-select-wrapper">
						<select class="modern-select" bind:value={form.bank_id}>
							<option value="">Select a question bank</option>
							{#each banks as b}
								<option value={b.bank_id}>{b.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="modern-form-group">
					<label class="modern-label">Assessment Title</label>
					<input
						class="modern-input"
						type="text"
						bind:value={form.title}
						placeholder="Enter a descriptive title..."
					/>
				</div>

				{#if form.type === 'short'}
					<div class="modern-form-group">
						<label class="modern-label">Total Questions</label>
						<input
							class="modern-input"
							type="number"
							min="1"
							bind:value={form.total_items}
							placeholder="10"
						/>
					</div>
				{:else if form.type === 'mock'}
					<div class="modern-form-group">
						<label class="modern-label">Difficulty Distribution</label>
						<div class="difficulty-grid">
							<div class="difficulty-input-group">
								<label class="difficulty-label easy">Easy</label>
								<input
									class="modern-input small"
									type="number"
									min="0"
									bind:value={form.easy}
									placeholder="0"
								/>
							</div>
							<div class="difficulty-input-group">
								<label class="difficulty-label medium">Medium</label>
								<input
									class="modern-input small"
									type="number"
									min="0"
									bind:value={form.medium}
									placeholder="0"
								/>
							</div>
							<div class="difficulty-input-group">
								<label class="difficulty-label hard">Hard</label>
								<input
									class="modern-input small"
									type="number"
									min="0"
									bind:value={form.hard}
									placeholder="0"
								/>
							</div>
						</div>
					</div>
				{:else if form.type === 'adaptive'}
					<div class="modern-form-group">
						<label class="modern-label">Starting Questions</label>
						<input
							class="modern-input"
							type="number"
							min="1"
							bind:value={form.start_items}
							placeholder="10"
						/>
					</div>
				{/if}
			</section>

			<footer class="modern-modal-footer">
				<button class="modal-cancel-button" on:click={() => (showCustomModal = false)}>
					Cancel
				</button>
				<button
					class="modal-create-button"
					on:click={createCustomAssessment}
					disabled={creating}
				>
					{#if creating}
						<span class="spinner-small"></span>
						<span>Creating...</span>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
						<span>Create Assessment</span>
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
    /* keep your existing styles verbatim (trimmed where now handled by components) */

    /* Modern Assessment Tiles */
    .assessment-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .assessment-tile {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        background: white;
        border: 2px solid transparent;
        border-radius: 16px;
        padding: 2rem;
        text-align: left;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        overflow: hidden;
    }

    .assessment-tile::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, var(--tile-color-1), var(--tile-color-2));
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.3s ease;
    }

    .assessment-tile:hover::before {
        transform: scaleX(1);
    }

    .assessment-tile:hover {
        transform: translateY(-6px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
        border-color: var(--tile-border-color);
    }

    .tile-icon-wrapper {
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        margin-bottom: 1.25rem;
        transition: all 0.3s ease;
    }

    .assessment-tile:hover .tile-icon-wrapper {
        transform: scale(1.05);
    }

    .tile-icon-wrapper svg {
        transition: transform 0.3s ease;
    }

    .assessment-tile:hover .tile-icon-wrapper svg {
        transform: scale(1.1);
    }

    .tile-content {
        flex: 1;
        margin-bottom: 1rem;
    }

    .tile-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 0.5rem 0;
    }

    .tile-description {
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        color: #6b7280;
        line-height: 1.5;
        margin: 0;
    }

    .tile-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--tile-color-1);
        transition: transform 0.3s ease;
    }

    .assessment-tile:hover .tile-arrow {
        transform: translateX(4px);
    }

    /* Prompt Tile - Amber/Orange */
    .assessment-tile.prompt {
        --tile-color-1: #f59e0b;
        --tile-color-2: #ef4444;
        --tile-border-color: rgba(245, 158, 11, 0.2);
    }

    .prompt-icon {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(239, 68, 68, 0.1));
        color: #f59e0b;
    }

    /* Short Quiz Tile - Blue/Cyan */
    .assessment-tile.short {
        --tile-color-1: #3b82f6;
        --tile-color-2: #06b6d4;
        --tile-border-color: rgba(59, 130, 246, 0.2);
    }

    .short-icon {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(6, 182, 212, 0.1));
        color: #3b82f6;
    }

    /* Adaptive Quiz Tile - Teal/Green */
    .assessment-tile.adaptive {
        --tile-color-1: #14b8a6;
        --tile-color-2: #10b981;
        --tile-border-color: rgba(20, 184, 166, 0.2);
    }

    .adaptive-icon {
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(16, 185, 129, 0.1));
        color: #14b8a6;
    }

    /* Mock Exam Tile - Purple/Indigo */
    .assessment-tile.mock {
        --tile-color-1: #8b5cf6;
        --tile-color-2: #6366f1;
        --tile-border-color: rgba(139, 92, 246, 0.2);
    }

    .mock-icon {
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
        color: #8b5cf6;
    }

    /* Responsive Tiles */
    @media (max-width: 768px) {
        .assessment-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
        }

        .assessment-tile {
            padding: 1.5rem;
        }

        .tile-icon-wrapper {
            width: 56px;
            height: 56px;
        }

        .tile-title {
            font-size: 1.1rem;
        }

        .tile-description {
            font-size: 0.85rem;
        }
    }

    /* Modern Sub-buttons */
    .sub-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.875rem;
        margin-bottom: 2rem;
    }

    .modern-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        position: relative;
        overflow: hidden;
    }

    .modern-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transition: left 0.5s ease;
    }

    .modern-button:hover::before {
        left: 100%;
    }

    .modern-button svg {
        transition: transform 0.2s ease;
    }

    .modern-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }

    .modern-button:active {
        transform: translateY(0);
    }

    /* Custom Assessment Button */
    .custom-button {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
    }

    .custom-button:hover {
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
    }

    .custom-button:hover svg {
        transform: rotate(90deg);
    }

    /* Analytics Button */
    .analytics-button {
        background: linear-gradient(135deg, #14b8a6, #06b6d4);
        color: white;
    }

    .analytics-button:hover {
        background: linear-gradient(135deg, #0d9488, #0891b2);
    }

    .analytics-button .chevron {
        margin-left: 0.25rem;
        transition: transform 0.2s ease;
    }

    .modern-dropdown.is-active .chevron {
        transform: rotate(180deg);
    }

    /* Modern Dropdown */
    .modern-dropdown {
        position: relative;
    }

    .modern-dropdown-menu {
        display: none;
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        min-width: 240px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(0, 0, 0, 0.06);
        overflow: hidden;
        z-index: 30;
        animation: dropdownFadeIn 0.2s ease;
    }

    @keyframes dropdownFadeIn {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .modern-dropdown.is-active .modern-dropdown-menu {
        display: block;
    }

    .modern-dropdown-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.875rem 1.25rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 500;
        color: #374151;
        text-decoration: none;
        transition: all 0.15s ease;
        border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    }

    .modern-dropdown-item:last-child {
        border-bottom: none;
    }

    .modern-dropdown-item:hover {
        background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
        color: #6366f1;
        padding-left: 1.5rem;
    }

    .modern-dropdown-item svg {
        flex-shrink: 0;
        color: currentColor;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .modern-button {
            font-size: 0.85rem;
            padding: 0.625rem 1.25rem;
        }

        .modern-dropdown-menu {
            left: auto;
            right: 0;
        }
    }

    .calendar-container { width:100%; overflow-x:auto; padding-bottom:0.5rem; font-size:0.8rem; }

    /* Modern Modal Styles */
    .modern-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
        animation: modalFadeIn 0.2s ease;
    }

    @keyframes modalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .modern-modal-card {
        background: white;
        border-radius: 16px;
        width: 100%;
        max-width: 560px;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: modalSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes modalSlideUp {
        from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .modern-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
    }

    .modal-title-section {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .modal-title-icon {
        color: #6366f1;
        flex-shrink: 0;
    }

    .modal-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0;
    }

    .modern-close-button {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .modern-close-button:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #1f2937;
    }

    .modern-modal-body {
        padding: 2rem;
        max-height: calc(90vh - 180px);
        overflow-y: auto;
    }

    .modern-form-group {
        margin-bottom: 1.5rem;
    }

    .modern-form-group:last-child {
        margin-bottom: 0;
    }

    .modern-label {
        display: block;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin-bottom: 0.5rem;
    }

    .modern-select-wrapper {
        position: relative;
    }

    .modern-select {
        width: 100%;
        padding: 0.75rem 2.5rem 0.75rem 1rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        background: white;
        color: #1f2937;
        cursor: pointer;
        transition: all 0.2s ease;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 1rem center;
    }

    .modern-select:hover {
        border-color: #d1d5db;
    }

    .modern-select:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .modern-input {
        width: 100%;
        padding: 0.75rem 1rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        background: white;
        color: #1f2937;
        transition: all 0.2s ease;
    }

    .modern-input::placeholder {
        color: #9ca3af;
    }

    .modern-input:hover {
        border-color: #d1d5db;
    }

    .modern-input:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .modern-input.small {
        padding: 0.625rem 0.875rem;
        font-size: 0.875rem;
    }

    /* Difficulty Grid */
    .difficulty-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }

    .difficulty-input-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .difficulty-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        text-align: center;
    }

    .difficulty-label.easy {
        background: rgba(34, 197, 94, 0.1);
        color: #16a34a;
    }

    .difficulty-label.medium {
        background: rgba(251, 191, 36, 0.1);
        color: #d97706;
    }

    .difficulty-label.hard {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
    }

    /* Modal Footer */
    .modern-modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1.25rem 2rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        background: #f9fafb;
    }

    .modal-cancel-button {
        padding: 0.75rem 1.5rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        color: #6b7280;
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .modal-cancel-button:hover {
        background: #f9fafb;
        border-color: #d1d5db;
        color: #374151;
    }

    .modal-create-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        color: white;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .modal-create-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
    }

    .modal-create-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .spinner-small {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Responsive Modal */
    @media (max-width: 768px) {
        .modern-modal-card {
            max-width: 100%;
            border-radius: 16px 16px 0 0;
            margin-top: auto;
        }

        .modern-modal-header {
            padding: 1.25rem 1.5rem;
        }

        .modal-title {
            font-size: 1.1rem;
        }

        .modern-modal-body {
            padding: 1.5rem;
        }

        .modern-modal-footer {
            padding: 1rem 1.5rem;
        }

        .difficulty-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

<script context="module" lang="ts">
	// Keep CSR if you already had it; if you want SSR, remove this.
	export const ssr = false;
</script>