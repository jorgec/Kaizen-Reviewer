<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatHuman, formatUTC, formatPattern } from '$lib/datetime';

	let user: any;
	let activeAssessments: any[] = [];
	let completedAssessments: any[] = [];
	let banks: any[] = [];

	// Sorting state variables
	let activeSortBy: 'date' | 'title' | 'type' | 'score' = 'date';
	let activeSortDir: 'asc' | 'desc' = 'desc';
	let completedSortBy: 'date' | 'title' | 'type' | 'score' = 'date';
	let completedSortDir: 'asc' | 'desc' = 'desc';
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

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

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
			alert('Assessment created successfully!');

			goto(form.type === 'prompt' ? `/prompt/${instanceId}` : `/assessment/${instanceId}`);
		} catch (err: any) {
			alert('Error creating assessment: ' + err.message);
		} finally {
			creating = false;
		}
	}
</script>

<section class="section">
	<div class="container">
		<h2 class="title is-4 mb-4">Kaizen Dashboard</h2>

		<div class="buttons are-medium is-flex is-flex-wrap-wrap mb-5">
			<button class="button is-primary" on:click={startPrompt}>📋 Daily Prompt</button>
			<button class="button is-primary" on:click={startShortQuiz}>🧠 Short Quiz</button>
			<button class="button is-primary" on:click={startAdaptiveQuiz}>📊 Adaptive Quiz</button>
			<button class="button is-primary" on:click={startMockExam}>🏁 Mock Exam</button>

			<button class="button is-info" on:click={() => (showCustomModal = true)}>⚙️ Custom Assessment</button>

			<a class="button is-link" href="/analytics/aptitude">📈 View Analytics</a>
		</div>

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
					<button class="button is-small" type="button" aria-label="Toggle sort direction" on:click={() => toggleSort('active')}>
						{#if activeSortDir === 'asc'}
							<span>▲</span>
						{:else}
							<span>▼</span>
						{/if}
					</button>
				</div>
			</div>
			{#if activeAssessments.length === 0}
				<p>No active assessments.</p>
			{:else}
				<!-- Responsive grid for active assessments -->
				<div class="dashboard-grid">
					{#each sortAssessments(activeAssessments, activeSortBy, activeSortDir).slice(0, activeShowCount) as a (a.instance_id)}
						<a href={`/assessment/${a.instance_id}`} class="card assessment-card dashboard-card">
							<div class="card-content">
								<p class="title is-6 mb-2">{a.title}</p>
								<p class="subtitle is-7 mb-2">{a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : ''} Assessment</p>
								{#if a.description}
									<p class="is-size-7 mb-2 has-text-grey">{a.description}</p>
								{/if}
								<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
									<span class="is-size-7 has-text-grey">Status: {a.status}</span>
									<span class="is-size-7">{a.total_items ? `${a.progress}% (${a.answered_items || 0}/${a.total_items})` : ''}</span>
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
				{#if activeShowCount < activeAssessments.length}
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
					<button class="button is-small" type="button" aria-label="Toggle sort direction" on:click={() => toggleSort('completed')}>
						{#if completedSortDir === 'asc'}
							<span>▲</span>
						{:else}
							<span>▼</span>
						{/if}
					</button>
				</div>
			</div>
			{#if completedAssessments.length === 0}
				<p>No completed assessments yet.</p>
			{:else}
				<!-- Responsive grid for completed assessments -->
				<div class="dashboard-grid">
					{#each sortAssessments(completedAssessments, completedSortBy, completedSortDir).slice(0, completedShowCount) as c (c.instance_id)}
						<a href={`/results/${c.instance_id}`} class="card assessment-card dashboard-card"
							style="border-left: 4px solid {getMasteryColor(c.score)};"
						>
							<div class="card-content">
								<p class="title is-6 mb-2">{c.title}</p>
								<p class="subtitle is-7 mb-2">{c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : ''} Assessment</p>
								{#if c.description}
									<p class="is-size-7 mb-2 has-text-grey">{c.description}</p>
								{/if}
								<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
									<span class="is-size-7">Score: {c.score}%</span>
									<span class="is-size-7">{c.raw_score !== undefined && c.total_items ? `(${c.raw_score}/${c.total_items})` : ''}</span>
								</div>
								{#if c.completed_at}
									<p class="is-size-7 mt-2">Completed: {formatHuman(c.completed_at, { timeZone: 'Asia/Manila' })}</p>
								{/if}
								{#if c.duration_seconds}
									<p class="is-size-7">Duration: {Math.round(c.duration_seconds / 60)} min</p>
								{/if}
							</div>
						</a>
					{/each}
				</div>
				{#if completedShowCount < completedAssessments.length}
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
		height: 1px; width: 1px;
		overflow: hidden;
		clip: rect(1px, 1px, 1px, 1px);
		white-space: nowrap;
	}
    .assessment-card {
        display: block;
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .assessment-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
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

</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>
