<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';

	let user: any;
	let analytics: any[] = [];
	let loading = true;
	let error = '';

	let expanded: Record<string, boolean> = {};

	let showModal = false;
	let modalLoading = false;
	let modalData: any[] = [];
	let modalTitle = '';

	const unsubscribe = userStore.subscribe((v) => (user = v));

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_calculate_user_aptitude', {
				p_user_id: user.user_id
			});
			if (rpcError) throw rpcError;
			analytics = data || [];
		} catch (err: any) {
			error = err.message || 'Failed to load analytics.';
		} finally {
			loading = false;
		}
	});

	function masteryClass(level?: number) {
		if (level === null || level === undefined) return 'm-neutral';
		const pct = level * 100;
		if (pct < 25) return 'm-low';
		if (pct < 50) return 'm-fair';
		if (pct < 75) return 'm-good';
		if (pct < 90) return 'm-high';
		return 'm-excel';
	}

	function toggle(id: string) {
		expanded[id] = !expanded[id];
	}

	async function openDrilldown(level: string, ids: any, label: string) {
		if (!user?.user_id) return;
		showModal = true;
		modalLoading = true;
		modalTitle = label;
		modalData = [];

		const payload = {
			p_user_id: user.user_id,
			p_subject_id: null,
			p_topic_id: null,
			p_subtopic_id: null
		};

		if (level === 'subject') payload.p_subject_id = ids.subject_id;
		if (level === 'topic') payload.p_topic_id = ids.topic_id;
		if (level === 'subtopic') payload.p_subtopic_id = ids.subtopic_id;

		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_user_taxonomy_drilldown', payload);
			if (rpcError) throw rpcError;
			modalData = data || [];
		} catch (err: any) {
			modalData = [];
			modalTitle = 'Error loading details';
			console.error(err);
		} finally {
			modalLoading = false;
		}
	}

	function closeModal() {
		showModal = false;
		modalData = [];
		modalTitle = '';
	}
</script>

