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
<svelte:head>
	<title>Assessment :: Kaizen</title>

</svelte:head>

<div class="assessment-container">
	{#if loading}
		<div class="loading-state">
			<div class="loading-card">
				<div class="spinner-wrapper">
					<div class="spinner"></div>
				</div>
				<p class="loading-text">Preparing your assessment...</p>
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
	{:else if completed}
		<div class="complete-state">
			<div class="complete-card">
				<div class="success-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
				</div>
				<h2 class="complete-title">Assessment Complete!</h2>
				<p class="complete-subtitle">Your responses have been recorded successfully.</p>
				<a href="/dashboard" class="modern-button primary">Return to Dashboard</a>
			</div>
		</div>
	{:else if currentQuestion}
		<div class="question-wrapper">
			<div class="progress-header">
				<div class="progress-info">
					<span class="question-counter">Question {currentIndex + 1} of {questions.length}</span>
					<div class="progress-bar-wrapper">
						<div class="progress-bar" style="width: {((currentIndex + 1) / questions.length) * 100}%"></div>
					</div>
				</div>
			</div>

			<div class="question-card">
				<div class="question-content">
					<h2 class="question-stem">{currentQuestion.stem}</h2>

					<div class="choices-grid">
						{#each currentQuestion.choices as choice}
							<button
								class="choice-button"
								on:click={() => selectAnswer(choice.label)}
								disabled={submitting}
							>
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
						<div class="meta-badge difficulty">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"></circle>
								<line x1="12" y1="16" x2="12" y2="12"></line>
								<line x1="12" y1="8" x2="12.01" y2="8"></line>
							</svg>
							<span>{currentQuestion.difficulty || 'Unknown'}</span>
						</div>
						<div class="meta-badge topic">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
							</svg>
							<span>{currentQuestion.topic || 'General'}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
    /* Container */
    .assessment-container {
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
    .complete-state {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
    }

    .loading-card,
    .error-card,
    .complete-card {
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

    /* Complete State */
    .success-icon {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;
    }

    .success-icon svg {
        color: #10b981;
        filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3));
    }

    .complete-title {
        font-family: 'Inter', sans-serif;
        font-size: 2rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.75rem 0;
    }

    .complete-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #6b7280;
        margin: 0 0 2rem 0;
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
        background: linear-gradient(90deg, #a855f7, #6366f1);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .modern-button.primary:hover {
        background: linear-gradient(90deg, #9333ea, #4f46e5);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
        transform: translateY(-2px);
    }

    .modern-button.secondary {
        background: #ffffff;
        color: #6366f1;
        border: 2px solid #e5e7eb;
    }

    .modern-button.secondary:hover {
        background: #f0f1ff;
        border-color: #6366f1;
    }

    /* Question Wrapper */
    .question-wrapper {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }

    /* Progress Header */
    .progress-header {
        background: #ffffff;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .progress-info {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .question-counter {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #374151;
    }

    .progress-bar-wrapper {
        width: 100%;
        height: 8px;
        background: #e5e7eb;
        border-radius: 999px;
        overflow: hidden;
    }

    .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #a855f7, #6366f1);
        border-radius: 999px;
        transition: width 0.3s ease;
    }

    /* Question Card */
    .question-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 2.5rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        border: 2px solid #e5e7eb;
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

    .choice-button:hover:not(:disabled) {
        background: #faf9fc;
        border-color: #8b5cf6;
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.12);
    }

    .choice-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .choice-label {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #a855f7, #6366f1);
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

    .choice-button:hover:not(:disabled) .choice-arrow {
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
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .meta-badge svg {
        color: #9ca3af;
        flex-shrink: 0;
    }

    .meta-badge.difficulty svg {
        color: #a855f7;
    }

    .meta-badge.topic svg {
        color: #8b5cf6;
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        .assessment-container {
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

        .progress-header {
            padding: 1rem;
        }

        .complete-title {
            font-size: 1.5rem;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>