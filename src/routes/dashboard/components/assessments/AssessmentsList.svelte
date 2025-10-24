<script lang="ts">
	import type {
		AssessmentCard,
		AssessmentsSortKey,
		SortDir,
		AssessmentType,
		TypeLabels
	} from './types';
	import { filterByType, sortAssessments, getMasteryColor } from './utils';
	import { formatHuman } from '$lib/datetime';

	export let currentDiscipline: { discipline_id: number; discipline_name: string } | null = null;
	let restrictActiveToDiscipline = false;
	let restrictCompletedToDiscipline = false;

	// Data and state (all owned by the parent, passed down)
	export let loading = false;
	export let error: string | null = null;

	export let activeAssessments: AssessmentCard[] = [];
	export let completedAssessments: AssessmentCard[] = [];

	export let activeSortBy: AssessmentsSortKey = 'date';
	export let activeSortDir: SortDir = 'desc';
	export let completedSortBy: AssessmentsSortKey = 'date';
	export let completedSortDir: SortDir = 'desc';

	export let activeTypeFilters: Set<AssessmentType>;
	export let completedTypeFilters: Set<AssessmentType>;
	export let typeLabels: TypeLabels;

	export let activeShowCount = 9;
	export let completedShowCount = 9;

	// Callbacks supplied by parent (no data fetching in this component)
	export let onToggleSort: (section: 'active' | 'completed') => void;
	export let onToggleTypeFilter: (type: AssessmentType, section: 'active' | 'completed') => void;
	export let onShowMoreActive: () => void;
	export let onShowMoreCompleted: () => void;
	export let onRetakeMockExam: (instanceId: string, e: Event) => void;

	// Helper function to format score
	function formatScore(score: number | undefined | null): string {
		if (score === undefined || score === null) return '';
		if (Number.isInteger(score)) return score.toString();
		return Math.ceil(score * 100) / 100 + '';
	}

	// Derived
	$: filteredActive = filterByType(activeAssessments, activeTypeFilters);
	$: filteredCompleted = filterByType(completedAssessments, completedTypeFilters);

	// Discipline restriction filters
	$: disciplineFilteredActive = restrictActiveToDiscipline && currentDiscipline
		? filteredActive.filter(
			(a) => a.settings?.discipline?.id === currentDiscipline.discipline_id
		)
		: filteredActive;

	$: disciplineFilteredCompleted = restrictCompletedToDiscipline && currentDiscipline
		? filteredCompleted.filter(
			(a) => a.settings?.discipline?.id === currentDiscipline.discipline_id
		)
		: filteredCompleted;

	// Sorting logic remains the same, but now use disciplineFiltered*
	$: sortedActive = sortAssessments(disciplineFilteredActive, activeSortBy, activeSortDir).slice(0, activeShowCount);
	$: sortedCompleted = sortAssessments(disciplineFilteredCompleted, completedSortBy, completedSortDir).slice(0, completedShowCount);
</script>