<section class="section">
	<div class="container">
		<h2 class="title is-4 mb-4">Aptitude Analytics</h2>

		{#if loading}
			<p>Loading analytics...</p>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else if analytics.length === 0}
			<p>No analytics data available.</p>
		{:else}
			<div class="table-container">
				<table class="table is-fullwidth is-hoverable aptitude-table">
					<thead>
					<tr>
						<th style="width: 35%">Category</th>
						<th class="has-text-centered">Attempts</th>
						<th class="has-text-centered">Correct</th>
						<th class="has-text-centered">Mastery (%)</th>
						<th class="has-text-centered">Stability (%)</th>
					</tr>
					</thead>
					<tbody>
					{#each analytics as d, di}
						<tr class={masteryClass(null)} on:click={() => toggle(`d-${di}`)} style="cursor:pointer;">
							<td><strong>{d.discipline || 'Uncategorized Discipline'}</strong></td>
							<td colspan="4" class="has-text-centered">Tap to expand</td>
						</tr>

						{#if expanded[`d-${di}`]}
							{#each d.subjects as s, si}
								<tr
									class={masteryClass(s.mastery)}
									on:click={() => toggle(`d-${di}-s-${si}`)}
									style="cursor:pointer;"
								>
									<td class="pl-5">📘 {s.subject}</td>
									<td class="has-text-centered">{s.attempts ?? '–'}</td>
									<td class="has-text-centered">{s.correct ?? '–'}</td>
									<td class="has-text-centered">{(s.mastery * 100).toFixed(1)}</td>
									<td class="has-text-centered">{(s.stability * 100).toFixed(1)}</td>
								</tr>

								{#if expanded[`d-${di}-s-${si}`]}
									{#each s.topics as t, ti}
										<tr
											class={masteryClass(t.mastery)}
											on:click={() => toggle(`d-${di}-s-${si}-t-${ti}`)}
											style="cursor:pointer;"
										>
											<td class="pl-8"><div class="pl-6">📗{t.topic}</div></td>
											<td class="has-text-centered">{t.attempts ?? '–'}</td>
											<td class="has-text-centered">{t.correct ?? '–'}</td>
											<td class="has-text-centered">{(t.mastery * 100).toFixed(1)}</td>
											<td class="has-text-centered">{(t.stability * 100).toFixed(1)}</td>
										</tr>

										{#if expanded[`d-${di}-s-${si}-t-${ti}`]}
											{#each t.subtopics as sub}
												<tr
													class={masteryClass(sub.mastery_pct ? sub.mastery_pct / 100 : 0)}
													on:click={() => openDrilldown('subtopic', sub, sub.subtopic)}
													style="cursor:pointer;"
												>
													<td class="pl-6"><div class="pl-6">📙 {sub.subtopic}</div></td>
													<td class="has-text-centered">{sub.attempts ?? '–'}</td>
													<td class="has-text-centered">{sub.correct ?? '–'}</td>
													<td class="has-text-centered">
														{sub.mastery_pct !== null ? sub.mastery_pct.toFixed(1) : '–'}
													</td>
													<td class="has-text-centered">{(sub.stability * 100).toFixed(1)}</td>
												</tr>
											{/each}
										{/if}
									{/each}
								{/if}
							{/each}
						{/if}
					{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="has-text-centered mt-5">
			<a href="/dashboard" class="button is-link">Back to Dashboard</a>
		</div>
	</div>
</section>

<!-- ================= Modal ================= -->
{#if showModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={closeModal}></div>
		<div class="modal-card large-modal">
			<header class="modal-card-head">
				<p class="modal-card-title">{modalTitle}</p>
				<button class="delete" aria-label="close" on:click={closeModal}></button>
			</header>

			<section class="modal-card-body scrollable-body">
				{#if modalLoading}
					<p>Loading details...</p>
				{:else if modalData.length === 0}
					<p>No questions found for this category.</p>
				{:else}
					<table class="table is-fullwidth is-hoverable">
						<thead>
						<tr>
							<th style="width: 45%">Question</th>
							<th>Difficulty</th>
							<th>Responses</th>
						</tr>
						</thead>
						<tbody>
						{#each modalData as q}
							<tr>
								<td>{q.stem}</td>
								<td>
										<span
											class="tag"
											class:easy={q.difficulty === 'easy'}
											class:medium={q.difficulty === 'medium'}
											class:hard={q.difficulty === 'hard'}
										>
											{q.difficulty}
										</span>
								</td>

								<td>
									{#if q.responses && q.responses.length > 0}
										<ul class="response-list">
											{#each q.responses as r}
												<li class={r.is_correct ? 'has-text-success' : 'has-text-danger'}>
													<strong>{r.choice_label}</strong> — {r.choice_text}
													<br />
													<small>{new Date(r.answered_at).toLocaleString()}</small>
													<span class="ml-2">{r.is_correct ? '✅' : '❌'}</span>
												</li>
											{/each}
										</ul>
									{:else}
										<em class="has-text-grey-light">No responses yet</em>
									{/if}
								</td>
							</tr>
						{/each}
						</tbody>
					</table>
				{/if}
			</section>
		</div>
	</div>
{/if}

<style>
    .pl-5 { padding-left: 2rem !important; }
    .pl-6 { padding-left: 2.5rem !important; }
    .pl-7 { padding-left: 3rem !important; }

    .modal-card.large-modal {
        width: 90vw;
        max-width: 1200px;
        height: 80vh;
        display: flex;
        flex-direction: column;
    }

    .scrollable-body {
        overflow-y: auto;
        padding: 1rem;
    }

    .response-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .response-list li {
        margin-bottom: 0.5rem;
        line-height: 1.4em;
    }

    .modal-card-title {
        font-weight: 600;
        font-size: 1.4rem;
    }

    .tag.easy { background-color: #2a9d8f; color: #fff; }
    .tag.medium { background-color: #f4a261; color: #1d1d1d; }
    .tag.hard { background-color: #e76f51; color: #fff; }

    @media (max-width: 768px) {
        .modal-card.large-modal {
            width: 95vw;
            height: 85vh;
        }
        .aptitude-table th,
        .aptitude-table td {
            font-size: 1.1rem;
            padding: 1rem 0.75rem;
        }
        table.is-fullwidth {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>