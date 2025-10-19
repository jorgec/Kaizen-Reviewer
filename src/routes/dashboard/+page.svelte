<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let user: any;
	let activeAssessments: any[] = [];
	let completedAssessments: any[] = [];
	let loading = true;
	let error = '';

	const unsubscribe = userStore.subscribe((v) => (user = v));

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

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

	async function startPrompt() {
		try {
			const { data, error } = await supabase.rpc('rpc_generate_prompt_assessment', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id,
				p_title: 'Daily Recall Prompt'
			});
			if (error) throw error;
			goto(`/prompt/${data}`);
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
			goto(`/assessment/${data}`);
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
			goto(`/assessment/${data}`);
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
			goto(`/assessment/${data}`);
		} catch (err: any) {
			alert(err.message);
		}
	}
</script>

<section class="section">
	<div class="container">
		<h2 class="title is-4 mb-4">Kaizen Dashboard</h2>

		<!-- Assessment Actions -->
		<div class="buttons are-medium is-flex is-flex-wrap-wrap mb-5">
			<button class="button is-primary" on:click={startPrompt}>📋 Daily Prompt</button>
			<button class="button is-primary" on:click={startShortQuiz}>🧠 Short Quiz</button>
			<button class="button is-primary" on:click={startAdaptiveQuiz}>📊 Adaptive Quiz</button>
			<button class="button is-primary" on:click={startMockExam}>🏁 Mock Exam</button>
			<a class="button is-link" href="/analytics/aptitude">📈 View Analytics</a>
		</div>

		{#if loading}
			<p>Loading your assessments...</p>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else}
			<!-- Active Assessments -->
			<h3 class="title is-5 mt-5">Active Assessments</h3>
			{#if activeAssessments.length === 0}
				<p>No active assessments.</p>
			{:else}
				<div class="columns is-multiline">
					{#each activeAssessments as a}
						<div
							class="column is-12-mobile is-6-tablet is-4-desktop"
						>
							<a href={`/assessment/${a.instance_id}`} class="card assessment-card">
								<div class="card-content">
									<p class="title is-6 mb-1">{a.title}</p>
									<p class="subtitle is-7 mb-2">{a.description}</p>
									<progress class="progress is-info is-small" value={a.progress} max="100">
										{a.progress}%
									</progress>
									<p class="is-size-7 has-text-grey">Status: {a.status}</p>
								</div>
							</a>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Completed Assessments -->
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
									<p class="subtitle is-7 mb-2">{c.description}</p>
									<p class="is-size-7 mt-3">Score: {c.score}% ({c.raw_score}/{c.total_items})</p>
								</div>
							</a>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</section>

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