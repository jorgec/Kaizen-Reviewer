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
	let isSubmitting = false;
	let newCommentBody = '';
	let isAddingComment = false;
	let editingCommentId: number | null = null;
	let editCommentBody = '';
	let comments: any[] = [];

	userStore.subscribe((v) => (user = v));

	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		await loadNoteDetail();
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

	async function submitReview(performance: 'again' | 'hard' | 'good' | 'easy') {
		if (!user?.user_id || isSubmitting) return;

		isSubmitting = true;
		try {
			// Call review RPC here when available
			// For now, just navigate back
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Update notebook badge
			if (user?.currentOrg?.org_id) {
				await notebookStore.refresh(user.user_id, user.currentOrg.org_id);
			}

			goto('/notes');
		} catch (err) {
			console.error('Error submitting review:', err);
			alert('Failed to submit review');
		} finally {
			isSubmitting = false;
		}
	}

	async function updateRating(rating: number) {
		if (!user?.user_id || !note?.note_id) return;

		selectedRating = rating;

		try {
			// Call update rating RPC here when available
			console.log('Updating rating to:', rating);
		} catch (err) {
			console.error('Error updating rating:', err);
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

			<div class="header-meta">
				<div class="status-badge" style="background: {getStatusColor(note.status).bg}; color: {getStatusColor(note.status).text}; border-color: {getStatusColor(note.status).border};">
					{note.status}
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
								<div class="choice-item">
									<div class="choice-label">{choice.label}</div>
									<div class="choice-text">{choice.text}</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Explanation -->
				{#if note.explanation}
					<div class="explanation-section">
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
													<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
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
														<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
								<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
							</svg>
							<p>No comments yet</p>
						</div>
					{/if}
				</div>

				<!-- Metadata -->
			</div>

			<!-- Sidebar -->
			<div class="detail-sidebar">
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

				<!-- Review Actions -->
				<div class="sidebar-card review-card">
					<h3 class="card-title">How did you do?</h3>
					<p class="card-description">Select your performance to schedule the next review</p>
					<div class="review-buttons">
						<button
							type="button"
							class="review-button again"
							on:click={() => submitReview('again')}
							disabled={isSubmitting}
						>
							<span class="button-label">Again</span>
							<span class="button-hint">&lt;10m</span>
						</button>
						<button
							type="button"
							class="review-button hard"
							on:click={() => submitReview('hard')}
							disabled={isSubmitting}
						>
							<span class="button-label">Hard</span>
							<span class="button-hint">3d</span>
						</button>
						<button
							type="button"
							class="review-button good"
							on:click={() => submitReview('good')}
							disabled={isSubmitting}
						>
							<span class="button-label">Good</span>
							<span class="button-hint">7d</span>
						</button>
						<button
							type="button"
							class="review-button easy"
							on:click={() => submitReview('easy')}
							disabled={isSubmitting}
						>
							<span class="button-label">Easy</span>
							<span class="button-hint">14d</span>
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

				<!-- Response History -->
				{#if note.all_responses && note.all_responses.length > 0}
					<div class="sidebar-card responses-card">
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
								<span class="summary-value" class:high={Number(accuracy) >= 70} class:medium={Number(accuracy) >= 40 && Number(accuracy) < 70} class:low={Number(accuracy) < 40}>
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

				<!-- Events Timeline -->
				{#if note.events && note.events.length > 0}
					<div class="sidebar-card events-card">
						<h3 class="card-title">Activity</h3>
						<div class="events-timeline">
							{#each note.events.slice(0, 5) as event}
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

	.header-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		border: 2px solid;
		text-transform: capitalize;
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
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: #faf9fc;
		border: 2px solid #e5e7eb;
		border-radius: 10px;
		transition: all 0.2s ease;
	}

	.choice-item:hover {
		border-color: #c4b5fd;
		background: #f3f0ff;
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

	/* Review Card */
	.review-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.review-button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border: 2px solid;
		border-radius: 10px;
		font-family: 'Inter', sans-serif;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.review-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button-label {
		font-size: 1rem;
	}

	.button-hint {
		font-size: 0.8125rem;
		opacity: 0.7;
	}

	.review-button.again {
		background: #fce8e8;
		border-color: #e8a0a0;
		color: #9c5555;
	}

	.review-button.again:hover:not(:disabled) {
		background: #f8d0d0;
		border-color: #e08080;
		transform: translateX(4px);
	}

	.review-button.hard {
		background: #fef6e8;
		border-color: #f5d89e;
		color: #a68950;
	}

	.review-button.hard:hover:not(:disabled) {
		background: #fef0d0;
		border-color: #f0c070;
		transform: translateX(4px);
	}

	.review-button.good {
		background: #e8f3fc;
		border-color: #a0c8e8;
		color: #5580a0;
	}

	.review-button.good:hover:not(:disabled) {
		background: #d0e8f8;
		border-color: #80b0d8;
		transform: translateX(4px);
	}

	.review-button.easy {
		background: #e8f5ee;
		border-color: #a0d4b5;
		color: #4a7c59;
	}

	.review-button.easy:hover:not(:disabled) {
		background: #d0ede0;
		border-color: #80c0a0;
		transform: translateX(4px);
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

	.comments-card{
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

	/* Events Timeline */
	.events-timeline {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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

		.detail-sidebar {
			order: -1;
		}
	}

	@media (max-width: 768px) {
		.detail-container {
			padding: 1rem 0.75rem;
		}

		.detail-header {
			flex-direction: column;
			align-items: flex-start;
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
