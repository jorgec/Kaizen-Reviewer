<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { notebookStore } from '$lib/stores/notebookStore';
	import FlagButton from '$lib/components/FlagButton.svelte';

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
	let flaggedItems: any[] = [];
	let loadingFlagged = false;
	let selectedKeepItems = new Set<number>();
	let triageSubmitting = false;

	const unsubscribe = userStore.subscribe((v) => (user = v));

	onMount(async () => {
		try {
			if (!user?.user_id) {
				goto('/login');
				return;
			}
			const { data, error: rpcError } = await supabase.rpc('rpc_fetch_assessment_instance_items_with_id', {
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
				await loadFlaggedItems();
			}
		} catch (err: any) {
			alert('Error submitting response: ' + (err.message || err));
		} finally {
			submitting = false;
		}
	}

	async function loadFlaggedItems() {
		if (!user?.user_id) return;

		loadingFlagged = true;
		try {
			const { data, error: fetchError } = await supabase
				.from('v_notes_flagged_enriched')
				.select('*')
				.eq('user_id', user.user_id)
				.eq('assessment_instance_id', params.id)
				.order('topic_name')
				.order('subtopic_name')
				.order('flagged_at');

			if (fetchError) throw fetchError;
			flaggedItems = data || [];
			selectedKeepItems = new Set(); // Reset selection
		} catch (err) {
			console.error('Error loading flagged items:', err);
		} finally {
			loadingFlagged = false;
		}
	}

	function toggleItemSelection(assessmentItemId: number) {
		if (selectedKeepItems.has(assessmentItemId)) {
			selectedKeepItems.delete(assessmentItemId);
		} else {
			selectedKeepItems.add(assessmentItemId);
		}
		selectedKeepItems = selectedKeepItems; // Trigger reactivity
	}

	async function submitTriage() {
		if (!user?.user_id || triageSubmitting) return;

		triageSubmitting = true;
		try {
			const keepIds = Array.from(selectedKeepItems);

			// Get unselected item IDs
			const wontReviewIds = flaggedItems
				.filter(item => !selectedKeepItems.has(item.assessment_item_id))
				.map(item => item.assessment_item_id);

			const { error } = await supabase.rpc('rpc_notes_post_exam_triage', {
				p_user_id: user.user_id,
				p_instance_id: params.id,
				p_keep_assessment_item_ids: keepIds,
				p_wont_review_assessment_item_ids: wontReviewIds.length > 0 ? wontReviewIds : null,
				p_org_id: user.currentOrg?.org_id || null
			});

			if (error) throw error;

			// Success - refresh notebook counts and redirect to dashboard
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}
			goto('/dashboard');
		} catch (err: any) {
			alert('Error saving review selections: ' + (err.message || err));
		} finally {
			triageSubmitting = false;
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

				{#if loadingFlagged}
					<div class="flagged-loading">
						<div class="spinner-small"></div>
						<p>Loading your flagged items...</p>
					</div>
				{:else if flaggedItems.length > 0}
					<div class="flagged-section">
						<div class="flagged-header">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9 18h6" />
								<path d="M10 22h4" />
								<path d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" fill="currentColor" />
							</svg>
							<h3>Review Your Flagged Items ({flaggedItems.length})</h3>
						</div>
						<p class="triage-instruction">
							Tap the questions you want to save for review. Unselected items will be removed.
						</p>
						<div class="flagged-list">
							{#each flaggedItems as item}
								<button
									class="flagged-item"
									class:selected={selectedKeepItems.has(item.assessment_item_id)}
									on:click={() => toggleItemSelection(item.assessment_item_id)}
									type="button"
								>
									<div class="flagged-item-header">
										<span class="flagged-topic">{item.topic_name || 'General'}</span>
										{#if item.subtopic_name}
											<span class="flagged-subtopic">{item.subtopic_name}</span>
										{/if}
										<div class="selection-indicator">
											{#if selectedKeepItems.has(item.assessment_item_id)}
												<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											{/if}
										</div>
									</div>
									<p class="flagged-stem">{item.stem || 'Question'}</p>
									{#if item.flagged_at}
										<span class="flagged-time">Flagged {new Date(item.flagged_at).toLocaleString()}</span>
									{/if}
								</button>
							{/each}
						</div>
						<div class="triage-summary">
							<p>
								<strong>{selectedKeepItems.size}</strong> item{selectedKeepItems.size !== 1 ? 's' : ''} selected to keep
								{#if flaggedItems.length - selectedKeepItems.size > 0}
									• <strong>{flaggedItems.length - selectedKeepItems.size}</strong> will be removed
								{/if}
							</p>
						</div>
						<button
							class="modern-button primary triage-submit-button"
							on:click={submitTriage}
							disabled={triageSubmitting}
							type="button"
						>
							{#if triageSubmitting}
								Saving...
							{:else}
								Save & Continue
							{/if}
						</button>
					</div>
				{/if}

				{#if flaggedItems.length === 0 && !loadingFlagged}
					<a href="/dashboard" class="modern-button primary">Return to Dashboard</a>
				{/if}
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

			{#if currentQuestion && user?.user_id && currentQuestion.assessment_item_id}
				{#key currentQuestion.question_id}
					<FlagButton
						userId={user.user_id}
						assessmentItemId={currentQuestion.assessment_item_id}
					/>
				{/key}
			{/if}
		</div>
	{/if}
</div>

<style>
    /* Container */
    .assessment-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
        padding: 2rem 1rem;
        padding-top: 5rem;
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

    /* Flagged Items Section */
    .flagged-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 2rem 0;
        color: #6b7280;
    }

    .spinner-small {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f4f6;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .flagged-section {
        width: 100%;
        margin: 2rem 0;
        text-align: left;
    }

    .flagged-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e5e7eb;
    }

    .flagged-header svg {
        color: #fbbf24;
        flex-shrink: 0;
    }

    .flagged-header h3 {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
    }

    .flagged-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 0.5rem;
    }

    .flagged-list::-webkit-scrollbar {
        width: 6px;
    }

    .flagged-list::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 3px;
    }

    .flagged-list::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
    }

    .flagged-list::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
    }

    .flagged-item {
        width: 100%;
        background: #e5e7eb;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        padding: 1rem;
        transition: all 0.2s ease;
        cursor: pointer;
        text-align: left;
        opacity: 0.6;
    }

    .flagged-item:hover {
        opacity: 0.8;
        border-color: #9ca3af;
        box-shadow: 0 2px 8px rgba(107, 114, 128, 0.15);
    }

    .flagged-item.selected {
        background: #fef3c7;
        border-color: #fbbf24;
        opacity: 1;
        box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
    }

    .flagged-item.selected:hover {
        background: #fef08a;
        box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
    }

    .flagged-item-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .selection-indicator {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        background: #10b981;
        color: white;
    }

    .triage-instruction {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #6b7280;
        text-align: center;
        margin: 0 0 1.5rem 0;
        padding: 0.75rem 1rem;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
    }

    .triage-summary {
        margin: 1.5rem 0;
        padding: 1rem;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        text-align: center;
    }

    .triage-summary p {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #374151;
        margin: 0;
    }

    .triage-summary strong {
        color: #111827;
        font-weight: 700;
    }

    .triage-submit-button {
        width: 100%;
        margin-bottom: 1rem;
    }

    .triage-submit-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .flagged-topic,
    .flagged-subtopic {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .flagged-topic {
        background: #fbbf24;
        color: #78350f;
    }

    .flagged-subtopic {
        background: #fed7aa;
        color: #9a3412;
    }

    .flagged-stem {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #374151;
        line-height: 1.5;
        margin: 0 0 0.5rem 0;
    }

    .flagged-time {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #78350f;
        opacity: 0.8;
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        .assessment-container {
            padding: 1rem 0.75rem;
            padding-top: 4rem;
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

        .flagged-header h3 {
            font-size: 1.125rem;
        }

        .flagged-list {
            max-height: 300px;
        }

        .flagged-item {
            padding: 0.875rem;
        }

        .flagged-stem {
            font-size: 0.875rem;
        }

        .triage-instruction {
            font-size: 0.875rem;
        }

        .triage-summary p {
            font-size: 0.875rem;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>