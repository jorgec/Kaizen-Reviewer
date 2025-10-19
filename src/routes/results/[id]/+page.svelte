<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	export let params; // { id: <assessment_instance_uuid> }

	let user: any;
	let results: any[] = [];
	let loading = true;
	let error = '';
	let summary = { correct: 0, total: 0, score: 0 };

	userStore.subscribe((v) => (user = v));

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_fetch_assessment_results_detail', {
				p_instance_id: params.id
			});
			if (rpcError) throw rpcError;

			results = data || [];
			if (results.length > 0) {
				const total = results.length;
				const correct = results.filter((r) => r.is_user_correct).length;
				summary = {
					correct,
					total,
					score: ((correct / total) * 100).toFixed(1)
				};
			}
		} catch (err: any) {
			error = err.message || 'Failed to load assessment results.';
		} finally {
			loading = false;
		}
	});
</script>

<section class="section">
	<div class="container">
		<h2 class="title is-4 mb-3">Assessment Results</h2>

		{#if loading}
			<p>Loading results...</p>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else if results.length === 0}
			<p>No results found for this assessment.</p>
		{:else}
			<!-- Summary -->
			<div class="card summary-card mb-5">
				<div class="card-content has-text-centered">
					<h3 class="title is-5 mb-1">Overall Score</h3>
					<p class="subtitle is-4 mt-2">{summary.score}%</p>
					<p>
						<strong>{summary.correct}</strong> correct out of <strong>{summary.total}</strong> items
					</p>
					<a href="/dashboard" class="button is-primary mt-4">Return to Dashboard</a>
				</div>
			</div>

			<!-- Detailed Breakdown -->
			<table class="table is-fullwidth is-hoverable results-table">
				<thead>
				<tr>
					<th style="max-width: 20px; width: 20px !important; overflow: hidden;">#</th>
					<th>Question</th>
					<th>Your Answer</th>
					<th>Correct Answer</th>
					<th>Explanation</th>
					<th>Topic</th>
					<th>Difficulty</th>
				</tr>
				</thead>
				<tbody>
				{#each results as r, i}

					<tr class={r.is_user_correct ? 'correct' : 'incorrect'}>
						<td style="max-width: 20px; width: 20px !important; overflow: hidden;">{i + 1}</td>
						<td>{r.stem}</td>
						<td>
								<span class="user-answer">
									<strong>{r.user_choice || '—'}</strong>
								</span>
						</td>
						<td>
							<strong>{r.correct_label}</strong> — {r.correct_text}
						</td>
						<td>{r.explanation}</td>
						<td>{r.topic || '—'}</td>
						<td>{r.difficulty || '—'}</td>
					</tr>
				{/each}
				</tbody>
			</table>
		{/if}
	</div>
</section>

<style>


    @media (max-width: 768px) {
        table {
            font-size: 0.9rem;
        }
        td, th {
            padding: 0.5rem;
        }
        h2.title {
            font-size: 1.3rem;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>