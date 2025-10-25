<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { notebookStore } from '$lib/stores/notebookStore';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	export let params;

	let user: any;
	let results: any[] = [];
	let loading = true;
	let error = '';
	let summary = { correct: 0, total: 0, score: 0 };
	let flaggedItems: any[] = [];
	let loadingFlagged = false;
	let selectedKeepItems = new Set<number>();
	let triageSubmitting = false;
	let existingNotes: any[] = [];
	let flaggedQuestionIds = new Set<number>();
	let flaggingItemId: bigint | null = null;

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

			// Load flagged items and existing notes
			await loadFlaggedItems();
			await loadExistingNotes();
		} catch (err: any) {
			error = err.message || 'Failed to load assessment results.';
		} finally {
			loading = false;
		}
	});

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

	async function loadExistingNotes() {
		if (!user?.user_id) return;

		try {
			const { data, error: fetchError } = await supabase.rpc('rpc_notes_list_by_instance', {
				p_user_id: user.user_id,
				p_instance_id: params.id
			});

			if (fetchError) throw fetchError;
			existingNotes = data || [];

			// Build a Set of question_ids that already have notes for efficient lookup
			flaggedQuestionIds = new Set(existingNotes.map(note => note.question_id));
		} catch (err) {
			console.error('Error loading existing notes:', err);
		}
	}

	async function flagItem(assessmentItemId: bigint, questionId: number) {
		if (!user?.user_id || flaggingItemId === assessmentItemId) return;

		flaggingItemId = assessmentItemId;
		try {
			const { error } = await supabase.rpc('rpc_notes_flag_item_by_item', {
				p_user_id: user.user_id,
				p_assessment_item_id: assessmentItemId
			});

			if (error) throw error;

			// Refresh the notes list and notebook badge to update UI
			await loadExistingNotes();
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}
		} catch (err) {
			console.error('Error flagging item:', err);
			alert('Failed to flag item for review');
		} finally {
			flaggingItemId = null;
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

			// Success - refresh notebook counts and reload flagged items to show updated state
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}
			await loadFlaggedItems();
			await loadExistingNotes();
		} catch (err: any) {
			alert('Error saving review selections: ' + (err.message || err));
		} finally {
			triageSubmitting = false;
		}
	}

	function toggleCorrect(idx: number) {
		results[idx].showCorrect = !results[idx].showCorrect;
		// Force Svelte to notice the change to an item inside the array
		results = [...results];
	}

	// Get muted score color based on calendar legend
	function getMutedScoreColor(score: number): string {
		if (score < 30) return '#d88888'; // muted red
		if (score < 50) return '#e8a876'; // muted orange
		if (score < 75) return '#f5c97f'; // muted amber
		if (score < 80) return '#a8c8d9'; // muted light blue
		if (score < 85) return '#7ba894'; // muted teal
		if (score < 90) return '#81d4c4'; // muted cyan
		return '#9cb89f'; // muted green
	}

	// Get accent color (slightly more saturated for borders/accents)
	function getScoreAccent(score: number): string {
		if (score < 30) return '#d00000';
		if (score < 50) return '#e36414';
		if (score < 75) return '#fb8b24';
		if (score < 80) return '#98c1d9';
		if (score < 85) return '#4b8a6f';
		if (score < 90) return '#07f6c3';
		return '#2d6a4f';
	}
</script>
<svelte:head>
	<title>Result :: Kaizen</title>

</svelte:head>

