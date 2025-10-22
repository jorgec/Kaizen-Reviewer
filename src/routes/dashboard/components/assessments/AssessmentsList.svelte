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
	<div class="list-header mt-5 mb-2">
		<h3 class="title is-5 mb-0">Active Assessments</h3>

		<div class="sort-controls">
			<label for="active-sort-select" class="is-sr-only">Sort Active Assessments</label>
			<select id="active-sort-select" bind:value={activeSortBy} class="select is-small mr-2" aria-label="Sort active">
				<option value="date">By Date</option>
				<option value="title">By Title</option>
				<option value="type">By Type</option>
				<option value="score">By Score</option>
			</select>

			<button class="button is-small" type="button" aria-label="Toggle sort direction" on:click={() => onToggleSort('active')}>
				{#if activeSortDir === 'asc'}<span>▲</span>{:else}<span>▼</span>{/if}
			</button>
		</div>
	</div>

	<div class="type-filters mb-3">
		{#each Object.entries(typeLabels) as [type, label]}
			<label class="checkbox-label">
				<input
					type="checkbox"
					checked={activeTypeFilters.has(type as AssessmentType)}
					on:change={() => onToggleTypeFilter(type as AssessmentType, 'active')}
				/>
				<span>{label}</span>
			</label>
		{/each}
		<span class="discipline-toggle">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={restrictActiveToDiscipline}
				/>
				<span>Restrict to Discipline</span>
			</label>
		</span>
	</div>

	{#if sortedActive.length === 0}
		<p>No active assessments.</p>
	{:else}
		<div class="dashboard-grid">
			{#each sortedActive as a (a.instance_id)}
				<a href={`/assessment/${a.instance_id}`} class="card assessment-card dashboard-card">
					<div class="card-content">
						<p class="title is-6 mb-2">{a.title}</p>
						<p class="subtitle is-7 mb-2">
							{a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : ''} Assessment
						</p>
						{#if a.description}<p class="is-size-7 mb-2 has-text-grey">{a.description}</p>{/if}

						<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
							<span class="is-size-7 has-text-grey">Status: {a.status}</span>
							<span class="is-size-7">
                {a.total_items ? `${a.progress}% (${a.answered_items || 0}/${a.total_items})` : ''}
              </span>
						</div>

						{#if a.total_items}
							<progress class="progress is-info is-small" value={a.progress} max="100">{a.progress}%</progress>
						{/if}

						{#if a.score !== undefined && a.score !== null}
							<p class="is-size-7 mt-2">Current Score: {a.score}%</p>
						{/if}

						{#if a.settings?.discipline?.name}
							<p class="is-size-7 mt-2">Discipline: {a.settings?.discipline?.name}</p>
						{/if}

						<p class="is-size-7 mt-2">Assigned: {formatHuman(a.assigned_at, { timeZone: 'Asia/Manila' })}</p>
						{#if a.last_activity_at}
							<p class="is-size-7">Last Activity: {formatHuman(a.last_activity_at, { timeZone: 'Asia/Manila' })}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>

		{#if filteredActive.length > sortedActive.length}
			<div class="has-text-centered mt-3">
				<button class="button is-small is-link" on:click={onShowMoreActive}>Show More</button>
			</div>
		{/if}
	{/if}

	<!-- Completed -->
	<div class="list-header mt-6 mb-2">
		<h3 class="title is-5 mb-0">Completed Assessments</h3>
		<div class="sort-controls">
			<label for="completed-sort-select" class="is-sr-only">Sort Completed Assessments</label>
			<select id="completed-sort-select" bind:value={completedSortBy} class="select is-small mr-2" aria-label="Sort completed">
				<option value="date">By Date</option>
				<option value="title">By Title</option>
				<option value="type">By Type</option>
				<option value="score">By Score</option>
			</select>
			<button class="button is-small" type="button" aria-label="Toggle sort direction" on:click={() => onToggleSort('completed')}>
				{#if completedSortDir === 'asc'}<span>▲</span>{:else}<span>▼</span>{/if}
			</button>
		</div>
	</div>

	<div class="type-filters mb-3">
		{#each Object.entries(typeLabels) as [type, label]}
			<label class="checkbox-label">
				<input
					type="checkbox"
					checked={completedTypeFilters.has(type as AssessmentType)}
					on:change={() => onToggleTypeFilter(type as AssessmentType, 'completed')}
				/>
				<span>{label}</span>
			</label>
		{/each}
		<span class="discipline-toggle">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={restrictCompletedToDiscipline}
				/>
				<span>Restrict to Discipline</span>
			</label>
		</span>
	</div>

	{#if sortedCompleted.length === 0}
		<p>No completed assessments yet.</p>
	{:else}
		<div class="dashboard-grid">
			{#each sortedCompleted as c (c.instance_id)}
				<div class="card assessment-card dashboard-card" style="border-left:4px solid {getMasteryColor(c.score)};">
					<a href={`/results/${c.instance_id}`} class="card-link">
						<div class="card-content">
							<p class="title is-6 mb-2">{c.title}</p>
							<p class="subtitle is-7 mb-2">
								{c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : ''} Assessment
							</p>
							{#if c.description}<p class="is-size-7 mb-2 has-text-grey">{c.description}</p>{/if}

							<div class="is-flex is-align-items-center is-justify-content-space-between mb-2">
								<span class="is-size-7">Score: {c.score}%</span>
								<span class="is-size-7">{c.raw_score !== undefined && c.total_items ? `(${c.raw_score}/${c.total_items})` : ''}</span>
							</div>

							{#if c.settings?.discipline?.name}
								<p class="is-size-7 mt-2">Discipline: {c.settings?.discipline?.name}</p>
							{/if}

							{#if c.completed_at}
								<p class="is-size-7 mt-2">Completed: {formatHuman(c.completed_at, { timeZone: 'Asia/Manila' })}</p>
							{/if}
							{#if c.duration_seconds}
								<p class="is-size-7">Duration: {Math.round(c.duration_seconds / 60)} min</p>
							{/if}
						</div>
					</a>

					{#if c.parent_id !== null}
						<div class="card-footer card-footer-item">
							<a href={`/results/${c.parent_id}`} class="is-size-6 card-link">Parent Detail</a>
						</div>
					{/if}

					{#if c.type === 'mock_exam'}
						<div class="card-footer">
							<button class="button is-small is-primary card-footer-item" on:click={(e) => onRetakeMockExam(c.instance_id, e)}>
								🔄 Retake
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredCompleted.length > sortedCompleted.length}
			<div class="has-text-centered mt-3">
				<button class="button is-small is-link" on:click={onShowMoreCompleted}>Show More</button>
			</div>
		{/if}
	{/if}
{/if}

<style scoped>
    .list-header { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:0.5rem; gap:1rem; }
    .sort-controls { display:flex; align-items:center; gap:0.25rem; }
    .is-sr-only { position:absolute !important; height:1px; width:1px; overflow:hidden; clip:rect(1px, 1px, 1px, 1px); white-space:nowrap; }
    .type-filters { display:flex; flex-wrap:wrap; gap:1rem; padding:0.75rem 0; }
    .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.95rem; }
    .checkbox-label input[type="checkbox"] { cursor:pointer; }
    .checkbox-label span { user-select:none; }

    .assessment-card { display:block; border-radius:var(--radius-lg); box-shadow:0 3px 8px rgba(0,0,0,0.1); transition:transform 0.2s, box-shadow 0.2s; position:relative; }
    .assessment-card:hover { transform: translateY(-3px); box-shadow:0 6px 16px rgba(0,0,0,0.2); }
    .card-link { display:block; color:inherit; text-decoration:none; }
    .card-footer { border-top:1px solid #ededed; }
    .card-footer-item { border:none; border-radius:0; width:100%; }

    .dashboard-grid { display:grid; grid-gap:1.5rem; grid-template-columns:1fr; margin-bottom:1.5rem; }
    @media (min-width:600px){ .dashboard-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width:900px){ .dashboard-grid { grid-template-columns: repeat(3, 1fr); } }
    .dashboard-card { min-width:0; }
</style>