{#if loading}
	<p>Loading your assessments...</p>
{:else if error}
	<p class="has-text-danger">{error}</p>
{:else}
	<!-- Active -->
	<div class="modern-section-header mt-5 mb-3">
		<h3 class="section-title">Active Assessments</h3>

		<div class="modern-sort-controls">
			<label for="active-sort-select" class="is-sr-only">Sort Active Assessments</label>
			<select id="active-sort-select" bind:value={activeSortBy} class="modern-select-small" aria-label="Sort active">
				<option value="date">By Date</option>
				<option value="title">By Title</option>
				<option value="type">By Type</option>
				<option value="score">By Score</option>
			</select>

			<button class="modern-sort-button" type="button" aria-label="Toggle sort direction" on:click={() => onToggleSort('active')}>
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
					class:rotated={activeSortDir === 'asc'}
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</button>
		</div>
	</div>

	<div class="modern-filters mb-3">
		{#each Object.entries(typeLabels) as [type, label]}
			<label class="modern-checkbox">
				<input
					type="checkbox"
					checked={activeTypeFilters.has(type as AssessmentType)}
					on:change={() => onToggleTypeFilter(type as AssessmentType, 'active')}
				/>
				<span class="checkbox-text">{label}</span>
			</label>
		{/each}
		<label class="modern-checkbox discipline-filter">
			<input
				type="checkbox"
				bind:checked={restrictActiveToDiscipline}
			/>
			<span class="checkbox-text">Restrict to Discipline</span>
		</label>
	</div>

	{#if sortedActive.length === 0}
		<p class="empty-state">No active assessments.</p>
	{:else}
		<div class="modern-grid">
			{#each sortedActive as a (a.instance_id)}
				<a href={`/assessment/${a.instance_id}`} class="modern-card active-card">
					<div class="card-header-row">
						<div class="card-type-badge {a.type}">
							{#if a.type === 'prompt'}
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
									<polyline points="14 2 14 8 20 8"></polyline>
								</svg>
							{:else if a.type === 'short'}
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
									<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
								</svg>
							{:else if a.type === 'adaptive'}
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
								</svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
									<polyline points="22 4 12 14.01 9 11.01"></polyline>
								</svg>
							{/if}
							<span>{a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : 'Assessment'}</span>
						</div>
						{#if a.total_items}
							<div class="progress-circle">
								<svg width="36" height="36" viewBox="0 0 36 36">
									<circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" stroke-width="3"></circle>
									<circle cx="18" cy="18" r="16" fill="none" stroke="url(#progress-gradient)" stroke-width="3"
										stroke-dasharray="{a.progress} 100" stroke-linecap="round" transform="rotate(-90 18 18)"></circle>
									<defs>
										<linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
											<stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
											<stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
										</linearGradient>
									</defs>
								</svg>
								<span class="progress-text">{a.progress}%</span>
							</div>
						{/if}
					</div>

					<h3 class="card-title">{a.title}</h3>
					{#if a.description}
						<p class="card-description">{a.description}</p>
					{/if}

					<div class="card-meta">
						{#if a.total_items}
							<div class="meta-item">
								<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
									<polyline points="22 4 12 14.01 9 11.01"></polyline>
								</svg>
								<span>{a.answered_items || 0}/{a.total_items}</span>
							</div>
						{/if}
						{#if a.score !== undefined && a.score !== null}
							<div class="meta-item">
								<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
								</svg>
								<span>{formatScore(a.score)}%</span>
							</div>
						{/if}
						{#if a.settings?.discipline?.name}
							<div class="meta-item">
								<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
									<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
								</svg>
								<span>{a.settings.discipline.name}</span>
							</div>
						{/if}
					</div>

					<div class="card-footer-meta">
						<span class="footer-date">{formatHuman(a.assigned_at, { timeZone: 'Asia/Manila' })}</span>
						{#if a.last_activity_at}
							<span class="footer-activity">Last: {formatHuman(a.last_activity_at, { timeZone: 'Asia/Manila' })}</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>

		{#if filteredActive.length > sortedActive.length}
			<div class="show-more-section">
				<button class="modern-show-more" on:click={onShowMoreActive}>
					<span>Show More</span>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>
			</div>
		{/if}
	{/if}

	<!-- Completed -->
	<div class="modern-section-header mt-5 mb-3">
		<h3 class="section-title">Completed Assessments</h3>

		<div class="modern-sort-controls">
			<label for="completed-sort-select" class="is-sr-only">Sort Completed Assessments</label>
			<select id="completed-sort-select" bind:value={completedSortBy} class="modern-select-small" aria-label="Sort completed">
				<option value="date">By Date</option>
				<option value="title">By Title</option>
				<option value="type">By Type</option>
				<option value="score">By Score</option>
			</select>

			<button class="modern-sort-button" type="button" aria-label="Toggle sort direction" on:click={() => onToggleSort('completed')}>
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
					class:rotated={completedSortDir === 'asc'}
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</button>
		</div>
	</div>

	<div class="modern-filters mb-3">
		{#each Object.entries(typeLabels) as [type, label]}
			<label class="modern-checkbox">
				<input
					type="checkbox"
					checked={completedTypeFilters.has(type as AssessmentType)}
					on:change={() => onToggleTypeFilter(type as AssessmentType, 'completed')}
				/>
				<span class="checkbox-text">{label}</span>
			</label>
		{/each}
		<label class="modern-checkbox discipline-filter">
			<input
				type="checkbox"
				bind:checked={restrictCompletedToDiscipline}
			/>
			<span class="checkbox-text">Restrict to Discipline</span>
		</label>
	</div>

	{#if sortedCompleted.length === 0}
		<p class="empty-state">No completed assessments yet.</p>
	{:else}
		<div class="modern-grid">
			{#each sortedCompleted as c (c.instance_id)}
				<div class="modern-card completed-card" style="border-left: 4px solid {getMasteryColor(c.score)};">
					<a href={`/results/${c.instance_id}`} class="card-link-wrapper">
						<div class="card-header-row">
							<div class="card-type-badge {c.type}">
								{#if c.type === 'prompt'}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
										<polyline points="14 2 14 8 20 8"></polyline>
									</svg>
								{:else if c.type === 'short'}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
										<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
									</svg>
								{:else if c.type === 'adaptive'}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
										<polyline points="22 4 12 14.01 9 11.01"></polyline>
									</svg>
								{/if}
								<span>{c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : 'Assessment'}</span>
							</div>
							<div class="score-badge" style="background: {getMasteryColor(c.score)}; box-shadow: 0 2px 8px {getMasteryColor(c.score)}40;">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
								</svg>
								<span>{formatScore(c.score)}%</span>
							</div>
						</div>

						<h3 class="card-title">{c.title}</h3>
						{#if c.description}
							<p class="card-description">{c.description}</p>
						{/if}

						<div class="card-meta">
							{#if c.raw_score !== undefined && c.total_items}
								<div class="meta-item">
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
										<polyline points="22 4 12 14.01 9 11.01"></polyline>
									</svg>
									<span>{c.raw_score}/{c.total_items}</span>
								</div>
							{/if}
							{#if c.duration_seconds}
								<div class="meta-item">
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="10"></circle>
										<polyline points="12 6 12 12 16 14"></polyline>
									</svg>
									<span>{Math.round(c.duration_seconds / 60)} min</span>
								</div>
							{/if}
							{#if c.settings?.discipline?.name}
								<div class="meta-item">
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
										<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
									</svg>
									<span>{c.settings.discipline.name}</span>
								</div>
							{/if}
						</div>

						<div class="card-footer-meta">
							{#if c.completed_at}
								<span class="footer-date">{formatHuman(c.completed_at, { timeZone: 'Asia/Manila' })}</span>
							{/if}
						</div>
					</a>

					{#if c.parent_id !== null || c.type === 'mock_exam'}
						<div class="card-actions">
							{#if c.parent_id !== null}
								<a href={`/results/${c.parent_id}`} class="action-link">
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="15 18 9 12 15 6"></polyline>
									</svg>
									<span>Parent Detail</span>
								</a>
							{/if}
							{#if c.type === 'mock_exam'}
								<button class="action-button" on:click={(e) => onRetakeMockExam(c.instance_id, e)}>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="23 4 23 10 17 10"></polyline>
										<polyline points="1 20 1 14 7 14"></polyline>
										<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
									</svg>
									<span>Retake</span>
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredCompleted.length > sortedCompleted.length}
			<div class="show-more-section">
				<button class="modern-show-more" on:click={onShowMoreCompleted}>
					<span>Show More</span>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>
			</div>
		{/if}
	{/if}
{/if}

<style scoped>
    /* Section Header */
    .modern-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        gap: 1rem;
    }

    .section-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0;
    }

    .modern-sort-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .modern-select-small {
        padding: 0.5rem 0.75rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        background: #ffffff;
        color: #374151;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
    }

    .modern-select-small:hover {
        border-color: #d1d5db;
    }

    .modern-select-small:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .modern-sort-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #6b7280;
    }

    .modern-sort-button:hover {
        background: #f9fafb;
        border-color: #6366f1;
        color: #6366f1;
    }

    .modern-sort-button svg {
        transition: transform 0.2s ease;
    }

    .modern-sort-button svg.rotated {
        transform: rotate(180deg);
    }

    .is-sr-only {
        position: absolute !important;
        height: 1px;
        width: 1px;
        overflow: hidden;
        clip: rect(1px, 1px, 1px, 1px);
        white-space: nowrap;
    }

    /* Filters */
    .modern-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 0.75rem 0;
    }

    .modern-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #374151;
        transition: color 0.2s ease;
    }

    .modern-checkbox:hover {
        color: #6366f1;
    }

    .modern-checkbox input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #6366f1;
    }

    .checkbox-text {
        user-select: none;
        font-weight: 500;
    }

    .discipline-filter {
        margin-left: auto;
        padding-left: 1rem;
        border-left: 2px solid #e5e7eb;
    }

    /* Empty State */
    .empty-state {
        font-family: 'Inter', sans-serif;
        font-size: 0.95rem;
        color: #6b7280;
        text-align: center;
        padding: 3rem 1rem;
    }

    /* Grid */
    .modern-grid {
        display: grid;
        grid-gap: 1rem;
        grid-template-columns: 1fr;
        margin-bottom: 1.5rem;
    }

    @media (min-width: 640px) {
        .modern-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (min-width: 1024px) {
        .modern-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    /* Modern Card */
    .modern-card {
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
				padding: 12px;
    }

    .modern-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6);
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .modern-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
        border-color: #6366f1;
    }

    .modern-card:hover::before {
        opacity: 1;
    }

    /* Completed card with score indicator */
    .completed-card {
        border-left-width: 4px;
    }

    .card-link-wrapper {
        display: block;
        padding: 1.25rem;
        color: inherit;
        text-decoration: none;
        flex-grow: 1;
    }

    /* Card Header */
    .card-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .card-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    /* Prompt - Amber/Orange (matching dashboard tiles) */
    .card-type-badge.prompt {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.15));
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.3);
    }

    /* Short Quiz - Blue/Cyan (matching dashboard tiles) */
    .card-type-badge.short {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(6, 182, 212, 0.15));
        color: #3b82f6;
        border: 1px solid rgba(59, 130, 246, 0.3);
    }

    /* Adaptive Quiz - Teal/Green (matching dashboard tiles) */
    .card-type-badge.adaptive {
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(16, 185, 129, 0.15));
        color: #14b8a6;
        border: 1px solid rgba(20, 184, 166, 0.3);
    }

    /* Mock Exam - Purple/Indigo (matching dashboard tiles) */
    .card-type-badge.mock_exam {
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(99, 102, 241, 0.15));
        color: #8b5cf6;
        border: 1px solid rgba(139, 92, 246, 0.3);
    }

    /* Progress Circle */
    .progress-circle {
        position: relative;
        width: 36px;
        height: 36px;
    }

    .progress-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Inter', sans-serif;
        font-size: 0.625rem;
        font-weight: 700;
        color: #6366f1;
    }

    /* Score Badge - Uses calendar legend colors */
    .score-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        font-weight: 700;
        color: #ffffff;
        transition: all 0.2s ease;
    }

    .score-badge svg {
        fill: currentColor;
        stroke: none;
    }

    /* Card Content */
    .card-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
        margin: 0 0 0.5rem 0;
        line-height: 1.3;
    }

    .card-description {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6b7280;
        margin: 0 0 1rem 0;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    /* Card Meta */
    .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .meta-item {
        display: flex;
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

    /* Card Footer Meta */
    .card-footer-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #f3f4f6;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .footer-date,
    .footer-activity {
        display: inline-block;
    }

    /* Card Actions */
    .card-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        border-top: 1px solid #f3f4f6;
        background: #f9fafb;
    }

    .action-link,
    .action-button {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.875rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: 6px;
        transition: all 0.2s ease;
        text-decoration: none;
        border: none;
        cursor: pointer;
    }

    .action-link {
        background: #ffffff;
        color: #6366f1;
        border: 1px solid #e5e7eb;
    }

    .action-link:hover {
        background: #f0f1ff;
        border-color: #6366f1;
    }

    .action-button {
        background: linear-gradient(90deg, #a855f7, #6366f1);
        color: #ffffff;
        box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
    }

    .action-button:hover {
        background: linear-gradient(90deg, #9333ea, #4f46e5);
        box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
        transform: translateY(-1px);
    }

    /* Show More */
    .show-more-section {
        display: flex;
        justify-content: center;
        margin-top: 1.5rem;
    }

    .modern-show-more {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 2rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #6366f1;
        background: #ffffff;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .modern-show-more:hover {
        background: #f0f1ff;
        border-color: #6366f1;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
    }

    .modern-show-more svg {
        transition: transform 0.2s ease;
    }

    .modern-show-more:hover svg {
        transform: translateY(2px);
    }

    /* Mobile Responsiveness */
    @media (max-width: 640px) {
        .modern-section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
        }

        .section-title {
            font-size: 1.25rem;
        }

        .modern-filters {
            gap: 0.75rem;
        }

        .discipline-filter {
            margin-left: 0;
            padding-left: 0;
            border-left: none;
        }

        .card-title {
            font-size: 1rem;
        }

        .card-meta {
            gap: 0.5rem;
        }

        .card-actions {
            flex-direction: column;
            align-items: stretch;
        }

        .action-link,
        .action-button {
            justify-content: center;
        }
    }
</style>