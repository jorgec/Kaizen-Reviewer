<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	export let params;

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
			const { data, error: rpcError } = await supabase.rpc(
				'rpc_fetch_assessment_results_detail',
				{ p_instance_id: params.id }
			);
			if (rpcError) throw rpcError;

			results = (data || []).map((r) => ({
				...r,
				showCorrect: false
			}));

			if (results.length > 0) {
				const total = results.length;
				const correct = results.filter((r) => r.is_user_correct).length;
				summary = {
					correct,
					total,
					score: Number(((correct / total) * 100).toFixed(1))
				};
			}
		} catch (err: any) {
			error = err.message || 'Failed to load assessment results.';
		} finally {
			loading = false;
		}
	});

	function toggleCorrect(idx: number) {
		results[idx].showCorrect = !results[idx].showCorrect;
		// Force Svelte to notice the change to an item inside the array
		results = [...results];
	}
</script>

<section class="section">
	<div class="container">
		{#if loading}
			<p class="has-text-centered">Loading results...</p>
		{:else if error}
			<p class="has-text-danger has-text-centered">{error}</p>
		{:else if results.length === 0}
			<p class="has-text-centered">No results found for this assessment.</p>
		{:else}
			<!-- Summary Card -->
			<div class="summary-card has-text-centered">
				<div class="trophy" aria-hidden="true">🏆</div>
				<h2 class="title is-4">Assessment Summary</h2>
				<p class="score">{summary.score}%</p>
				<p class="is-size-6">{summary.correct} / {summary.total} correct</p>

				{#if results.length >= 10}
					<!-- Detailed Summary Table -->
					<hr style="margin: 1rem 0;" />
					<h3 class="title is-6 mb-3">Performance Breakdown</h3>
					<table class="table is-fullwidth is-striped is-narrow">
						<thead>
						<tr>
							<th>Difficulty</th>
							<th>Correct</th>
							<th>Total</th>
							<th>Accuracy</th>
						</tr>
						</thead>
						<tbody>
						{#each ['easy', 'medium', 'hard'] as level}
							{@const subset = results.filter(r => r.difficulty === level)}
							{@const correct = subset.filter(r => r.is_user_correct).length}
							{@const total = subset.length}
							<tr>
								<td class="has-text-weight-semibold text-capitalize">{level}</td>
								<td>{correct}</td>
								<td>{total}</td>
								<td>{total > 0 ? ((correct / total) * 100).toFixed(1) + '%' : '—'}</td>
							</tr>
						{/each}
						</tbody>
					</table>

					<!-- Weak Areas -->
					{#if results.length >= 10}
						{@const groupBy = (key) => {
							const groups = {};
							for (const r of results) {
								const k = r[key];
								if (!k) continue;
								if (!groups[k]) groups[k] = { total: 0, correct: 0 };
								groups[k].total++;
								if (r.is_user_correct) groups[k].correct++;
							}
							return Object.entries(groups)
								.map(([label, g]) => ({ label, acc: (g.correct / g.total) * 100, total: g.total }))
								.filter(g => g.acc < 70 && g.total >= 2)  // at least 1 attempt
								.sort((a, b) => a.acc - b.acc);
						}}

						{@const weakSubjects = groupBy('subject')}
						{@const weakTopics = groupBy('topic')}
						{@const weakSubs = groupBy('subtopic')}

						<!-- Weak Areas -->
						<div class="weak-area-list">
							{#if weakSubjects.length > 0}
								<h4 class="subtitle is-7 mt-3">By Subject</h4>
								<div class="weak-area-grid">
									{#each weakSubjects as s}
										<div class="weak-card">
											<p class="weak-label">{s.label}</p>
											<p class="weak-acc">{s.acc.toFixed(1)}%</p>
										</div>
									{/each}
								</div>
							{/if}

							{#if weakTopics.length > 0}
								<h4 class="subtitle is-7 mt-3">By Topic</h4>
								<div class="weak-area-grid">
									{#each weakTopics as t}
										<div class="weak-card">
											<p class="weak-label">{t.label}</p>
											<p class="weak-acc">{t.acc.toFixed(1)}%</p>
										</div>
									{/each}
								</div>
							{/if}

							<!--{#if weakSubs.length > 0}-->
							<!--	<h4 class="subtitle is-7 mt-3">By Subtopic</h4>-->
							<!--	<div class="weak-area-grid">-->
							<!--		{#each weakSubs as st}-->
							<!--			<div class="weak-card">-->
							<!--				<p class="weak-label">{st.label}</p>-->
							<!--				<p class="weak-acc">{st.acc.toFixed(1)}%</p>-->
							<!--			</div>-->
							<!--		{/each}-->
							<!--	</div>-->
							<!--{/if}-->
						</div>
					{/if}
				{/if}

				<a href="/dashboard" class="button is-primary mt-4">Return to Dashboard</a>
			</div>

			<!-- Results List -->
			<div class="results-list">
				{#each results as r, i}
					<div class="card question-card {r.is_user_correct ? 'correct' : 'incorrect'}">
						<div class="card-content">
							<p class="question-index">Question {i + 1}</p>
							<p class="question-stem">{r.stem}</p>

							<p class="user-answer">
								{#if r.is_user_correct}
									<span class="has-text-success">✅ Your Answer: {r.user_choice} — {r.user_choice_text}</span>
								{:else}
									<span class="has-text-danger">❌ Your Answer: {r.user_choice} — {r.user_choice_text}</span>
								{/if}
							</p>

							<button
								type="button"
								class="button is-small is-light toggle-btn"
								aria-expanded={r.showCorrect}
								aria-controls={`correct-${i}`}
								on:click={() => toggleCorrect(i)}
							>
								{r.showCorrect ? 'Hide Correct Answer' : 'Show Correct Answer'}
							</button>

							{#if r.showCorrect}
								<div class="correct-answer" id={`correct-${i}`}>
									<p>
										<strong>✅ Correct:</strong> {r.correct_label} — {r.correct_text}
									</p>
									{#if r.explanation}
										<p class="explanation">{r.explanation}</p>
									{/if}
								</div>
							{/if}

							<div class="tags">
								{#if r.subject}
									<span class="tag is-light">{r.subject}</span>
								{/if}
								{#if r.topic}
									<span class="tag is-info is-light">{r.topic}</span>
								{/if}
								{#if r.subtopic}
									<span class="tag is-link is-light">{r.subtopic}</span>
								{/if}
								{#if r.difficulty}
									<span
										class="tag {r.difficulty === 'easy'
											? 'is-success'
											: r.difficulty === 'medium'
											? 'is-warning'
											: 'is-danger'}"
									>
										{r.difficulty}
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
    .section {
        padding: 1.5rem 0.75rem;
    }

    .summary-card {
        background: #fff;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        /*max-width: 90%;*/
        margin: 0 auto 2rem;
    }

    .summary-card .trophy {
        font-size: 2.5rem;
        line-height: 1;
        margin-bottom: 0.5rem;
    }

    .summary-card .score {
        font-size: 2.2rem;
        font-weight: 700;
        margin: 0.5rem 0;
    }

    .results-list {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .question-card {
        border-radius: 12px;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
        padding: 1.25rem 1rem;
    }

    .question-card.correct {
        border-left: 4px solid #2a9d8f;
    }

    .question-card.incorrect {
        border-left: 4px solid #e76f51;
    }

    .question-index {
        font-size: 0.9rem;
        color: #999;
        margin-bottom: 0.3rem;
    }

    .question-stem {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.75rem;
        line-height: 1.5;
    }

    .user-answer {
        margin-bottom: 0.75rem;
        font-size: 0.95rem;
    }

    .toggle-btn {
        font-size: 0.85rem;
        margin-bottom: 0.75rem;
    }

    .correct-answer {
        background: rgba(42, 157, 143, 0.1);
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin-bottom: 0.75rem;
    }

    .correct-answer p {
        margin: 0.3rem 0;
    }

    .explanation {
        font-size: 0.9rem;
        color: #444;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .tag {
        font-size: 0.8rem;
    }

    @media (max-width: 768px) {
        .section {
            padding: 1rem 0.75rem;
        }

        .summary-card {
            padding: 1.25rem;
        }

        .question-card {
            padding: 1rem;
        }

        .question-stem {
            font-size: 0.95rem;
        }
    }

    .summary-card table {
        margin-top: 0.75rem;
        font-size: 0.9rem;
        text-align: center;
    }

    .summary-card th,
    .summary-card td {
        padding: 0.4rem 0.6rem;
    }

    /* ============================================================
   Weak Area Grid Styling
   ============================================================ */

    .weak-area-list {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    /* Grid of cards */
    .weak-area-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.85rem;
    }

    /* Each weakness card */
    .weak-card {
        background: color-mix(in srgb, var(--mastery-0) 20%, white);
        border-radius: var(--radius-lg, 10px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        padding: 0.9rem 1rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;
        transition: all 0.25s ease;
    }

    /* Label text */
    .weak-card .weak-label {
        font-weight: 600;
        font-size: 0.95rem;
        color: #2b2b2b;
        margin-bottom: 0.3rem;
        line-height: 1.4;
    }

    /* Accuracy percentage */
    .weak-card .weak-acc {
        font-weight: 700;
        font-size: 1rem;
        color: var(--mastery-0);
    }

    /* Hover + focus */
    .weak-card:hover,
    .weak-card:focus {
        transform: translateY(-2px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
        background: color-mix(in srgb, var(--mastery-0) 30%, white);
        cursor: default;
    }

    /* Headings above each section */
    .weak-area-list h4.subtitle {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mastery-0);
        margin-bottom: 0.25rem;
    }

    /* Mobile optimization */
    @media (max-width: 600px) {
        .weak-area-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }

        .weak-card {
            padding: 0.75rem 0.9rem;
        }

        .weak-card .weak-label {
            font-size: 0.9rem;
        }

        .weak-card .weak-acc {
            font-size: 0.95rem;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>