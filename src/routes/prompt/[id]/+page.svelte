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
<svelte:head>
	<title>Prompt :: Kaizen</title>

</svelte:head>

<div class="prompt-container">
	{#if loading}
		<div class="loading-state">
			<div class="loading-card">
				<div class="spinner-wrapper">
					<div class="spinner"></div>
				</div>
				<p class="loading-text">Loading daily prompt...</p>
			</div>
		</div>
	{:else if error}
		<div class="error-state">
			<div class="error-card">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<p class="error-message">{error}</p>
				<a href="/dashboard" class="modern-button secondary">Return to Dashboard</a>
			</div>
		</div>
	{:else if feedback}
		<div class="feedback-state">
			<div class="feedback-card {feedback.is_correct ? 'correct' : 'incorrect'}">
				<div class="feedback-icon">
					{#if feedback.is_correct}
						<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
							<polyline points="22 4 12 14.01 9 11.01"></polyline>
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="15" y1="9" x2="9" y2="15"></line>
							<line x1="9" y1="9" x2="15" y2="15"></line>
						</svg>
					{/if}
				</div>
				<h2 class="feedback-title">{feedback.is_correct ? 'Correct!' : 'Incorrect'}</h2>
				<div class="feedback-explanation">
					<div class="explanation-header">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"></circle>
							<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
							<line x1="12" y1="17" x2="12.01" y2="17"></line>
						</svg>
						<span>Explanation</span>
					</div>
					<p class="explanation-text">{feedback.explanation}</p>
				</div>
				<a href="/dashboard" class="modern-button primary">Return to Dashboard</a>
			</div>
		</div>
	{:else if question}
		<div class="question-wrapper">
			<div class="prompt-badge">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
				</svg>
				<span>Daily Prompt</span>
			</div>

			<div class="question-card">
				<div class="question-content">
					<h2 class="question-stem">{question.stem}</h2>

					<div class="choices-grid">
						{#each question.choices as choice}
							<button class="choice-button" on:click={() => submit(choice.label)}>
								<div class="choice-label">{choice.label}</div>
								<div class="choice-text">{choice.text}</div>
								<div class="choice-arrow">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="5" y1="12" x2="19" y2="12"></line>
										<polyline points="12 5 19 12 12 19"></polyline>
									</svg>
								</div>
							</button>
						{/each}
					</div>

					<div class="question-meta">
						<div class="meta-badge topic">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
							</svg>
							<span>{question.topic || 'General'}</span>
						</div>
						<div class="meta-badge difficulty">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"></circle>
								<line x1="12" y1="16" x2="12" y2="12"></line>
								<line x1="12" y1="8" x2="12.01" y2="8"></line>
							</svg>
							<span>{question.difficulty || 'Unknown'}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
    /* Container */
    .prompt-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
        padding: 2rem 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Loading State */
    .loading-state,
    .error-state,
    .feedback-state {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
    }

    .loading-card,
    .error-card,
    .feedback-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 3rem 2rem;
        text-align: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .spinner-wrapper {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #f3f4f6;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .loading-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #6b7280;
        margin: 0;
    }

    /* Error State */
    .error-card svg {
        color: #ef4444;
        margin-bottom: 1.5rem;
    }

    .error-message {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #dc2626;
        margin: 0 0 2rem 0;
    }

    /* Feedback State */
    .feedback-card {
        border: 3px solid transparent;
    }

    .feedback-card.correct {
        border-color: #10b981;
        background: linear-gradient(to bottom, #ffffff, #f0fdf4);
    }

    .feedback-card.incorrect {
        border-color: #ef4444;
        background: linear-gradient(to bottom, #ffffff, #fef2f2);
    }

    .feedback-icon {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;
    }

    .feedback-card.correct .feedback-icon svg {
        color: #10b981;
        filter: drop-shadow(0 4px 16px rgba(16, 185, 129, 0.3));
    }

    .feedback-card.incorrect .feedback-icon svg {
        color: #ef4444;
        filter: drop-shadow(0 4px 16px rgba(239, 68, 68, 0.3));
    }

    .feedback-title {
        font-family: 'Inter', sans-serif;
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 1.5rem 0;
    }

    .feedback-card.correct .feedback-title {
        color: #059669;
    }

    .feedback-card.incorrect .feedback-title {
        color: #dc2626;
    }

    .feedback-explanation {
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        text-align: left;
    }

    .explanation-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #6366f1;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .explanation-header svg {
        color: #6366f1;
    }

    .explanation-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #374151;
        line-height: 1.6;
        margin: 0;
    }

    /* Modern Buttons */
    .modern-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.875rem 2rem;
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        border-radius: 10px;
        text-decoration: none;
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
    }

    .modern-button.primary {
        background: linear-gradient(90deg, #a855f7, #8b5cf6);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
    }

    .modern-button.primary:hover {
        background: linear-gradient(90deg, #9333ea, #7c3aed);
        box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
        transform: translateY(-2px);
    }

    .modern-button.secondary {
        background: #ffffff;
        color: #8b5cf6;
        border: 2px solid #e5e7eb;
    }

    .modern-button.secondary:hover {
        background: #faf9fc;
        border-color: #8b5cf6;
    }

    /* Question Wrapper */
    .question-wrapper {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }

    /* Prompt Badge */
    .prompt-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        border: 2px solid rgba(139, 92, 246, 0.3);
        border-radius: 999px;
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        color: #8b5cf6;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
        margin-bottom: 1.5rem;
    }

    .prompt-badge svg {
        color: #8b5cf6;
        filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.3));
    }

    /* Question Card */
    .question-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 2.5rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        border: 2px solid rgba(139, 92, 246, 0.15);
        transition: all 0.3s ease;
    }

    .question-content {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .question-stem {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 600;
        color: #111827;
        line-height: 1.5;
        margin: 0;
    }

    /* Choices Grid */
    .choices-grid {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .choice-button {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        font-family: 'Inter', sans-serif;
    }

    .choice-button:hover {
        background: #faf9fc;
        border-color: #8b5cf6;
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.12);
    }

    .choice-label {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #a855f7, #8b5cf6);
        color: #ffffff;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 700;
        flex-shrink: 0;
    }

    .choice-text {
        font-size: 1rem;
        color: #374151;
        line-height: 1.5;
    }

    .choice-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
        transition: all 0.2s ease;
        flex-shrink: 0;
    }

    .choice-button:hover .choice-arrow {
        color: #8b5cf6;
        transform: translateX(4px);
    }

    /* Question Meta */
    .question-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding-top: 1.5rem;
        border-top: 1px solid #f3f4f6;
    }

    .meta-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: #faf9fc;
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .meta-badge svg {
        flex-shrink: 0;
    }

    .meta-badge.topic svg {
        color: #8b5cf6;
    }

    .meta-badge.difficulty svg {
        color: #a855f7;
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        .prompt-container {
            padding: 1rem 0.75rem;
        }

        .question-card {
            padding: 1.5rem;
        }

        .question-stem {
            font-size: 1.25rem;
        }

        .choice-button {
            grid-template-columns: auto 1fr;
            gap: 0.75rem;
            padding: 1rem;
        }

        .choice-arrow {
            display: none;
        }

        .choice-label {
            width: 36px;
            height: 36px;
            font-size: 0.9375rem;
        }

        .choice-text {
            font-size: 0.9375rem;
        }

        .feedback-title {
            font-size: 1.5rem;
        }

        .prompt-badge {
            font-size: 0.9375rem;
            padding: 0.625rem 1.25rem;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>