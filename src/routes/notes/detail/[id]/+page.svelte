<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { notebookStore } from '$lib/stores/notebookStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	export let params;

	let loading = true;
	let error: string | null = null;
	let note: any = null;
	let user: any;
	let selectedRating: number | null = null;
	let newCommentBody = '';
	let isAddingComment = false;
	let editingCommentId: number | null = null;
	let editCommentBody = '';
	let comments: any[] = [];
	let showSnoozeMenu = false;
	let isSnoozing = false;
	let isUpdatingStatus = false;
	let isActivityExpanded = false;

	// Review state
	let reviewStart: number = 0;
	let selectedChoice: string | null = null;
	let confidence: number | null = null;
	let isSubmittingReview = false;
	let reviewSubmitted = false;
	let reviewResult: { correct: boolean; correctLabel: string } | null = null;

	userStore.subscribe((v) => (user = v));

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		await loadNoteDetail();
		// Start review timer
		reviewStart = Date.now();
	});

	async function loadNoteDetail() {
		try {
			loading = true;
			error = null;
			const result = await supabase.rpc('rpc_notes_get_note_detail', {
				p_user_id: user.user_id,
				p_note_id: params.id
			});

			if (result.error) {
				error = result.error.message;
			} else {
				// RPC returns an array, get the first element
				const data = result.data;
				note = Array.isArray(data) && data.length > 0 ? data[0] : null;
				selectedRating = note?.rating || null;
				comments = note?.comments || [];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	function getRatingStars(rating: number) {
		return Array.from({ length: 5 }, (_, i) => i < rating);
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Not set';
		const date = new Date(dateString);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'open':
				return { bg: '#e8f3fc', border: '#a0c8e8', text: '#5580a0' };
			case 'in_review':
				return { bg: '#fef6e8', border: '#f5d89e', text: '#a68950' };
			case 'resolved':
				return { bg: '#e8f5ee', border: '#a0d4b5', text: '#4a7c59' };
			case 'archived':
				return { bg: '#f3f4f6', border: '#c8ccd3', text: '#6b7280' };
			default:
				return { bg: '#f3f4f6', border: '#c8ccd3', text: '#6b7280' };
		}
	}

	async function updateRating(rating: number) {
		if (!user?.user_id || !note?.note_id) return;

		const previousRating = selectedRating;
		selectedRating = rating;

		try {
			const { error } = await supabase.rpc('rpc_notes_set_rating', {
				p_user_id: user.user_id,
				p_note_id: note.note_id,
				p_rating: rating
			});

			if (error) throw error;

			// Update the note object
			note.rating = rating;
		} catch (err) {
			console.error('Error updating rating:', err);
			selectedRating = previousRating;
			alert('Failed to update rating');
		}
	}

	async function setStatus(newStatus: string) {
		if (!user?.user_id || !note?.note_id || isUpdatingStatus) return;

		const previousStatus = note.status;
		isUpdatingStatus = true;

		try {
			const { error } = await supabase.rpc('rpc_notes_set_status', {
				p_user_id: user.user_id,
				p_note_id: note.note_id,
				p_status: newStatus
			});

			if (error) throw error;

			// Update the note object
			note.status = newStatus;

			// Refresh notebook badge counts
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}
		} catch (err) {
			console.error('Error updating status:', err);
			note.status = previousStatus;
			alert('Failed to update status');
		} finally {
			isUpdatingStatus = false;
		}
	}

	async function snoozeNote(intervalText: string) {
		if (!user?.user_id || !note?.note_id || isSnoozing) return;

		isSnoozing = true;
		showSnoozeMenu = false;

		try {
			const { data, error } = await supabase.rpc('rpc_notes_snooze', {
				p_user_id: user.user_id,
				p_note_id: note.note_id,
				p_interval_text: intervalText
			});

			if (error) throw error;

			// Update the note's due date
			if (data) {
				note.due_at = data;
				note.snooze_count = (note.snooze_count || 0) + 1;
				note.last_snoozed_at = new Date().toISOString();
			}

			// Refresh notebook counts
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}
		} catch (err) {
			console.error('Error snoozing note:', err);
			alert('Failed to snooze note');
		} finally {
			isSnoozing = false;
		}
	}

	function getEventIcon(eventType: string) {
		switch (eventType) {
			case 'created':
				return 'M12 5v14m7-7H5';
			case 'reviewed':
				return 'M20 6L9 17l-5-5';
			case 'snoozed':
				return 'M12 6v6l4 2';
			case 'updated':
				return 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7';
			default:
				return 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z';
		}
	}

	async function addComment() {
		if (!user?.user_id || !note?.note_id || !newCommentBody.trim() || isAddingComment) return;

		isAddingComment = true;
		try {
			const { error } = await supabase.rpc('rpc_notes_add_comment', {
				p_user_id: user.user_id,
				p_note_id: note.note_id,
				p_body: newCommentBody.trim()
			});

			if (error) throw error;

			// Reload note detail to get updated comments
			await loadNoteDetail();
			newCommentBody = '';
		} catch (err) {
			console.error('Error adding comment:', err);
			alert('Failed to add comment');
		} finally {
			isAddingComment = false;
		}
	}

	function startEditComment(comment: any) {
		editingCommentId = comment.id;
		editCommentBody = comment.body;
	}

	function cancelEdit() {
		editingCommentId = null;
		editCommentBody = '';
	}

	async function saveEditComment(commentId: number) {
		if (!user?.user_id || !editCommentBody.trim()) return;

		try {
			const { error } = await supabase.rpc('rpc_notes_edit_comment', {
				p_user_id: user.user_id,
				p_comment_id: commentId,
				p_body: editCommentBody.trim()
			});

			if (error) throw error;

			// Reload note detail to get updated comments
			await loadNoteDetail();
			editingCommentId = null;
			editCommentBody = '';
		} catch (err) {
			console.error('Error editing comment:', err);
			alert('Failed to edit comment');
		}
	}

	async function removeComment(commentId: number) {
		if (!user?.user_id) return;

		if (!confirm('Are you sure you want to delete this comment?')) return;

		try {
			const { error } = await supabase.rpc('rpc_notes_remove_comment', {
				p_user_id: user.user_id,
				p_comment_id: commentId
			});

			if (error) throw error;

			// Reload note detail to get updated comments
			await loadNoteDetail();
		} catch (err) {
			console.error('Error removing comment:', err);
			alert('Failed to remove comment');
		}
	}

	function selectChoice(choiceLabel: string) {
		if (reviewSubmitted) return;
		selectedChoice = choiceLabel;
	}

	async function submitReview() {
		if (!user?.user_id || !note?.note_id || !selectedChoice || confidence === null || isSubmittingReview) return;

		isSubmittingReview = true;
		const reviewEnd = Date.now();
		const timeMs = reviewEnd - reviewStart;

		try {
			// Set status to in_review
			await setStatus('in_review');

			// Get correct choice
			const { data: correctChoiceData, error: correctError } = await supabase.rpc('rpc_get_correct_choice', {
				p_question_id: note.question_id
			});

			if (correctError) throw correctError;

			const correctLabel = correctChoiceData?.label;
			const isCorrect = selectedChoice === correctLabel;

			// Submit review
			const { error: submitError } = await supabase.rpc('rpc_notes_review_submit', {
				p_user_id: user.user_id,
				p_note_id: note.note_id,
				p_correct: isCorrect,
				p_confidence: confidence,
				p_time_ms: timeMs
			});

			if (submitError) throw submitError;

			// If correct, set status to resolved
			// if (isCorrect) {
			// 	await setStatus('resolved');
			// }

			// Store result
			reviewResult = {
				correct: isCorrect,
				correctLabel: correctLabel
			};

			reviewSubmitted = true;

			// Refresh notebook badge
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}

			// Reload note detail to get updated data
			await loadNoteDetail();
		} catch (err) {
			console.error('Error submitting review:', err);
			alert('Failed to submit review');
		} finally {
			isSubmittingReview = false;
		}
	}
