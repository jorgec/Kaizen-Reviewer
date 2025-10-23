<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	{% if cookiecutter.route_type != 'static' -%}
	import { supabase } from '$lib/supabaseClient';
	import { browser } from '$app/environment';
	{%- endif %}

	export const ssr = false;

	// User state
	let user: any = null;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	{% if cookiecutter.route_type != 'static' -%}
	// Reactive user properties
	$: currentDiscipline = user?.currentDiscipline ?? null;
	$: currentOrg = user?.currentOrg ?? null;

	// Loading and error states
	let loading = true;
	let errorMsg = '';

	// Data state
	let data: any[] = [];
	{%- endif %}

	{% if cookiecutter.include_filters == 'yes' -%}
	// Filter state
	let selectedSubject: string = '';
	let selectedTopic: string = '';
	let selectedSubtopic: string = '';

	// Reactive filter options
	$: subjectOptions = Array.from(new Set(data.map((d) => d.subject_name)))
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	$: topicOptions = Array.from(
		new Set(
			data
				.filter((f) => (selectedSubject ? f.subject_name === selectedSubject : true))
				.map((f) => f.topic_name)
		)
	)
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	$: subtopicOptions = Array.from(
		new Set(
			data
				.filter((f) =>
					selectedSubject && selectedTopic
						? f.subject_name === selectedSubject && f.topic_name === selectedTopic
						: selectedSubject
							? f.subject_name === selectedSubject
							: selectedTopic
								? f.topic_name === selectedTopic
								: true
				)
				.map((f) => f.subtopic_name)
		)
	)
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	// Reset dependent filters when parent changes
	$: if (selectedTopic && !topicOptions.includes(selectedTopic)) {
		selectedTopic = '';
	}
	$: if (selectedSubtopic && !subtopicOptions.includes(selectedSubtopic)) {
		selectedSubtopic = '';
	}

	// Filtered data
	$: filteredData = data.filter((item) => {
		if (selectedSubject && item.subject_name !== selectedSubject) return false;
		if (selectedTopic && item.topic_name !== selectedTopic) return false;
		if (selectedSubtopic && item.subtopic_name !== selectedSubtopic) return false;
		return true;
	});
	{%- endif %}

	{% if cookiecutter.include_modal == 'yes' -%}
	// Modal state
	let showModal = false;
	let modalData: any = null;

	function openModal(item: any) {
		modalData = item;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		modalData = null;
	}
	{%- endif %}

	{% if cookiecutter.include_table == 'yes' -%}
	// Table sorting
	let sortColumn: string = '';
	let sortDirection: 'asc' | 'desc' = 'asc';

	function sortBy(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	$: sortedData = (() => {
		{% if cookiecutter.include_filters == 'yes' -%}
		let dataToSort = [...filteredData];
		{%- else -%}
		let dataToSort = [...data];
		{%- endif %}
		if (sortColumn) {
			dataToSort.sort((a, b) => {
				const aVal = a[sortColumn];
				const bVal = b[sortColumn];
				if (aVal === bVal) return 0;
				const comparison = aVal > bVal ? 1 : -1;
				return sortDirection === 'asc' ? comparison : -comparison;
			});
		}
		return dataToSort;
	})();
	{%- endif %}

	{% if cookiecutter.route_type != 'static' -%}
	// Fetch data
	async function fetchData() {
		if (!user?.user_id || !currentDiscipline?.discipline_id) {
			return;
		}

		loading = true;
		errorMsg = '';

		try {
			// TODO: Replace with your actual RPC call
			const { data: result, error } = await supabase.rpc('your_rpc_function_here', {
				p_user_id: user.user_id,
				p_discipline_id: currentDiscipline.discipline_id
			});

			if (error) throw error;
			data = result || [];
		} catch (err: any) {
			console.error('Error fetching data:', err);
			errorMsg = err.message || 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	// Reactive fetch on discipline change
	$: if (browser && user?.user_id && currentDiscipline?.discipline_id) {
		fetchData();
	}
	{%- endif %}

	onMount(() => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		{% if cookiecutter.route_type != 'static' -%}
		if (currentDiscipline?.discipline_id) {
			fetchData();
		}
		{%- endif %}
	});
</script>

<svelte:head>
	<title>{{ cookiecutter.route_display_name }} | Kaizen</title>
</svelte:head>

<div class="{{cookiecutter.route_type}}-container">
	<div class="{{cookiecutter.route_type}}-wrapper">
		<!-- Header -->
		<div class="{{cookiecutter.route_type}}-header">
			<h1 class="{{cookiecutter.route_type}}-title">{{ cookiecutter.route_display_name }}</h1>
			<p class="{{cookiecutter.route_type}}-subtitle">{{ cookiecutter.route_description }}</p>
		</div>

		<!-- Loading State -->
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading data...</p>
			</div>

			<!-- Error State -->
		{:else if errorMsg}
			<div class="error-state">
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
				<p>{errorMsg}</p>
				<button class="modern-button" on:click={fetchData}>Retry</button>
			</div>

			<!-- Main Content -->
		{:else}
			{% if cookiecutter.include_filters == 'yes' -%}
			<!-- Filters Section -->
			<div class="filters-row">
				<div class="filter-group">
					<label class="filter-label" for="subject-filter">Subject</label>
					<select id="subject-filter" bind:value={selectedSubject} class="modern-select">
						<option value="">All Subjects</option>
						{#each subjectOptions as subj}
							<option value={subj}>{subj}</option>
						{/each}
					</select>
				</div>

				<div class="filter-group">
					<label class="filter-label" for="topic-filter">Topic</label>
					<select id="topic-filter" bind:value={selectedTopic} class="modern-select">
						<option value="">All Topics</option>
						{#each topicOptions as top}
							<option value={top}>{top}</option>
						{/each}
					</select>
				</div>

				<div class="filter-group">
					<label class="filter-label" for="subtopic-filter">Subtopic</label>
					<select id="subtopic-filter" bind:value={selectedSubtopic} class="modern-select">
						<option value="">All Subtopics</option>
						{#each subtopicOptions as sub}
							<option value={sub}>{sub}</option>
						{/each}
					</select>
				</div>
			</div>
			{%- endif %}

			{% if cookiecutter.include_table == 'yes' -%}
			<!-- Table Section -->
			<div class="table-wrapper">
				{#if sortedData.length === 0}
					<div class="empty-state">
						<p>No data available</p>
					</div>
				{:else}
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th>
									<button class="sort-btn" on:click={() => sortBy('name')}>
										Name
										{#if sortColumn === 'name'}
											<span class="sort-indicator {sortDirection}">▼</span>
										{/if}
									</button>
								</th>
								<th>
									<button class="sort-btn" on:click={() => sortBy('value')}>
										Value
										{#if sortColumn === 'value'}
											<span class="sort-indicator {sortDirection}">▼</span>
										{/if}
									</button>
								</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each sortedData as item (item.id || item.name)}
								<tr>
									<td>{item.name || 'N/A'}</td>
									<td>{item.value || 'N/A'}</td>
									<td>
										{% if cookiecutter.include_modal == 'yes' -%}
										<button class="action-btn" on:click={() => openModal(item)}>
											View Details
										</button>
										{%- else -%}
										<button class="action-btn">Action</button>
										{%- endif %}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
			{%- else -%}
			<!-- Card Grid Section (alternative to table) -->
			<div class="card-grid">
				{#if data.length === 0}
					<div class="empty-state">
						<p>No data available</p>
					</div>
				{:else}
					{#each data as item (item.id || item.name)}
						<div class="metric-card">
							<div class="metric-header">
								<h3>{item.name || 'Item'}</h3>
							</div>
							<div class="metric-body">
								<p class="metric-value">{item.value || 'N/A'}</p>
								<p class="metric-label">Value</p>
							</div>
							{% if cookiecutter.include_modal == 'yes' -%}
							<button class="modern-button small" on:click={() => openModal(item)}>
								View Details
							</button>
							{%- endif %}
						</div>
					{/each}
				{/if}
			</div>
			{%- endif %}
		{/if}
	</div>
</div>

{% if cookiecutter.include_modal == 'yes' -%}
<!-- Modal -->
{#if showModal}
	<div class="modern-modal-overlay" on:click={closeModal} role="button" tabindex="0">
		<div
			class="modern-modal-card"
			on:click|stopPropagation
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<header class="modern-modal-header">
				<h2>Details</h2>
				<button class="modern-modal-close" on:click={closeModal} aria-label="Close modal">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
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
				</button>
			</header>
			<section class="modern-modal-body">
				{#if modalData}
					<p><strong>Name:</strong> {modalData.name || 'N/A'}</p>
					<p><strong>Value:</strong> {modalData.value || 'N/A'}</p>
					<!-- Add more fields as needed -->
				{/if}
			</section>
			<footer class="modern-modal-footer">
				<button class="modern-button" on:click={closeModal}>Close</button>
			</footer>
		</div>
	</div>
{/if}
{%- endif %}

<style>
	/* Container */
	.{{cookiecutter.route_type}}-container {
		min-height: calc(100vh - 80px);
		background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
		padding: 2rem 1rem;
	}

	.{{cookiecutter.route_type}}-wrapper {
		max-width: 1400px;
		margin: 0 auto;
	}

	/* Header */
	.{{cookiecutter.route_type}}-header {
		margin-bottom: 2rem;
		text-align: center;
	}

	.{{cookiecutter.route_type}}-title {
		font-size: 2.2rem;
		font-weight: 700;
		background: linear-gradient(135deg, {{ cookiecutter.primary_color }}, {{ cookiecutter.secondary_color }});
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin-bottom: 0.5rem;
	}

	.{{cookiecutter.route_type}}-subtitle {
		font-size: 1rem;
		color: #6b7280;
		max-width: 600px;
		margin: 0 auto;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1rem;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #e5e7eb;
		border-top-color: {{ cookiecutter.primary_color }};
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Error State */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1rem;
		color: #dc2626;
	}

	.error-state svg {
		color: #dc2626;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: #9ca3af;
		font-size: 1rem;
	}

	{% if cookiecutter.include_filters == 'yes' -%}
	/* Filters */
	.filters-row {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
		min-width: 200px;
	}

	.filter-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.modern-select {
		padding: 0.75rem 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		font-size: 1rem;
		background: white;
		color: #111827;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.modern-select:hover {
		border-color: #d1d5db;
	}

	.modern-select:focus {
		outline: none;
		border-color: {{ cookiecutter.primary_color }};
		box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.1);
	}
	{%- endif %}

	{% if cookiecutter.include_table == 'yes' -%}
	/* Table */
	.table-wrapper {
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		overflow: hidden;
	}

	.modern-analytics-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	.modern-analytics-table thead {
		background: linear-gradient(135deg, {{ cookiecutter.primary_color }}, {{ cookiecutter.secondary_color }});
		color: white;
	}

	.modern-analytics-table th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.875rem;
	}

	.modern-analytics-table tbody tr {
		border-bottom: 1px solid #f3f4f6;
		transition: background-color 0.2s ease;
	}

	.modern-analytics-table tbody tr:hover {
		background-color: #faf9fc;
	}

	.modern-analytics-table td {
		padding: 1rem;
		color: #374151;
	}

	.sort-btn {
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0;
		width: 100%;
	}

	.sort-indicator {
		font-size: 0.75rem;
		transition: transform 0.2s ease;
	}

	.sort-indicator.desc {
		transform: rotate(180deg);
	}

	.action-btn {
		padding: 0.5rem 1rem;
		background: {{ cookiecutter.primary_color }};
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		background: {{ cookiecutter.secondary_color }};
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(168, 85, 247, 0.2);
	}
	{%- else -%}
	/* Card Grid */
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.metric-card {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		border-left: 4px solid {{ cookiecutter.primary_color }};
	}

	.metric-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	}

	.metric-header h3 {
		font-size: 1.1rem;
		font-weight: 600;
		color: #111827;
		margin-bottom: 1rem;
	}

	.metric-body {
		margin-bottom: 1rem;
	}

	.metric-value {
		font-size: 2rem;
		font-weight: 700;
		color: {{ cookiecutter.primary_color }};
		font-variant-numeric: tabular-nums;
		margin-bottom: 0.25rem;
	}

	.metric-label {
		font-size: 0.875rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	{%- endif %}

	/* Buttons */
	.modern-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, {{ cookiecutter.primary_color }}, {{ cookiecutter.secondary_color }});
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 2px 8px rgba(168, 85, 247, 0.2);
	}

	.modern-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(168, 85, 247, 0.3);
	}

	.modern-button:active {
		transform: translateY(0);
	}

	.modern-button.small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	{% if cookiecutter.include_modal == 'yes' -%}
	/* Modal */
	.modern-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modern-modal-card {
		background: white;
		border-radius: 16px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.modern-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		background: linear-gradient(135deg, {{ cookiecutter.primary_color }}, {{ cookiecutter.secondary_color }});
		color: white;
	}

	.modern-modal-header h2 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.modern-modal-close {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: background-color 0.2s ease;
	}

	.modern-modal-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.modern-modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.modern-modal-body p {
		margin-bottom: 1rem;
		color: #374151;
		line-height: 1.6;
	}

	.modern-modal-footer {
		padding: 1.5rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}
	{%- endif %}

	/* Responsive */
	@media (max-width: 768px) {
		.{{cookiecutter.route_type}}-title {
			font-size: 1.75rem;
		}

		{% if cookiecutter.include_filters == 'yes' -%}
		.filters-row {
			flex-direction: column;
		}

		.filter-group {
			min-width: 100%;
		}
		{%- endif %}

		{% if cookiecutter.include_table == 'yes' -%}
		.table-wrapper {
			overflow-x: auto;
		}

		.modern-analytics-table {
			font-size: 0.875rem;
		}

		.modern-analytics-table th,
		.modern-analytics-table td {
			padding: 0.75rem;
		}
		{%- else -%}
		.card-grid {
			grid-template-columns: 1fr;
		}
		{%- endif %}

		{% if cookiecutter.include_modal == 'yes' -%}
		.modern-modal-card {
			max-height: 95vh;
		}
		{%- endif %}
	}
</style>
