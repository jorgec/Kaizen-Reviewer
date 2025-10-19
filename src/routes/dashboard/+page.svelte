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
			<h3 class="title is-5 mt-5">Active Assessments</h3>
			{#if activeAssessments.length === 0}
				<p>No active assessments.</p>
			{:else}
				<div class="columns is-multiline">
					{#each activeAssessments as a}
						<div class="column is-12-mobile is-6-tablet is-4-desktop">
							<a href={`/assessment/${a.instance_id}`} class="card assessment-card">
								<div class="card-content">
									<p class="title is-6 mb-4">{a.title}</p>
									<p class="subtitle is-7 mb-2">{a.description}</p>
									<progress class="progress is-info is-small" value={a.progress} max="100">{a.progress}%</progress>
									<p class="is-size-7 has-text-grey">Status: {a.status}</p>
									<p class="is-size-7 mt-3">
										Assigned: {formatHuman(a.assigned_at, { timeZone: 'Asia/Manila' })}
									</p>
								</div>
							</a>
						</div>
					{/each}
				</div>
			{/if}

			<h3 class="title is-5 mt-6">Completed Assessments</h3>
			{#if completedAssessments.length === 0}
				<p>No completed assessments yet.</p>
			{:else}
				<div class="columns is-multiline">
					{#each completedAssessments as c}
						<div class="column is-12-mobile is-6-tablet is-4-desktop">
							<a href={`/results/${c.instance_id}`} class="card assessment-card">
								<div class="card-content">
									<p class="title is-6 mb-2">{c.title}</p>
									<p class="subtitle is-7 mb-4">{c.description}</p>
									<p class="is-size-7 mt-3">Score: {c.score}% ({c.raw_score}/{c.total_items})</p>
									<p class="is-size-7 mt-3">
										Completed: {formatHuman(c.completed_at, { timeZone: 'Asia/Manila' })}
									</p>
								</div>
							</a>
						</div>
					{/each}
				</div>
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
    .assessment-card {
        display: block;
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .assessment-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>
