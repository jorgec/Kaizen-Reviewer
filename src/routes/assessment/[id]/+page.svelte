<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';

	export let params; // { id: <assessment_instance_uuid> }

	let user: any;
	let questions: any[] = [];
	let currentIndex = 0;
	let currentQuestion: any = null;
	let startTime: number;
	let completed = false;
	let loading = true;
	let submitting = false;
	let error = '';

	const unsubscribe = userStore.subscribe((v) => (user = v));

	onMount(async () => {
		try {
			if (!user?.user_id) {
				goto('/login');
				return;
			}

			const { data, error: rpcError } = await supabase.rpc('rpc_fetch_assessment_instance_items', {
				p_instance_id: params.id
			});
			if (rpcError) throw rpcError;

			questions = data || [];
			if (questions.length > 0) {
				currentQuestion = questions[0];
				startTime = performance.now();
			}
		} catch (err: any) {
			error = err.message || 'Failed to load assessment items.';
		} finally {
			loading = false;
		}
	});

	async function selectAnswer(choiceLabel: string) {
		if (!currentQuestion || submitting) return;

		submitting = true;
		const endTime = performance.now();
		const timeSpent = Math.round(endTime - startTime);

		try {
			const { error } = await supabase.rpc('rpc_submit_response', {
				p_instance_id: params.id,
				p_question_id: currentQuestion.question_id,
				p_choice_label: choiceLabel,
				p_user_id: user.user_id,
				p_response_time_ms: timeSpent
			});
			if (error) throw error;

			currentIndex++;
			if (currentIndex < questions.length) {
				currentQuestion = questions[currentIndex];
				startTime = performance.now();
			} else {
				completed = true;
			}
		} catch (err: any) {
			alert('Error submitting response: ' + (err.message || err));
		} finally {
			submitting = false;
		}
	}
</script>

<section class="section">
	<div class="container">
		{#if loading}
			<div class="has-text-centered mt-6">
				<p>Preparing your assessment...</p>
				<progress class="progress is-small is-primary mt-3" max="100">Loading</progress>
			</div>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else if completed}
			<div class="assessment-complete">
				<h2 class="title">🎉 Assessment Complete!</h2>
				<p class="subtitle">Your responses have been recorded.</p>
				<a href="/dashboard" class="button is-primary">Return to Dashboard</a>
			</div>
		{:else if currentQuestion}
			<div class="column">
				<div class="card question-card">
					<div class="card-content">
						<h2 class="title is-5 mb-2">
							Question {currentIndex + 1} of {questions.length}
						</h2>
						<p class="content mb-4">{currentQuestion.stem}</p>

						<div class="buttons is-flex is-flex-direction-column">
							{#each currentQuestion.choices as choice}
								<button
									class="button is-fullwidth is-primary is-light mb-2"
									on:click={() => selectAnswer(choice.label)}
									disabled={submitting}
								>
									<strong>{choice.label}.</strong>&nbsp;{choice.text}
								</button>
							{/each}
						</div>

						<p class="is-size-7 has-text-grey mt-4">
							Difficulty: {currentQuestion.difficulty || '—'} &nbsp;•&nbsp;
							Topic: {currentQuestion.topic || '—'}
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
    .question-card {
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
    }
    .button.is-primary.is-light {
        background-color: var(--color-input-bg);
        color: var(--color-text-primary);
        border: 1px solid var(--color-outline);
        transition: background-color 0.15s ease, color 0.15s ease;
    }
    .button.is-primary.is-light:hover {
        background-color: #a8dadc;
        color: #1d3557;
    }
    .m-high, .m-excel {
        color: #fff;
    }
    .m-low, .m-fair, .m-good {
        color: var(--color-text-primary);
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>