<div class="results-container">
	{#if loading}
		<div class="loading-state">
			<div class="loading-card">
				<div class="spinner-wrapper">
					<div class="spinner"></div>
				</div>
				<p class="loading-text">Loading results...</p>
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
	{:else if results.length === 0}
		<div class="empty-state">
			<div class="empty-card">
				<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14 2 14 8 20 8"></polyline>
				</svg>
				<p class="empty-message">No results found for this assessment.</p>
				<a href="/dashboard" class="modern-button secondary">Return to Dashboard</a>
			</div>
		</div>
	{:else}
		<!-- Summary Card with Score-Based Styling -->
		<div class="summary-card" style="border-top: 6px solid {getScoreAccent(summary.score)};">
			<div class="summary-header">
				<div class="score-circle" style="background: linear-gradient(135deg, {getMutedScoreColor(summary.score)}, {getScoreAccent(summary.score)}); box-shadow: 0 8px 24px {getScoreAccent(summary.score)}40;">
					<div class="score-value">{summary.score}%</div>
				</div>
				<h2 class="summary-title">Assessment Complete</h2>
				<p class="summary-subtitle">{summary.correct} out of {summary.total} questions correct</p>
			</div>

			{#if results.length >= 10}
				<!-- Detailed Summary Table -->
				<div class="breakdown-section">
					<h3 class="breakdown-title">Performance Breakdown</h3>
					<div class="breakdown-grid">
						{#each ['easy', 'medium', 'hard'] as level}
							{@const subset = results.filter(r => r.difficulty === level)}
							{@const correct = subset.filter(r => r.is_user_correct).length}
							{@const total = subset.length}
							{@const accuracy = total > 0 ? (correct / total) * 100 : 0}
							<div class="breakdown-card">
								<div class="breakdown-header">
									<span class="breakdown-level">{level}</span>
									<span class="breakdown-accuracy" style="color: {getScoreAccent(accuracy)};">{total > 0 ? accuracy.toFixed(1) + '%' : '—'}</span>
								</div>
								<div class="breakdown-stats">
									<span>{correct} / {total}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Weak Areas -->
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
						.filter(g => g.acc < 70 && g.total >= 2)
						.sort((a, b) => a.acc - b.acc);
				}}

				{@const weakSubjects = groupBy('subject')}
				{@const weakTopics = groupBy('topic')}

				{#if weakSubjects.length > 0 || weakTopics.length > 0}
					<div class="weak-areas-section">
						<h3 class="weak-areas-title">Areas to Improve</h3>

						{#if weakSubjects.length > 0}
							<h4 class="weak-category">By Subject</h4>
							<div class="weak-grid">
								{#each weakSubjects as s}
									<div class="weak-card" style="border-left: 3px solid {getScoreAccent(s.acc)};">
										<p class="weak-label">{s.label}</p>
										<p class="weak-acc" style="color: {getScoreAccent(s.acc)};">{s.acc.toFixed(1)}%</p>
									</div>
								{/each}
							</div>
						{/if}

						{#if weakTopics.length > 0}
							<h4 class="weak-category">By Topic</h4>
							<div class="weak-grid">
								{#each weakTopics as t}
									<div class="weak-card" style="border-left: 3px solid {getScoreAccent(t.acc)};">
										<p class="weak-label">{t.label}</p>
										<p class="weak-acc" style="color: {getScoreAccent(t.acc)};">{t.acc.toFixed(1)}%</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Flagged Items Triage Section -->
		{#if loadingFlagged}
			<div class="flagged-loading-card">
				<div class="spinner-wrapper">
					<div class="spinner-small"></div>
				</div>
				<p>Loading your flagged items...</p>
			</div>
		{:else if flaggedItems.length > 0}
			<div class="triage-card">
				<div class="triage-header">
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
						Save Changes
					{/if}
				</button>
			</div>
		{/if}

		<!-- Return to Dashboard Button -->
		<div class="dashboard-footer">
			<a href="/dashboard" class="modern-button primary">Return to Dashboard</a>
		</div>

		<!-- Results List -->
		<div class="results-list">
			{#each results as r, i}
				<div class="question-card {r.is_user_correct ? 'correct' : 'incorrect'}">
					<div class="question-header">
						<span class="question-number">Question {i + 1}</span>
						<div class="result-badge {r.is_user_correct ? 'correct' : 'incorrect'}">
							{#if r.is_user_correct}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
								<span>Correct</span>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
								<span>Incorrect</span>
							{/if}
						</div>
					</div>

					<h3 class="question-stem">{r.stem}</h3>

					<div class="answer-section">
						<div class="user-answer {r.is_user_correct ? 'correct' : 'incorrect'}">
							<span class="answer-label">Your Answer:</span>
							<span class="answer-text">{r.user_choice}. {r.user_choice_text}</span>
						</div>

						<button
							type="button"
							class="toggle-button"
							aria-expanded={r.showCorrect}
							aria-controls={`correct-${i}`}
							on:click={() => toggleCorrect(i)}
						>
							{#if r.showCorrect}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="18 15 12 9 6 15"></polyline>
								</svg>
								<span>Hide Explanation</span>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="6 9 12 15 18 9"></polyline>
								</svg>
								<span>Show Explanation</span>
							{/if}
						</button>

						{#if r.showCorrect}
							<div class="explanation-box" id={`correct-${i}`}>
								<div class="correct-answer-section">
									<span class="answer-label">Correct Answer:</span>
									<span class="answer-text">{r.correct_label}. {r.correct_text}</span>
								</div>
								{#if r.explanation}
									<div class="explanation-text">
										<div class="explanation-header">
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<circle cx="12" cy="12" r="10"></circle>
												<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
												<line x1="12" y1="17" x2="12.01" y2="17"></line>
											</svg>
											<span>Explanation</span>
										</div>
										<p>{r.explanation}</p>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="question-meta">
						{#if r.subject}
							<span class="meta-tag subject">{r.subject}</span>
						{/if}
						{#if r.topic}
							<span class="meta-tag topic">{r.topic}</span>
						{/if}
						{#if r.subtopic}
							<span class="meta-tag subtopic">{r.subtopic}</span>
						{/if}
						{#if r.difficulty}
							<span class="meta-tag difficulty {r.difficulty}">
								{r.difficulty}
							</span>
						{/if}
					</div>

					<!-- Flag button for unflagged items -->
					{#if !flaggedQuestionIds.has(r.question_id)}
						<div class="flag-action">
							<button
								type="button"
								class="flag-button-inline"
								on:click={() => flagItem(r.assessment_item_id, r.question_id)}
								disabled={flaggingItemId === r.assessment_item_id}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M9 18h6" />
									<path d="M10 22h4" />
									<path d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" />
								</svg>
								{#if flaggingItemId === r.assessment_item_id}
									<span>Flagging...</span>
								{:else}
									<span>Flag for Review</span>
								{/if}
							</button>
						</div>
					{:else}
						<div class="flag-action">
							<div class="flag-status">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M9 18h6" />
									<path d="M10 22h4" />
									<path d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" />
								</svg>
								<span>Flagged for Review</span>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
    /* Container */
    .results-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
        padding: 2rem 1rem;
    }

    /* Loading State */
    .loading-state,
    .error-state,
    .empty-state {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loading-card,
    .error-card,
    .empty-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 3rem 2rem;
        text-align: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        max-width: 500px;
        width: 100%;
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

    .loading-text,
    .empty-message {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #6b7280;
        margin: 0;
    }

    .error-card svg {
        color: #ef4444;
        margin-bottom: 1.5rem;
    }

    .empty-card svg {
        color: #9ca3af;
        margin-bottom: 1.5rem;
    }

    .error-message {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #dc2626;
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

    /* Summary Card */
    .summary-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 2.5rem;
        margin-bottom: 2rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        max-width: 900px;
        margin-left: auto;
        margin-right: auto;
    }

    .summary-header {
        text-align: center;
        margin-bottom: 2.5rem;
    }

    .score-circle {
        width: 140px;
        height: 140px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
        position: relative;
    }

    .score-value {
        font-family: 'Inter', sans-serif;
        font-size: 2.5rem;
        font-weight: 800;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .summary-title {
        font-family: 'Inter', sans-serif;
        font-size: 2rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.5rem 0;
    }

    .summary-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        color: #6b7280;
        margin: 0;
    }

    /* Breakdown Section */
    .breakdown-section {
        margin: 2rem 0;
        padding: 2rem 0;
        border-top: 2px solid #f3f4f6;
        border-bottom: 2px solid #f3f4f6;
    }

    .breakdown-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 1.5rem 0;
        text-align: center;
    }

    .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .breakdown-card {
        background: #faf9fc;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.25rem;
        transition: all 0.2s ease;
    }

    .breakdown-card:hover {
        border-color: #8b5cf6;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
    }

    .breakdown-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .breakdown-level {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: capitalize;
    }

    .breakdown-accuracy {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
    }

    .breakdown-stats {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #9ca3af;
    }

    /* Weak Areas Section */
    .weak-areas-section {
        margin: 2rem 0;
    }

    .weak-areas-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 1.5rem 0;
    }

    .weak-category {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 1.5rem 0 0.75rem 0;
    }

    .weak-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
    }

    .weak-card {
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        padding: 1rem 1.25rem;
        transition: all 0.2s ease;
    }

    .weak-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .weak-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .weak-acc {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 700;
        margin: 0;
    }

    /* Summary Footer */
    .summary-footer {
        margin-top: 2.5rem;
        text-align: center;
    }

    /* Results List */
    .results-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 900px;
        margin: 0 auto;
    }

    /* Question Card */
    .question-card {
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.5rem;
        transition: all 0.3s ease;
    }

    .question-card.correct {
        border-left: 4px solid #10b981;
    }

    .question-card.incorrect {
        border-left: 4px solid #ef4444;
    }

    .question-card:hover {
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
    }

    .question-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .question-number {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #9ca3af;
    }

    .result-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .result-badge.correct {
        background: #d1fae5;
        color: #065f46;
    }

    .result-badge.incorrect {
        background: #fee2e2;
        color: #991b1b;
    }

    .question-stem {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
        line-height: 1.6;
        margin: 0 0 1.25rem 0;
    }

    .answer-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .user-answer {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 1rem;
        border-radius: 8px;
        background: #f9fafb;
        border: 2px solid #e5e7eb;
    }

    .user-answer.correct {
        background: #ecfdf5;
        border-color: #a7f3d0;
    }

    .user-answer.incorrect {
        background: #fef2f2;
        border-color: #fecaca;
    }

    .answer-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .answer-text {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #374151;
        line-height: 1.5;
    }

    .toggle-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #8b5cf6;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .toggle-button:hover {
        background: #faf9fc;
        border-color: #8b5cf6;
    }

    .explanation-box {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
        background: #faf9fc;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
    }

    .correct-answer-section {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .explanation-text {
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .explanation-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
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

    .explanation-text p {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #374151;
        line-height: 1.6;
        margin: 0;
    }

    .question-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #f3f4f6;
    }

    .meta-tag {
        display: inline-block;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 500;
        background: #f3f4f6;
        color: #6b7280;
    }

    .meta-tag.subject {
        background: #faf9fc;
        color: #8b5cf6;
        border: 1px solid #e9d5ff;
    }

    .meta-tag.topic {
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #dbeafe;
    }

    .meta-tag.subtopic {
        background: #f0fdfa;
        color: #115e59;
        border: 1px solid #ccfbf1;
    }

    .meta-tag.difficulty.easy {
        background: #f0fdf4;
        color: #166534;
        border: 1px solid #bbf7d0;
    }

    .meta-tag.difficulty.medium {
        background: #fffbeb;
        color: #92400e;
        border: 1px solid #fde68a;
    }

    .meta-tag.difficulty.hard {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
    }

    /* Flagged Items Triage Section */
    .flagged-loading-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 2.5rem;
        text-align: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        max-width: 900px;
        margin: 0 auto 2rem;
    }

    .spinner-small {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f4f6;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .triage-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 2.5rem;
        margin-bottom: 2rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        max-width: 900px;
        margin-left: auto;
        margin-right: auto;
    }

    .triage-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e5e7eb;
    }

    .triage-header svg {
        color: #fbbf24;
        flex-shrink: 0;
    }

    .triage-header h3 {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 600;
        color: #111827;
        margin: 0;
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

    .flagged-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-height: 400px;
        overflow-y: auto;
        padding-right: 0.5rem;
        margin-bottom: 1.5rem;
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
        margin-bottom: 0;
    }

    .triage-submit-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .dashboard-footer {
        max-width: 900px;
        margin: 0 auto 2rem;
        text-align: center;
    }

    /* Flag Action */
    .flag-action {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #f3f4f6;
    }

    .flag-button-inline {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #fbbf24;
        background: rgba(251, 191, 36, 0.1);
        border: 2px solid rgba(251, 191, 36, 0.3);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .flag-button-inline:hover:not(:disabled) {
        background: rgba(251, 191, 36, 0.2);
        border-color: #fbbf24;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(251, 191, 36, 0.2);
    }

    .flag-button-inline:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .flag-button-inline svg {
        flex-shrink: 0;
    }

    .flag-status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
        border: 2px solid rgba(16, 185, 129, 0.3);
        border-radius: 8px;
    }

    .flag-status svg {
        flex-shrink: 0;
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        .results-container {
            padding: 1rem 0.75rem;
        }

        .summary-card {
            padding: 1.5rem;
        }

        .score-circle {
            width: 110px;
            height: 110px;
        }

        .score-value {
            font-size: 2rem;
        }

        .summary-title {
            font-size: 1.5rem;
        }

        .summary-subtitle {
            font-size: 1rem;
        }

        .breakdown-grid {
            grid-template-columns: 1fr;
        }

        .weak-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        }

        .question-card {
            padding: 1.25rem;
        }

        .question-stem {
            font-size: 1rem;
        }

        .question-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }

        .triage-card,
        .flagged-loading-card {
            padding: 1.5rem;
        }

        .triage-header h3 {
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