</script>

<svelte:head>
	<title>Review Note :: Kaizen</title>
</svelte:head>

<div class="detail-container">
	{#if loading}
		<div class="loading-state">
			<div class="loading-card">
				<div class="spinner-wrapper">
					<div class="spinner"></div>
				</div>
				<p class="loading-text">Loading note details...</p>
			</div>
		</div>
	{:else if error || !note}
		<div class="error-state">
			<div class="error-card">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<p class="error-message">{error || 'Note not found'}</p>
				<a href="/notes" class="modern-button secondary">Back to Queue</a>
			</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="detail-header">
			<a href="/notes" class="back-button">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
				<span>Back to Queue</span>
			</a>
		</div>

		<!-- Main Content -->
		<div class="detail-content">
			<!-- Question Card -->
			<div class="question-card">
				<!-- Topic Hierarchy -->
				{#if note.discipline || note.subject || note.topic}
					<div class="topic-breadcrumb">
						{#if note.discipline}
							<span class="breadcrumb-item discipline">{note.discipline}</span>
							<span class="breadcrumb-separator">›</span>
						{/if}
						{#if note.subject}
							<span class="breadcrumb-item subject">{note.subject}</span>
							<span class="breadcrumb-separator">›</span>
						{/if}
						{#if note.topic}
							<span class="breadcrumb-item topic">{note.topic}</span>
						{/if}
						{#if note.subtopic}
							<span class="breadcrumb-separator">›</span>
							<span class="breadcrumb-item subtopic">{note.subtopic}</span>
						{/if}
					</div>
				{/if}

				<!-- Question Stem -->
				<div class="question-section">
					<h2 class="section-title">Question</h2>
					{#if note.stem}
						<p class="question-stem">{note.stem}</p>
					{:else}
						<p class="question-stem empty">Question content not available</p>
					{/if}
				</div>

				<!-- Choices -->
				{#if note.choices && note.choices.length > 0}
					<div class="choices-section">
						<h3 class="subsection-title">Answer Choices</h3>
						<div class="choices-list">
							{#each note.choices as choice}
								<button
									type="button"
									class="choice-item"
									class:selected={selectedChoice === choice.label}
									class:correct={reviewSubmitted && reviewResult && selectedChoice === choice.label && reviewResult.correct}
									class:incorrect={reviewSubmitted && reviewResult && selectedChoice === choice.label && !reviewResult.correct}
									class:disabled={reviewSubmitted}
									on:click={() => selectChoice(choice.label)}
									disabled={reviewSubmitted}
								>
									<div class="choice-label">{choice.label}</div>
									<div class="choice-text">{choice.text}</div>
									{#if reviewSubmitted && reviewResult && selectedChoice === choice.label && reviewResult.correct}
										<div class="choice-indicator correct-indicator">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<polyline points="20 6 9 17 4 12"></polyline>
											</svg>
										</div>
									{/if}
									{#if reviewSubmitted && reviewResult && selectedChoice === choice.label && !reviewResult.correct}
										<div class="choice-indicator incorrect-indicator">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<line x1="18" y1="6" x2="6" y2="18"></line>
												<line x1="6" y1="6" x2="18" y2="18"></line>
											</svg>
										</div>
									{/if}
								</button>
							{/each}
						</div>

						<!-- Confidence & Submit -->
						{#if selectedChoice && !reviewSubmitted}
							<div class="review-submission">
								<div class="confidence-section">
									<h4 class="confidence-title">How confident are you?</h4>
									<div class="confidence-selector">
										{#each [1, 2, 3, 4, 5] as level}
											<button
												type="button"
												class="confidence-button"
												class:selected={confidence === level}
												on:click={() => (confidence = level)}
											>
												{level}
											</button>
										{/each}
									</div>
									<div class="confidence-labels">
										<span>Not Sure</span>
										<span>Very Sure</span>
									</div>
								</div>

								<button
									type="button"
									class="submit-review-button"
									on:click={submitReview}
									disabled={confidence === null || isSubmittingReview}
								>
									{#if isSubmittingReview}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="spinner-icon"
										>
											<circle cx="12" cy="12" r="10"></circle>
										</svg>
										<span>Submitting...</span>
									{:else}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="9 11 12 14 22 4"></polyline>
											<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
										</svg>
										<span>Submit Answer</span>
									{/if}
								</button>
							</div>
						{/if}

						<!-- Result Display -->
						{#if reviewSubmitted && reviewResult}
							<div class="review-result" class:correct={reviewResult.correct} class:incorrect={!reviewResult.correct}>
								<div class="result-icon">
									{#if reviewResult.correct}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="48"
											height="48"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
											<polyline points="22 4 12 14.01 9 11.01"></polyline>
										</svg>
									{:else}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="48"
											height="48"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<circle cx="12" cy="12" r="10"></circle>
											<line x1="15" y1="9" x2="9" y2="15"></line>
											<line x1="9" y1="9" x2="15" y2="15"></line>
										</svg>
									{/if}
								</div>
								<div class="result-content">
									<h4 class="result-title">
										{#if reviewResult.correct}
											Correct!
										{:else}
											Incorrect
										{/if}
									</h4>
									<p class="result-message">
										{#if reviewResult.correct}
											Great job! You selected the right answer.
										{:else}
											Review the explanation and try again next time.
										{/if}
									</p>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Explanation -->
				{#if note.explanation}
					<div class="explanation-section" style="display: none;">
						<div class="explanation-header">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="10"></circle>
								<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
								<line x1="12" y1="17" x2="12.01" y2="17"></line>
							</svg>
							<span>Explanation</span>
						</div>
						<p class="explanation-text">{note.explanation}</p>
					</div>
				{/if}

				<!-- Comments Section -->
				<div class="sidebar-card comments-card">
					<h3 class="card-title">Notes & Comments</h3>
					<p class="card-description">Add personal insights and reminders</p>

					<!-- Add Comment Form -->
					<div class="add-comment-form">
						<textarea
							class="comment-textarea"
							placeholder="Add a note or comment..."
							bind:value={newCommentBody}
							rows="3"
						></textarea>
						<button
							type="button"
							class="add-comment-button"
							on:click={addComment}
							disabled={!newCommentBody.trim() || isAddingComment}
						>
							{#if isAddingComment}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="spinner-icon"
								>
									<circle cx="12" cy="12" r="10"></circle>
								</svg>
								<span>Adding...</span>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="9 11 12 14 22 4"></polyline>
									<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
								</svg>
								<span>Add Comment</span>
							{/if}
						</button>
					</div>

					<!-- Comments List -->
					{#if comments.length > 0}
						<div class="comments-list">
							{#each comments.filter(c => !c.is_removed) as comment}
								<div class="comment-item">
									{#if editingCommentId === comment.id}
										<!-- Edit Mode -->
										<div class="edit-comment-form">
											<textarea
												class="comment-textarea"
												bind:value={editCommentBody}
												rows="3"
											></textarea>
											<div class="edit-actions">
												<button
													type="button"
													class="edit-action-button save"
													on:click={() => saveEditComment(comment.id)}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<polyline points="9 11 12 14 22 4"></polyline>
														<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
													</svg>
													<span>Save</span>
												</button>
												<button
													type="button"
													class="edit-action-button cancel"
													on:click={cancelEdit}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<line x1="18" y1="6" x2="6" y2="18"></line>
														<line x1="6" y1="6" x2="18" y2="18"></line>
													</svg>
													<span>Cancel</span>
												</button>
											</div>
										</div>
									{:else}
										<!-- View Mode -->
										<div class="comment-header">
											<div class="comment-meta">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path
														d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
												</svg>
												<span class="comment-date">{formatDate(comment.created_at)}</span>
											</div>
											<div class="comment-actions">
												<button
													type="button"
													class="comment-action-button edit"
													on:click={() => startEditComment(comment)}
													title="Edit comment"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
														<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
													</svg>
												</button>
												<button
													type="button"
													class="comment-action-button delete"
													on:click={() => removeComment(comment.id)}
													title="Delete comment"
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<polyline points="3 6 5 6 21 6"></polyline>
														<path
															d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
													</svg>
												</button>
											</div>
										</div>
										<p class="comment-body">{comment.body}</p>
										{#if comment.updated_at !== comment.created_at}
											<span class="comment-edited">(edited)</span>
										{/if}
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="no-comments">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
							</svg>
							<p>No comments yet</p>
						</div>
					{/if}
				</div>

				<!-- Response History -->
				{#if note.all_responses && note.all_responses.length > 0}
					<div class="sidebar-card responses-card"  style="display: none;">
						<h3 class="card-title">Response History</h3>
						<p class="card-description">Your past attempts at this question</p>
						<div class="responses-list">
							{#each note.all_responses as response}
								<div class="response-item" class:correct={response.is_correct} class:incorrect={!response.is_correct}>
									<div class="response-header">
										<div class="response-result">
											{#if response.is_correct}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="3"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
												<span class="result-label">Correct</span>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="3"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<line x1="18" y1="6" x2="6" y2="18"></line>
													<line x1="6" y1="6" x2="18" y2="18"></line>
												</svg>
												<span class="result-label">Incorrect</span>
											{/if}
										</div>
										<div class="response-choice-badge">
											{response.choice_label}
										</div>
									</div>
									<div class="response-details">
										<div class="response-meta">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<circle cx="12" cy="12" r="10"></circle>
												<polyline points="12 6 12 12 16 14"></polyline>
											</svg>
											<span>{(response.response_time_ms / 1000).toFixed(1)}s</span>
										</div>
										<div class="response-date">
											{formatDate(response.created_at)}
										</div>
									</div>
									{#if response.assessment_title}
										<div class="response-assessment">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
												<polyline points="14 2 14 8 20 8"></polyline>
											</svg>
											<span>{response.assessment_title}</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
						{#if note.all_responses.length > 0}
							{@const correct = note.all_responses.filter(r => r.is_correct).length}
							{@const total = note.all_responses.length}
							{@const accuracy = ((correct / total) * 100).toFixed(0)}
							<div class="response-summary">
								<span class="summary-label">Overall Accuracy:</span>
								<span class="summary-value" class:high={Number(accuracy) >= 70}
											class:medium={Number(accuracy) >= 40 && Number(accuracy) < 70} class:low={Number(accuracy) < 40}>
									{accuracy}% ({correct}/{total})
								</span>
							</div>
						{/if}
					</div>
				{/if}

				<div class="metadata-section sidebar-card">
					<div class="metadata-grid">
						{#if note.q_difficulty}
							<div class="metadata-item">
								<span class="meta-label">Difficulty</span>
								<span class="meta-value difficulty {note.q_difficulty}">{note.q_difficulty}</span>
							</div>
						{/if}
						{#if note.q_type}
							<div class="metadata-item">
								<span class="meta-label">Type</span>
								<span class="meta-value">{note.q_type.replace('_', ' ')}</span>
							</div>
						{/if}
						<div class="metadata-item">
							<span class="meta-label">Ease Factor</span>
							<span class="meta-value">{note.ease_factor?.toFixed(2) || 'N/A'}</span>
						</div>
						<div class="metadata-item">
							<span class="meta-label">Interval</span>
							<span class="meta-value">{note.interval_days || 0} days</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Sidebar -->
			<div class="detail-sidebar">
				<!-- Status Card -->
				<div class="sidebar-card status-card">
					<h3 class="card-title">Status</h3>
					<p class="card-description">Change the review status</p>
					<div class="status-selector-wrapper">
						<select
							class="status-select-full"
							value={note.status}
							on:change={(e) => setStatus(e.currentTarget.value)}
							disabled={isUpdatingStatus}
							style="background: {getStatusColor(note.status).bg}; color: {getStatusColor(note.status).text}; border-color: {getStatusColor(note.status).border};"
						>
							<option value="open">Open</option>
							<option value="in_review">In Review</option>
							<option value="resolved">Resolved</option>
							<option value="archived">Archived</option>
						</select>
					</div>

					<div class="review-count">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
							<circle cx="12" cy="12" r="3"></circle>
						</svg>
						<span>Reviewed {note.review_count}x</span>
					</div>
				</div>

				<!-- Rating Card -->
				<div class="sidebar-card rating-card">
					<h3 class="card-title">Difficulty Rating</h3>
					<p class="card-description">Rate how difficult you find this question</p>
					<div class="rating-selector">
						{#each [1, 2, 3, 4, 5] as rating}
							<button
								type="button"
								class="rating-star"
								class:selected={selectedRating && rating <= selectedRating}
								on:click={() => updateRating(rating)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="32"
									height="32"
									viewBox="0 0 24 24"
									fill={selectedRating && rating <= selectedRating ? 'currentColor' : 'none'}
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									></polygon>
								</svg>
							</button>
						{/each}
					</div>
					{#if selectedRating}
						<p class="rating-feedback">
							{#if selectedRating === 1}
								Very Easy
							{:else if selectedRating === 2}
								Easy
							{:else if selectedRating === 3}
								Moderate
							{:else if selectedRating === 4}
								Difficult
							{:else}
								Very Difficult
							{/if}
						</p>
					{/if}
				</div>

				<!-- Snooze Options -->
				<div class="sidebar-card snooze-card">
					<h3 class="card-title">Snooze</h3>
					<p class="card-description">Postpone this review for later</p>
					<div class="snooze-options">
						<button
							type="button"
							class="snooze-option"
							on:click={() => snoozeNote('1 hour')}
							disabled={isSnoozing}
						>
							<span>1 hour</span>
						</button>
						<button
							type="button"
							class="snooze-option"
							on:click={() => snoozeNote('4 hours')}
							disabled={isSnoozing}
						>
							<span>4 hours</span>
						</button>
						<button
							type="button"
							class="snooze-option"
							on:click={() => snoozeNote('1 day')}
							disabled={isSnoozing}
						>
							<span>1 day</span>
						</button>
						<button
							type="button"
							class="snooze-option"
							on:click={() => snoozeNote('3 days')}
							disabled={isSnoozing}
						>
							<span>3 days</span>
						</button>
						<button
							type="button"
							class="snooze-option"
							on:click={() => snoozeNote('1 week')}
							disabled={isSnoozing}
						>
							<span>1 week</span>
						</button>
						<button
							type="button"
							class="snooze-option"
							on:click={() => snoozeNote('2 weeks')}
							disabled={isSnoozing}
						>
							<span>2 weeks</span>
						</button>
					</div>
				</div>

				<!-- Schedule Info -->
				<div class="sidebar-card schedule-card">
					<h3 class="card-title">Schedule Info</h3>
					<div class="schedule-info">
						<div class="info-row">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="10"></circle>
								<polyline points="12 6 12 12 16 14"></polyline>
							</svg>
							<div class="info-content">
								<span class="info-label">Due Date</span>
								<span class="info-value">{formatDate(note.due_at)}</span>
							</div>
						</div>
						<div class="info-row">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
								<polyline points="22 4 12 14.01 9 11.01"></polyline>
							</svg>
							<div class="info-content">
								<span class="info-label">Last Reviewed</span>
								<span class="info-value">{formatDate(note.last_reviewed_at)}</span>
							</div>
						</div>
						{#if note.last_snoozed_at}
							<div class="info-row">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M22 17v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"></path>
									<path d="M6 11V7a6 6 0 0 1 12 0v4"></path>
									<path d="M2 11h20"></path>
								</svg>
								<div class="info-content">
									<span class="info-label">Snoozed ({note.snooze_count}x)</span>
									<span class="info-value">{formatDate(note.last_snoozed_at)}</span>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Events Timeline -->
				{#if note.events && note.events.length > 0}
					<div class="sidebar-card events-card">
						<div class="collapsible-header">
							<h3 class="card-title">Activity ({note.events.length})</h3>
							<button
								type="button"
								class="collapse-toggle"
								on:click={() => (isActivityExpanded = !isActivityExpanded)}
								aria-expanded={isActivityExpanded}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class:rotated={isActivityExpanded}
								>
									<polyline points="6 9 12 15 18 9"></polyline>
								</svg>
							</button>
						</div>
						{#if isActivityExpanded}
							<div class="events-timeline">
								{#each note.events as event}
									<div class="event-item">
										<div class="event-icon">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d={getEventIcon(event.event_type)}></path>
											</svg>
										</div>
										<div class="event-content">
											<span class="event-type">{event.event_type}</span>
											<span class="event-time">{formatDate(event.occurred_at)}</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
    /* Container */
    .detail-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
        padding: 2rem 1rem;
        padding-top: 5rem;
    }

    /* Loading, Error States */
    .loading-state,
    .error-state {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loading-card,
    .error-card {
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
        border-top-color: #a78bfa;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .loading-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #6b7280;
        margin: 0;
    }

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

    .modern-button.secondary {
        background: #ffffff;
        color: #a78bfa;
        border: 2px solid #e5e7eb;
    }

    .modern-button.secondary:hover {
        background: #faf9fc;
        border-color: #a78bfa;
    }

    /* Header */
    .detail-header {
        max-width: 1200px;
        margin: 0 auto 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    }

    .back-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #6b7280;
        text-decoration: none;
        transition: all 0.2s ease;
    }

    .back-button:hover {
        background: #faf9fc;
        border-color: #a78bfa;
        color: #a78bfa;
    }

    /* Status Selector in Sidebar */
    .status-selector-wrapper {
        width: 100%;
    }

    .status-select-full {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 2.5rem 0.75rem 1rem;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        border: 2px solid;
        text-transform: capitalize;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 16px;
        transition: all 0.2s ease;
    }

    .status-select-full:hover:not(:disabled) {
        opacity: 0.8;
        transform: translateY(-1px);
    }

    .status-select-full:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .status-select-full option {
        background: #ffffff;
        color: #374151;
        padding: 0.5rem;
    }

    .review-count {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
    }

    .review-count svg {
        color: #9ca3af;
    }

    /* Content Layout */
    .detail-content {
        max-width: 1200px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 2rem;
        align-items: start;
    }

    /* Question Card */
    .question-card {
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .topic-breadcrumb {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.375rem;
        margin-bottom: 1.5rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
    }

    .breadcrumb-item {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-weight: 600;
    }

    .breadcrumb-item.discipline {
        background: #f3f0ff;
        color: #a78bfa;
    }

    .breadcrumb-item.subject {
        background: #eff6ff;
        color: #5580a0;
    }

    .breadcrumb-item.topic {
        background: #f0fdfa;
        color: #4a7c59;
    }

    .breadcrumb-item.subtopic {
        background: #fef6e8;
        color: #a68950;
    }

    .breadcrumb-separator {
        color: #d1d5db;
        font-weight: 600;
    }

    .section-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 1rem 0;
    }

    .question-stem {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 500;
        color: #111827;
        line-height: 1.7;
        margin: 0;
    }

    .question-stem.empty {
        color: #9ca3af;
        font-style: italic;
    }

    .choices-section {
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid #f3f4f6;
    }

    .subsection-title {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0 0 1rem 0;
    }

    .choices-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .choice-item {
        position: relative;
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: #faf9fc;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        transition: all 0.2s ease;
        cursor: pointer;
        text-align: left;
        width: 100%;
    }

    .choice-item:hover:not(.disabled) {
        border-color: #c4b5fd;
        background: #f3f0ff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(167, 139, 250, 0.15);
    }

    .choice-item.selected {
        background: #f3f0ff;
        border-color: #a78bfa;
        box-shadow: 0 4px 12px rgba(167, 139, 250, 0.25);
    }

    .choice-item.correct {
        background: #e8f5ee;
        border-color: #4a7c59;
        border-width: 3px;
    }

    .choice-item.incorrect {
        background: #fce8e8;
        border-color: #9c5555;
        border-width: 3px;
    }

    .choice-item.disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    .choice-label {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #c4b5fd, #a78bfa);
        color: #ffffff;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 700;
        flex-shrink: 0;
    }

    .choice-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #374151;
        line-height: 1.6;
        flex: 1;
    }

    .choice-indicator {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .choice-indicator.correct-indicator {
        background: #4a7c59;
        color: white;
    }

    .choice-indicator.incorrect-indicator {
        background: #9c5555;
        color: white;
    }

    /* Review Submission */
    .review-submission {
        margin-top: 2rem;
        padding: 2rem;
        background: #ffffff;
        border: 2px solid #e9d5ff;
        border-radius: 12px;
    }

    .confidence-section {
        margin-bottom: 1.5rem;
    }

    .confidence-title {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 1rem 0;
        text-align: center;
    }

    .confidence-selector {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .confidence-button {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #faf9fc;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 700;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .confidence-button:hover {
        background: #f3f0ff;
        border-color: #c4b5fd;
        color: #a78bfa;
        transform: translateY(-2px);
    }

    .confidence-button.selected {
        background: linear-gradient(135deg, #c4b5fd, #a78bfa);
        border-color: #a78bfa;
        color: white;
        box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
    }

    .confidence-labels {
        display: flex;
        justify-content: space-between;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
        font-weight: 500;
        padding: 0 0.25rem;
    }

    .submit-review-button {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem;
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        background: linear-gradient(135deg, #a78bfa, #8b5cf6);
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 16px rgba(167, 139, 250, 0.3);
    }

    .submit-review-button:hover:not(:disabled) {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        box-shadow: 0 6px 20px rgba(167, 139, 250, 0.4);
        transform: translateY(-2px);
    }

    .submit-review-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    /* Review Result */
    .review-result {
        margin-top: 2rem;
        padding: 2rem;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        border: 3px solid;
    }

    .review-result.correct {
        background: #e8f5ee;
        border-color: #4a7c59;
    }

    .review-result.incorrect {
        background: #fce8e8;
        border-color: #9c5555;
    }

    .result-icon {
        flex-shrink: 0;
    }

    .review-result.correct .result-icon {
        color: #4a7c59;
    }

    .review-result.incorrect .result-icon {
        color: #9c5555;
    }

    .result-content {
        flex: 1;
    }

    .result-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 0.5rem 0;
    }

    .review-result.correct .result-title {
        color: #4a7c59;
    }

    .review-result.incorrect .result-title {
        color: #9c5555;
    }

    .result-message {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #374151;
        margin: 0;
        line-height: 1.6;
    }

    .result-message strong {
        font-weight: 700;
        color: #111827;
    }

    .explanation-section {
        margin-top: 2rem;
        padding: 1.5rem;
        background: #f3f0ff;
        border: 2px solid #e9d5ff;
        border-radius: 12px;
    }

    .explanation-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 700;
        color: #a78bfa;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .explanation-header svg {
        color: #a78bfa;
    }

    .explanation-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #374151;
        line-height: 1.7;
        margin: 0;
    }

    .metadata-section {
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid #f3f4f6;
    }

    .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
    }

    .metadata-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .meta-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .meta-value {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        color: #111827;
        text-transform: capitalize;
    }

    .meta-value.difficulty {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 6px;
        font-size: 0.875rem;
        width: fit-content;
    }

    .meta-value.difficulty.easy {
        background: #e8f5ee;
        color: #4a7c59;
    }

    .meta-value.difficulty.medium {
        background: #fef6e8;
        color: #a68950;
    }

    .meta-value.difficulty.hard {
        background: #fce8e8;
        color: #9c5555;
    }

    /* Sidebar */
    .detail-sidebar {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .sidebar-card {
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .card-title {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.5rem 0;
    }

    .collapsible-header .card-title {
        margin: 0;
    }

    .card-description {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6b7280;
        margin: 0 0 1.25rem 0;
    }

    /* Rating Card */
    .rating-selector {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
    }

    .rating-star {
        background: none;
        border: none;
        cursor: pointer;
        color: #d1d5db;
        transition: all 0.2s ease;
        padding: 0;
    }

    .rating-star:hover,
    .rating-star.selected {
        color: #f5d89e;
        transform: scale(1.1);
    }

    .rating-feedback {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #a78bfa;
        text-align: center;
        margin: 1rem 0 0 0;
    }

    /* Snooze Card */
    .snooze-options {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .snooze-option {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        background: #f3f0ff;
        color: #a78bfa;
        border: 2px solid #e9d5ff;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .snooze-option:hover:not(:disabled) {
        background: #e9d5ff;
        border-color: #c4b5fd;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(167, 139, 250, 0.2);
    }

    .snooze-option:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    /* Schedule Card */
    .schedule-info {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .info-row {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .info-row svg {
        color: #a78bfa;
        flex-shrink: 0;
        margin-top: 0.125rem;
    }

    .info-content {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        flex: 1;
    }

    .info-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .info-value {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    /* Response History */
    .responses-card {
        margin-top: 2rem;
    }

    .responses-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .response-item {
        padding: 1rem;
        border: 2px solid;
        border-radius: 10px;
        transition: all 0.2s ease;
    }

    .response-item.correct {
        background: #e8f5ee;
        border-color: #a0d4b5;
    }

    .response-item.incorrect {
        background: #fce8e8;
        border-color: #e8a0a0;
    }

    .response-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .response-result {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
    }

    .response-item.correct .response-result {
        color: #4a7c59;
    }

    .response-item.incorrect .response-result {
        color: #9c5555;
    }

    .result-label {
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    .response-choice-badge {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #c4b5fd, #a78bfa);
        color: #ffffff;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 700;
        flex-shrink: 0;
    }

    .response-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .response-meta {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 500;
    }

    .response-meta svg {
        color: #9ca3af;
    }

    .response-date {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .response-assessment {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #6b7280;
        padding: 0.375rem 0.625rem;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 6px;
    }

    .response-assessment svg {
        color: #a78bfa;
        flex-shrink: 0;
    }

    .response-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: #f3f0ff;
        border: 2px solid #e9d5ff;
        border-radius: 8px;
    }

    .summary-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
    }

    .summary-value {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 700;
    }

    .summary-value.high {
        color: #4a7c59;
    }

    .summary-value.medium {
        color: #a68950;
    }

    .summary-value.low {
        color: #9c5555;
    }

    /* Comments Section */
    .add-comment-form {
        margin-bottom: 1.5rem;
    }

    .comment-textarea {
        width: 100%;
        padding: 0.75rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #374151;
        background: #faf9fc;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        resize: vertical;
        transition: all 0.2s ease;
        margin-bottom: 0.75rem;
    }

    .comment-textarea:focus {
        outline: none;
        border-color: #a78bfa;
        background: #ffffff;
    }

    .add-comment-button {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        background: linear-gradient(90deg, #c4b5fd, #a78bfa);
        color: #ffffff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(167, 139, 250, 0.3);
    }

    .add-comment-button:hover:not(:disabled) {
        background: linear-gradient(90deg, #a78bfa, #8b5cf6);
        box-shadow: 0 4px 12px rgba(167, 139, 250, 0.4);
        transform: translateY(-1px);
    }

    .add-comment-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .spinner-icon {
        animation: spin 0.8s linear infinite;
    }

    .comments-card {
        margin-top: 2rem;
    }

    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .comment-item {
        padding: 1rem;
        background: #faf9fc;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        transition: all 0.2s ease;
    }

    .comment-item:hover {
        border-color: #c4b5fd;
    }

    .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
    }

    .comment-meta {
        display: flex;
        align-items: center;
        gap: 0.375rem;
    }

    .comment-meta svg {
        color: #a78bfa;
        flex-shrink: 0;
    }

    .comment-date {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
        font-weight: 500;
    }

    .comment-actions {
        display: flex;
        align-items: center;
        gap: 0.375rem;
    }

    .comment-action-button {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #9ca3af;
    }

    .comment-action-button:hover {
        background: #e5e7eb;
    }

    .comment-action-button.edit:hover {
        color: #a78bfa;
        background: #f3f0ff;
    }

    .comment-action-button.delete:hover {
        color: #ef4444;
        background: #fef2f2;
    }

    .comment-body {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #374151;
        line-height: 1.6;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .comment-edited {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
        font-style: italic;
        margin-top: 0.5rem;
        display: block;
    }

    .edit-comment-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .edit-actions {
        display: flex;
        gap: 0.5rem;
    }

    .edit-action-button {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.625rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 600;
        border: 2px solid;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .edit-action-button.save {
        background: #e8f5ee;
        border-color: #a0d4b5;
        color: #4a7c59;
    }

    .edit-action-button.save:hover {
        background: #d0ede0;
        border-color: #80c0a0;
    }

    .edit-action-button.cancel {
        background: #fce8e8;
        border-color: #e8a0a0;
        color: #9c5555;
    }

    .edit-action-button.cancel:hover {
        background: #f8d0d0;
        border-color: #e08080;
    }

    .no-comments {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        text-align: center;
    }

    .no-comments svg {
        color: #c4b5fd;
        opacity: 0.4;
        margin-bottom: 0.75rem;
    }

    .no-comments p {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #9ca3af;
        margin: 0;
    }

    /* Collapsible Header */
    .collapsible-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .collapse-toggle {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #9ca3af;
    }

    .collapse-toggle:hover {
        background: #f3f0ff;
        color: #a78bfa;
    }

    .collapse-toggle svg {
        transition: transform 0.2s ease;
    }

    .collapse-toggle svg.rotated {
        transform: rotate(180deg);
    }

    /* Events Timeline */
    .events-timeline {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
    }

    .event-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }

    .event-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f0ff;
        border: 2px solid #e9d5ff;
        border-radius: 6px;
        color: #a78bfa;
        flex-shrink: 0;
    }

    .event-content {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        flex: 1;
    }

    .event-type {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        text-transform: capitalize;
    }

    .event-time {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    /* Mobile Responsiveness */
    @media (max-width: 968px) {
        .detail-content {
            grid-template-columns: 1fr;
        }

        .question-card {
						margin: 0;
            order: -1;
        }
    }

    @media (max-width: 768px) {
        .detail-container {
            padding: 1rem 0.75rem;
            padding-top: 3rem;
        }

        .detail-header {
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 1rem;
        }

        .question-card,
        .sidebar-card {
            padding: 1.25rem;
        }

        .metadata-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>
