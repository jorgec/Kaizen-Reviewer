<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	export let params;
	let user: any;
	let question: any = null;
	let feedback: any = null;
	let loading = true;
	let error = '';
	let startTime: number;

	userStore.subscribe((v) => (user = v));

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_fetch_prompt_question', {
				p_instance_id: params.id
			});
			if (rpcError) throw rpcError;
			question = data;
			startTime = performance.now();
		} catch (err: any) {
			error = err.message || 'Failed to load question.';
		} finally {
			loading = false;
		}
	});

	async function submit(choiceLabel: string) {
		const endTime = performance.now();
		const timeSpent = Math.round(endTime - startTime);

		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_submit_prompt_response', {
				p_instance_id: params.id,
				p_question_id: question.question_id,
				p_choice_label: choiceLabel,
				p_user_id: user.user_id,
				p_response_time_ms: timeSpent
			});
			if (rpcError) throw rpcError;
			feedback = data;
		} catch (err: any) {
			alert(err.message);
		}
	}
</script>

<section class="section">
	<div class="container">
		{#if loading}
			<p>Loading daily prompt...</p>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else if feedback}
			<div class="has-text-centered mt-6">
				<h2 class="title is-3">{feedback.is_correct ? '✅ Correct!' : '❌ Incorrect'}</h2>
				<p class="content">{feedback.explanation}</p>
				<a href="/dashboard" class="button is-primary mt-4">Return to Dashboard</a>
			</div>
		{:else if question}
			<div class="card question-card">
				<div class="card-content">
					<h2 class="title is-5 mb-2">{question.stem}</h2>
					<div class="buttons is-flex is-flex-direction-column">
						{#each question.choices as choice}
							<button class="button is-primary is-light mb-2" on:click={() => submit(choice.label)}>
								<strong>{choice.label}.</strong>&nbsp;{choice.text}
							</button>
						{/each}
					</div>
					<p class="is-size-7 has-text-grey mt-4">
						{question.topic || '—'} • {question.difficulty || '—'}
					</p>
				</div>
			</div>
		{/if}
	</div>
</section>

<style>

</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>