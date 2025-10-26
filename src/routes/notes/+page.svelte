<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';

	let loading = true;
	let error: string | null = null;
	let notes: any[] = [];
	let user: any;
	userStore.subscribe((v) => (user = v));

	async function loadSmartQueue() {
		try {
			loading = true;
			error = null;
			const result = await supabase.rpc('rpc_notes_my_smart_queue', {
				p_user_id: user.user_id
			});

			if (result.error) {
				error = result.error.message;
			} else {
				notes = result.data || [];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		loadSmartQueue();
	});

	function getBucketColor(bucket: string) {
		switch (bucket) {
			case 'overdue':
				return { bg: '#fce8e8', border: '#e8a0a0', text: '#9c5555' };
			case 'due_today':
				return { bg: '#fef6e8', border: '#f5d89e', text: '#a68950' };
			case 'upcoming':
				return { bg: '#e8f3fc', border: '#a0c8e8', text: '#5580a0' };
			default:
				return { bg: '#f3f4f6', border: '#c8ccd3', text: '#6b7280' };
		}
	}

	function getBucketLabel(bucket: string) {
		switch (bucket) {
			case 'overdue':
				return 'Overdue';
			case 'due_today':
				return 'Due Today';
			case 'upcoming':
				return 'Upcoming';
			default:
				return 'Scheduled';
		}
	}

	function formatDueDate(dueAt: string | null, daysUntilDue: number | null): string {
		if (!dueAt) return 'Not scheduled';
		if (daysUntilDue === null) return 'Not scheduled';
		if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
		if (daysUntilDue === 0) return 'Due today';
		if (daysUntilDue === 1) return 'Due tomorrow';
		return `Due in ${daysUntilDue} days`;
	}

	function getRatingStars(rating: number) {
		return Array.from({ length: 5 }, (_, i) => i < rating);
	}

	// Group notes by bucket
	$: groupedNotes = notes.reduce((acc, note) => {
		const bucket = note.bucket || 'upcoming';
		if (!acc[bucket]) acc[bucket] = [];
		acc[bucket].push(note);
		return acc;
	}, {} as Record<string, any[]>);

	$: bucketOrder = ['overdue', 'due_today', 'upcoming'];
	$: sortedBuckets = bucketOrder.filter(bucket => groupedNotes[bucket]?.length > 0);
</script>

<svelte:head>
	<title>Smart Review Queue :: Kaizen</title>
</svelte:head>

<div class="notes-container">
	{#if loading}
		<div class="loading-state">
			<div class="loading-card">
				<div class="spinner-wrapper">
					<div class="spinner"></div>
				</div>
				<p class="loading-text">Loading your smart review queue...</p>
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
	{:else if notes.length === 0}
		<div class="empty-state">
			<div class="empty-card">
				<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 18h6" />
					<path d="M10 22h4" />
					<path d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" fill="none" />
				</svg>
				<h2>Your Review Queue is Empty</h2>
				<p class="empty-message">You don't have any notes scheduled for review right now.</p>
				<p class="empty-hint">Flag questions during assessments or on results pages to add them here.</p>
				<a href="/dashboard" class="modern-button primary">Go to Dashboard</a>
			</div>
		</div>
	{:else}
		<!-- Header with Summary -->
		<div class="queue-header">
			<div class="header-content">
				<div class="header-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 18h6" />
						<path d="M10 22h4" />
						<path d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" />
					</svg>
				</div>
				<div class="header-text">
					<h1>Smart Review Queue</h1>
					<p>{notes.length} {notes.length === 1 ? 'item' : 'items'} in your queue</p>
				</div>
			</div>

			<!-- Bucket Summary -->
			<div class="bucket-summary">
				{#if groupedNotes['overdue']?.length > 0}
					<div class="bucket-chip overdue">
						<span class="chip-count">{groupedNotes['overdue'].length}</span>
						<span class="chip-label">Overdue</span>
					</div>
				{/if}
				{#if groupedNotes['due_today']?.length > 0}
					<div class="bucket-chip due-today">
						<span class="chip-count">{groupedNotes['due_today'].length}</span>
						<span class="chip-label">Due Today</span>
					</div>
				{/if}
				{#if groupedNotes['upcoming']?.length > 0}
					<div class="bucket-chip upcoming">
						<span class="chip-count">{groupedNotes['upcoming'].length}</span>
						<span class="chip-label">Upcoming</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Notes grouped by bucket -->
		{#each sortedBuckets as bucket}
			{@const bucketNotes = groupedNotes[bucket]}
			{@const color = getBucketColor(bucket)}
			<div class="bucket-section">
				<div class="bucket-header" style="border-left: 4px solid {color.border};">
					<h2>{getBucketLabel(bucket)}</h2>
					<span class="bucket-count">{bucketNotes.length}</span>
				</div>

				<div class="notes-grid">
					{#each bucketNotes as note, i}
						<div class="note-card" style="border-top: 3px solid {color.border};">
							<!-- Priority Badge -->
							<div class="card-header">
								<div class="priority-badge">
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
									</svg>
									<span>#{note.priority_rank}</span>
								</div>

								<div class="status-badge" style="background: {color.bg}; color: {color.text}; border-color: {color.border};">
									{getBucketLabel(bucket)}
								</div>
							</div>

							<!-- Question Content -->
							<div class="note-content" on:click={() => goto(`/notes/detail/${note.note_id}`)}>
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
								{#if note.stem}
									<p class="question-stem">{note.stem}</p>
								{:else}
									<p class="question-stem empty">Question content not available</p>
								{/if}

								<!-- Last Response Info -->
								{#if note.last_answered_at}
									<div class="last-response">
										<div class="response-indicator {note.last_is_correct ? 'correct' : 'incorrect'}">
											{#if note.last_is_correct}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
												<span>Answered Correctly</span>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
													<line x1="18" y1="6" x2="6" y2="18"></line>
													<line x1="6" y1="6" x2="18" y2="18"></line>
												</svg>
												<span>Answered Incorrectly</span>
											{/if}
										</div>
										{#if note.last_choice_label}
											<span class="response-choice">Choice {note.last_choice_label}</span>
										{/if}
									</div>
								{/if}
							</div>

							<!-- Note Metadata -->
							<div class="note-meta" on:click={() => goto(`/notes/detail/${note.note_id}`)}>
								<div class="meta-row">
									<div class="meta-item">
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<circle cx="12" cy="12" r="10"></circle>
											<polyline points="12 6 12 12 16 14"></polyline>
										</svg>
										<span>{formatDueDate(note.due_at, note.days_until_due)}</span>
									</div>
									<div class="meta-item">
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
											<circle cx="12" cy="12" r="3"></circle>
										</svg>
										<span>Reviewed {note.review_count}x</span>
									</div>
								</div>

								<!-- Difficulty Rating -->
								{#if note.rating}
									<div class="rating-display">
										<span class="rating-label">Difficulty:</span>
										<div class="stars">
											{#each getRatingStars(note.rating) as filled}
												<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
													<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
												</svg>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Spaced Repetition Info -->
								<div class="sr-info">
									<span class="sr-label">Ease Factor:</span>
									<span class="sr-value">{note.ease_factor?.toFixed(2) || 'N/A'}</span>
									<span class="sr-separator">•</span>
									<span class="sr-label">Interval:</span>
									<span class="sr-value">{note.interval_days || 0} days</span>
								</div>
							</div>

							<!-- Action Buttons -->
							<div class="note-actions">
								<a href="/notes/detail/{note.note_id}" class="action-button primary">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="9 11 12 14 22 4"></polyline>
										<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
									</svg>
									<span>Review Now</span>
								</a>
								<button class="action-button secondary" type="button">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="10"></circle>
										<polyline points="12 6 12 12 16 14"></polyline>
									</svg>
									<span>Snooze</span>
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	/* Container */
	.notes-container {
		min-height: 100vh;
		background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
		padding: 2rem 1rem;
	}

	/* Loading, Error, Empty States */
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

	.empty-card svg {
		color: #c4b5fd;
		margin-bottom: 1.5rem;
		opacity: 0.6;
	}

	.empty-card h2 {
		font-family: 'Inter', sans-serif;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.75rem 0;
	}

	.empty-message {
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		color: #6b7280;
		margin: 0 0 0.5rem 0;
	}

	.empty-hint {
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		color: #9ca3af;
		margin: 0 0 2rem 0;
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

	/* Queue Header */
	.queue-header {
		background: #ffffff;
		border-radius: 16px;
		padding: 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		max-width: 1200px;
		margin-left: auto;
		margin-right: auto;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.header-icon {
		width: 64px;
		height: 64px;
		background: linear-gradient(135deg, #c4b5fd, #a78bfa);
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
	}

	.header-text h1 {
		font-family: 'Inter', sans-serif;
		font-size: 1.75rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.25rem 0;
	}

	.header-text p {
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}

	/* Bucket Summary Chips */
	.bucket-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.bucket-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-family: 'Inter', sans-serif;
		font-weight: 600;
		border: 2px solid;
	}

	.bucket-chip.overdue {
		background: #fce8e8;
		border-color: #e8a0a0;
		color: #9c5555;
	}

	.bucket-chip.due-today {
		background: #fef6e8;
		border-color: #f5d89e;
		color: #a68950;
	}

	.bucket-chip.upcoming {
		background: #e8f3fc;
		border-color: #a0c8e8;
		color: #5580a0;
	}

	.chip-count {
		font-size: 1.125rem;
		font-weight: 700;
	}

	.chip-label {
		font-size: 0.875rem;
	}

	/* Bucket Section */
	.bucket-section {
		max-width: 1200px;
		margin: 0 auto 2.5rem;
	}

	.bucket-header {
		background: #ffffff;
		border-radius: 12px;
		padding: 1rem 1.5rem;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.bucket-header h2 {
		font-family: 'Inter', sans-serif;
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
		margin: 0;
	}

	.bucket-count {
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: #6b7280;
		background: #f3f4f6;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
	}

	/* Notes Grid */
	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
		gap: 1.5rem;
	}

	/* Note Card */
	.note-card {
		background: #ffffff;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		padding: 1.5rem;
		transition: all 0.3s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.note-card:hover {
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
		transform: translateY(-4px);
	}

	/* Card Header */
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.priority-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: linear-gradient(135deg, #c4b5fd, #a78bfa);
		color: #ffffff;
		border-radius: 6px;
		font-family: 'Inter', sans-serif;
		font-size: 0.8125rem;
		font-weight: 700;
		box-shadow: 0 2px 6px rgba(167, 139, 250, 0.3);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		font-family: 'Inter', sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		border: 2px solid;
	}

	/* Note Content */
	.note-content {
		margin-bottom: 1rem;
		cursor: pointer;
	}

	.topic-breadcrumb {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.75rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.75rem;
	}

	.breadcrumb-item {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
	}

	.breadcrumb-item.discipline {
		background: #faf9fc;
		color: #8b5cf6;
	}

	.breadcrumb-item.subject {
		background: #eff6ff;
		color: #1e40af;
	}

	.breadcrumb-item.topic {
		background: #f0fdfa;
		color: #115e59;
	}

	.breadcrumb-item.subtopic {
		background: #fef3c7;
		color: #92400e;
	}

	.breadcrumb-separator {
		color: #d1d5db;
		font-weight: 600;
	}

	.question-stem {
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		font-weight: 500;
		color: #111827;
		line-height: 1.6;
		margin: 0 0 1rem 0;
	}

	.question-stem.empty {
		color: #9ca3af;
		font-style: italic;
	}

	/* Last Response */
	.last-response {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.response-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		font-family: 'Inter', sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.response-indicator.correct {
		background: #e8f5ee;
		color: #4a7c59;
	}

	.response-indicator.incorrect {
		background: #fce8e8;
		color: #9c5555;
	}

	.response-choice {
		font-family: 'Inter', sans-serif;
		font-size: 0.8125rem;
		color: #6b7280;
		font-weight: 600;
	}

	/* Note Metadata */
	.note-meta {
		padding-top: 1rem;
		border-top: 1px solid #f3f4f6;
		margin-bottom: 1rem;
		cursor: pointer;
	}

	.meta-row {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.meta-item {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.meta-item svg {
		color: #9ca3af;
		flex-shrink: 0;
	}

	.rating-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.rating-label {
		font-family: 'Inter', sans-serif;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #6b7280;
	}

	.stars {
		display: flex;
		gap: 0.125rem;
		color: #f5d89e;
	}

	.sr-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.75rem;
	}

	.sr-label {
		color: #9ca3af;
		font-weight: 500;
	}

	.sr-value {
		color: #4b5563;
		font-weight: 600;
	}

	.sr-separator {
		color: #d1d5db;
	}

	/* Action Buttons */
	.note-actions {
		display: flex;
		gap: 0.75rem;
	}

	.action-button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-button.primary {
		background: linear-gradient(90deg, #c4b5fd, #a78bfa);
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(167, 139, 250, 0.3);
		text-decoration: none;
	}

	.action-button.primary:hover {
		background: linear-gradient(90deg, #a78bfa, #8b5cf6);
		box-shadow: 0 4px 12px rgba(167, 139, 250, 0.4);
		transform: translateY(-2px);
	}

	.action-button.secondary {
		background: #ffffff;
		color: #6b7280;
		border: 2px solid #e5e7eb;
	}

	.action-button.secondary:hover {
		background: #f9fafb;
		border-color: #d1d5db;
	}

	/* Mobile Responsiveness */
	@media (max-width: 768px) {
		.notes-container {
			padding: 1rem 0.75rem;
		}

		.queue-header {
			padding: 1.5rem;
		}

		.header-content {
			flex-direction: column;
			align-items: flex-start;
		}

		.header-icon {
			width: 56px;
			height: 56px;
		}

		.header-text h1 {
			font-size: 1.5rem;
		}

		.bucket-summary {
			gap: 0.75rem;
		}

		.bucket-chip {
			padding: 0.375rem 0.75rem;
		}

		.chip-count {
			font-size: 1rem;
		}

		.notes-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.note-card {
			padding: 1.25rem;
		}

		.action-button {
			font-size: 0.8125rem;
			padding: 0.625rem 0.875rem;
		}
	}
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>
