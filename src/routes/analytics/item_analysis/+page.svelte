<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';

	let loading = true;
	let error: string | null = null;
	let items: any[] = [];
	let user: any;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	// Filter state
	let selectedDiscipline: number | null = null;
	let selectedBank: string | null = null;
	let selectedSubject: number | null = null;
	let selectedTopic: number | null = null;
	let selectedSubtopic: number | null = null;
	let selectedDifficulty: string | null = null;
	let selectedBloomLevel: string | null = null;

	// Pagination state
	let currentPage = 1;
	let pageSize = 100;
	let totalItems = 0;

	// Ordering state
	let orderBy = 'difficulty_index';
	let orderDirection: 'asc' | 'desc' = 'asc';

	// Filter options
	let disciplines: any[] = [];
	let banks: any[] = [];
	let subjects: any[] = [];
	let topics: any[] = [];
	let subtopics: any[] = [];

	// Computed filtered items
	$: filteredItems = items.filter(item => {
		if (selectedDiscipline && item.discipline_id !== selectedDiscipline) return false;
		if (selectedBank && item.bank_id !== selectedBank) return false;
		if (selectedSubject && item.subject_id !== selectedSubject) return false;
		if (selectedTopic && item.topic_id !== selectedTopic) return false;
		if (selectedSubtopic && item.subtopic_id !== selectedSubtopic) return false;
		if (selectedDifficulty && item.q_difficulty !== selectedDifficulty) return false;
		if (selectedBloomLevel && item.q_bloom_level !== selectedBloomLevel) return false;
		return true;
	});

	// Computed sorted items
	$: sortedItems = [...filteredItems].sort((a, b) => {
		const aVal = a[orderBy];
		const bVal = b[orderBy];
		const direction = orderDirection === 'asc' ? 1 : -1;
		if (aVal < bVal) return -1 * direction;
		if (aVal > bVal) return 1 * direction;
		return 0;
	});

	// Computed paginated items
	$: paginatedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
	$: totalPages = Math.ceil(sortedItems.length / pageSize);

	// Aggregations
	$: aggregations = {
		totalQuestions: filteredItems.length,
		avgDifficultyIndex: filteredItems.length > 0
			? (filteredItems.reduce((sum, item) => sum + (item.difficulty_index || 0), 0) / filteredItems.length).toFixed(2)
			: '0.00',
		avgDiscrimination: filteredItems.length > 0
			? (filteredItems.reduce((sum, item) => sum + (item.discrimination || 0), 0) / filteredItems.length).toFixed(2)
			: '0.00',
		avgPlausibility: filteredItems.length > 0
			? (filteredItems.reduce((sum, item) => sum + (item.plausibility_index || 0), 0) / filteredItems.length).toFixed(2)
			: '0.00',
		totalAttempts: filteredItems.reduce((sum, item) => sum + (item.attempts || 0), 0),
		totalCorrect: filteredItems.reduce((sum, item) => sum + (item.correct || 0), 0),
		overallAccuracy: filteredItems.reduce((sum, item) => sum + (item.attempts || 0), 0) > 0
			? ((filteredItems.reduce((sum, item) => sum + (item.correct || 0), 0) / filteredItems.reduce((sum, item) => sum + (item.attempts || 0), 0)) * 100).toFixed(1)
			: '0.0',
		avgTimeSeconds: filteredItems.length > 0
			? ((filteredItems.reduce((sum, item) => sum + (item.avg_time_ms || 0), 0) / filteredItems.length) / 1000).toFixed(1)
			: '0.0'
	};

	// Update filter options based on selections
	$: {
		if (items.length > 0) {
			// Disciplines (always available)
			const disciplineMap = new Map();
			items.forEach(i => {
				if (i.discipline_id && !disciplineMap.has(i.discipline_id)) {
					disciplineMap.set(i.discipline_id, { id: i.discipline_id, name: i.discipline_name });
				}
			});
			disciplines = Array.from(disciplineMap.values());

			// Banks (filtered by discipline)
			const bankMap = new Map();
			items
				.filter(i => !selectedDiscipline || i.discipline_id === selectedDiscipline)
				.forEach(i => {
					if (i.bank_id && !bankMap.has(i.bank_id)) {
						bankMap.set(i.bank_id, { id: i.bank_id, name: i.bank_name });
					}
				});
			banks = Array.from(bankMap.values());

			// Subjects (filtered by bank)
			const subjectMap = new Map();
			items
				.filter(i => !selectedBank || i.bank_id === selectedBank)
				.forEach(i => {
					if (i.subject_id && !subjectMap.has(i.subject_id)) {
						subjectMap.set(i.subject_id, { id: i.subject_id, name: i.subject_name });
					}
				});
			subjects = Array.from(subjectMap.values());

			// Topics (filtered by subject)
			const topicMap = new Map();
			items
				.filter(i => !selectedSubject || i.subject_id === selectedSubject)
				.forEach(i => {
					if (i.topic_id && !topicMap.has(i.topic_id)) {
						topicMap.set(i.topic_id, { id: i.topic_id, name: i.topic_name });
					}
				});
			topics = Array.from(topicMap.values());

			// Subtopics (filtered by topic)
			const subtopicMap = new Map();
			items
				.filter(i => !selectedTopic || i.topic_id === selectedTopic)
				.forEach(i => {
					if (i.subtopic_id && !subtopicMap.has(i.subtopic_id)) {
						subtopicMap.set(i.subtopic_id, { id: i.subtopic_id, name: i.subtopic_name });
					}
				});
			subtopics = Array.from(subtopicMap.values());
		}
	}

	async function loadData() {
		try {
			loading = true;
			error = null;

			const { data, error: fetchError } = await supabase
				.from('v_notes_item_validity')
				.select('*')
				.eq('org_id', user.currentOrg?.org_id);

			if (fetchError) {
				error = fetchError.message;
			} else {
				items = data || [];
				totalItems = items.length;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	function resetFilters() {
		selectedDiscipline = null;
		selectedBank = null;
		selectedSubject = null;
		selectedTopic = null;
		selectedSubtopic = null;
		selectedDifficulty = null;
		selectedBloomLevel = null;
		currentPage = 1;
	}

	function handleDisciplineChange() {
		selectedBank = null;
		selectedSubject = null;
		selectedTopic = null;
		selectedSubtopic = null;
		currentPage = 1;
	}

	function handleBankChange() {
		selectedSubject = null;
		selectedTopic = null;
		selectedSubtopic = null;
		currentPage = 1;
	}

	function handleSubjectChange() {
		selectedTopic = null;
		selectedSubtopic = null;
		currentPage = 1;
	}

	function handleTopicChange() {
		selectedSubtopic = null;
		currentPage = 1;
	}

	function changePage(page: number) {
		currentPage = page;
	}

	function changePageSize(newSize: number) {
		pageSize = newSize;
		currentPage = 1;
	}

	function changeSort(column: string) {
		if (orderBy === column) {
			orderDirection = orderDirection === 'asc' ? 'desc' : 'asc';
		} else {
			orderBy = column;
			orderDirection = 'asc';
		}
	}

	onMount(() => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}

		// Check if user has role_id of 2 or below
		const hasAccess = user?.roles?.some((role: any) => role.role_id <= 2);
		if (!hasAccess) {
			goto('/dashboard');
			return;
		}

		loadData();
	});
</script>

<svelte:head>
	<title>Item Analysis | Kaizen</title>
</svelte:head>

<div class="analysis-container">
	{#if loading}
		<div class="loading-state">
			<div class="loading-card">
				<div class="spinner-wrapper">
					<div class="spinner"></div>
				</div>
				<p class="loading-text">Loading item analysis data...</p>
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
			</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="page-header">
			<div class="header-content">
				<h1>Item Analysis</h1>
				<p>Comprehensive item validity and performance metrics</p>
			</div>
		</div>

		<!-- Aggregations Summary -->
		<div class="aggregations-grid">
			<div class="agg-card">
				<div class="agg-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
					</svg>
				</div>
				<div class="agg-content">
					<div class="agg-label">Total Questions</div>
					<div class="agg-value">{aggregations.totalQuestions.toLocaleString()}</div>
				</div>
			</div>

			<div class="agg-card">
				<div class="agg-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="20" x2="18" y2="10"></line>
						<line x1="12" y1="20" x2="12" y2="4"></line>
						<line x1="6" y1="20" x2="6" y2="14"></line>
					</svg>
				</div>
				<div class="agg-content">
					<div class="agg-label">Avg Difficulty</div>
					<div class="agg-value">{aggregations.avgDifficultyIndex}</div>
				</div>
			</div>

			<div class="agg-card">
				<div class="agg-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
					</svg>
				</div>
				<div class="agg-content">
					<div class="agg-label">Avg Discrimination</div>
					<div class="agg-value">{aggregations.avgDiscrimination}</div>
				</div>
			</div>

			<div class="agg-card">
				<div class="agg-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
				</div>
				<div class="agg-content">
					<div class="agg-label">Overall Accuracy</div>
					<div class="agg-value">{aggregations.overallAccuracy}%</div>
				</div>
			</div>

			<div class="agg-card">
				<div class="agg-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
						<circle cx="12" cy="12" r="3"></circle>
					</svg>
				</div>
				<div class="agg-content">
					<div class="agg-label">Total Attempts</div>
					<div class="agg-value">{aggregations.totalAttempts.toLocaleString()}</div>
				</div>
			</div>

			<div class="agg-card">
				<div class="agg-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<polyline points="12 6 12 12 16 14"></polyline>
					</svg>
				</div>
				<div class="agg-content">
					<div class="agg-label">Avg Time</div>
					<div class="agg-value">{aggregations.avgTimeSeconds}s</div>
				</div>
			</div>
		</div>

		<!-- Filters -->
		<div class="filters-card">
			<div class="filters-header">
				<h2>Filters</h2>
				<button type="button" class="reset-button" on:click={resetFilters}>
					Reset All
				</button>
			</div>

			<div class="filters-grid">
				<!-- Discipline Filter -->
				<div class="filter-group">
					<label for="discipline">Discipline</label>
					<select id="discipline" bind:value={selectedDiscipline} on:change={handleDisciplineChange}>
						<option value={null}>All Disciplines</option>
						{#each disciplines as discipline}
							<option value={discipline.id}>{discipline.name}</option>
						{/each}
					</select>
				</div>

				<!-- Bank Filter -->
				<div class="filter-group">
					<label for="bank">Bank</label>
					<select id="bank" bind:value={selectedBank} on:change={handleBankChange} disabled={!selectedDiscipline}>
						<option value={null}>All Banks</option>
						{#each banks as bank}
							<option value={bank.id}>{bank.name}</option>
						{/each}
					</select>
				</div>

				<!-- Subject Filter -->
				<div class="filter-group">
					<label for="subject">Subject</label>
					<select id="subject" bind:value={selectedSubject} on:change={handleSubjectChange} disabled={!selectedBank}>
						<option value={null}>All Subjects</option>
						{#each subjects as subject}
							<option value={subject.id}>{subject.name}</option>
						{/each}
					</select>
				</div>

				<!-- Topic Filter -->
				<div class="filter-group">
					<label for="topic">Topic</label>
					<select id="topic" bind:value={selectedTopic} on:change={handleTopicChange} disabled={!selectedSubject}>
						<option value={null}>All Topics</option>
						{#each topics as topic}
							<option value={topic.id}>{topic.name}</option>
						{/each}
					</select>
				</div>

				<!-- Subtopic Filter -->
				<div class="filter-group">
					<label for="subtopic">Subtopic</label>
					<select id="subtopic" bind:value={selectedSubtopic} on:change={() => currentPage = 1} disabled={!selectedTopic}>
						<option value={null}>All Subtopics</option>
						{#each subtopics as subtopic}
							<option value={subtopic.id}>{subtopic.name}</option>
						{/each}
					</select>
				</div>

				<!-- Difficulty Filter -->
				<div class="filter-group">
					<label for="difficulty">Difficulty</label>
					<select id="difficulty" bind:value={selectedDifficulty} on:change={() => currentPage = 1}>
						<option value={null}>All Difficulties</option>
						<option value="easy">Easy</option>
						<option value="medium">Medium</option>
						<option value="hard">Hard</option>
					</select>
				</div>

				<!-- Bloom Level Filter -->
				<div class="filter-group">
					<label for="bloom">Bloom Level</label>
					<select id="bloom" bind:value={selectedBloomLevel} on:change={() => currentPage = 1}>
						<option value={null}>All Bloom Levels</option>
						<option value="remember">Remember</option>
						<option value="understand">Understand</option>
						<option value="apply">Apply</option>
						<option value="analyze">Analyze</option>
						<option value="evaluate">Evaluate</option>
						<option value="create">Create</option>
					</select>
				</div>

				<!-- Page Size -->
				<div class="filter-group">
					<label for="pageSize">Items per page</label>
					<select id="pageSize" value={pageSize} on:change={(e) => changePageSize(Number(e.currentTarget.value))}>
						<option value={25}>25</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
						<option value={250}>250</option>
						<option value={500}>500</option>
					</select>
				</div>
			</div>
		</div>

		<!-- Results Count and Pagination -->
		<div class="results-header">
			<div class="results-info">
				Showing {Math.min((currentPage - 1) * pageSize + 1, sortedItems.length)} - {Math.min(currentPage * pageSize, sortedItems.length)} of {sortedItems.length} items
			</div>

			{#if totalPages > 1}
				<div class="pagination">
					<button
						type="button"
						class="pagination-button"
						on:click={() => changePage(currentPage - 1)}
						disabled={currentPage === 1}
					>
						Previous
					</button>

					{#if currentPage > 2}
						<button type="button" class="pagination-button" on:click={() => changePage(1)}>1</button>
						{#if currentPage > 3}
							<span class="pagination-ellipsis">...</span>
						{/if}
					{/if}

					{#if currentPage > 1}
						<button type="button" class="pagination-button" on:click={() => changePage(currentPage - 1)}>{currentPage - 1}</button>
					{/if}

					<button type="button" class="pagination-button active">{currentPage}</button>

					{#if currentPage < totalPages}
						<button type="button" class="pagination-button" on:click={() => changePage(currentPage + 1)}>{currentPage + 1}</button>
					{/if}

					{#if currentPage < totalPages - 1}
						{#if currentPage < totalPages - 2}
							<span class="pagination-ellipsis">...</span>
						{/if}
						<button type="button" class="pagination-button" on:click={() => changePage(totalPages)}>{totalPages}</button>
					{/if}

					<button
						type="button"
						class="pagination-button"
						on:click={() => changePage(currentPage + 1)}
						disabled={currentPage === totalPages}
					>
						Next
					</button>
				</div>
			{/if}
		</div>

		<!-- Data Table -->
		<div class="table-container">
			<table class="data-table">
				<thead>
					<tr>
						<th class="sortable" on:click={() => changeSort('question_id')}>
							<div class="th-content">
								Question ID
								{#if orderBy === 'question_id'}
									<span class="sort-indicator">{orderDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</div>
						</th>
						<th>Bank</th>
						<th>Topic / Subtopic</th>
						<th class="sortable" on:click={() => changeSort('difficulty_index')}>
							<div class="th-content">
								Difficulty Index
								{#if orderBy === 'difficulty_index'}
									<span class="sort-indicator">{orderDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</div>
						</th>
						<th class="sortable" on:click={() => changeSort('discrimination')}>
							<div class="th-content">
								Discrimination
								{#if orderBy === 'discrimination'}
									<span class="sort-indicator">{orderDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</div>
						</th>
						<th class="sortable" on:click={() => changeSort('plausibility_index')}>
							<div class="th-content">
								Plausibility
								{#if orderBy === 'plausibility_index'}
									<span class="sort-indicator">{orderDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</div>
						</th>
						<th class="sortable" on:click={() => changeSort('attempts')}>
							<div class="th-content">
								Attempts
								{#if orderBy === 'attempts'}
									<span class="sort-indicator">{orderDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</div>
						</th>
						<th class="sortable" on:click={() => changeSort('correct')}>
							<div class="th-content">
								Accuracy
								{#if orderBy === 'correct'}
									<span class="sort-indicator">{orderDirection === 'asc' ? '↑' : '↓'}</span>
								{/if}
							</div>
						</th>
						<th>Difficulty</th>
						<th>Bloom Level</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedItems as item}
						<tr>
							<td>{item.question_id}</td>
							<td>
								<div class="bank-cell">
									<div class="bank-name">{item.bank_name}</div>
									<div class="bank-slug">{item.bank_slug}</div>
								</div>
							</td>
							<td>
								<div class="taxonomy-cell">
									<div class="topic">{item.topic_name}</div>
									{#if item.subtopic_name}
										<div class="subtopic">{item.subtopic_name}</div>
									{/if}
								</div>
							</td>
							<td>
								<div class="metric-badge" class:good={item.difficulty_index >= 0.3 && item.difficulty_index <= 0.7} class:warning={item.difficulty_index < 0.3 || item.difficulty_index > 0.7}>
									{item.difficulty_index?.toFixed(2) || 'N/A'}
								</div>
							</td>
							<td>
								<div class="metric-badge" class:good={item.discrimination >= 0.3} class:warning={item.discrimination < 0.3 && item.discrimination >= 0.2} class:bad={item.discrimination < 0.2}>
									{item.discrimination?.toFixed(2) || 'N/A'}
								</div>
							</td>
							<td>
								<div class="metric-badge" class:good={item.plausibility_index >= 0.2} class:warning={item.plausibility_index < 0.2}>
									{item.plausibility_index?.toFixed(2) || 'N/A'}
								</div>
							</td>
							<td>{item.attempts?.toLocaleString() || 0}</td>
							<td>
								<div class="accuracy-cell">
									<div class="accuracy-bar">
										<div class="accuracy-fill" style="width: {item.attempts > 0 ? (item.correct / item.attempts * 100) : 0}%"></div>
									</div>
									<div class="accuracy-text">
										{item.attempts > 0 ? ((item.correct / item.attempts) * 100).toFixed(1) : 0}%
									</div>
								</div>
							</td>
							<td>
								<span class="difficulty-badge {item.q_difficulty}">
									{item.q_difficulty}
								</span>
							</td>
							<td>
								<span class="bloom-badge">
									{item.q_bloom_level}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Bottom Pagination -->
		{#if totalPages > 1}
			<div class="bottom-pagination">
				<div class="pagination">
					<button
						type="button"
						class="pagination-button"
						on:click={() => changePage(currentPage - 1)}
						disabled={currentPage === 1}
					>
						Previous
					</button>

					{#if currentPage > 2}
						<button type="button" class="pagination-button" on:click={() => changePage(1)}>1</button>
						{#if currentPage > 3}
							<span class="pagination-ellipsis">...</span>
						{/if}
					{/if}

					{#if currentPage > 1}
						<button type="button" class="pagination-button" on:click={() => changePage(currentPage - 1)}>{currentPage - 1}</button>
					{/if}

					<button type="button" class="pagination-button active">{currentPage}</button>

					{#if currentPage < totalPages}
						<button type="button" class="pagination-button" on:click={() => changePage(currentPage + 1)}>{currentPage + 1}</button>
					{/if}

					{#if currentPage < totalPages - 1}
						{#if currentPage < totalPages - 2}
							<span class="pagination-ellipsis">...</span>
						{/if}
						<button type="button" class="pagination-button" on:click={() => changePage(totalPages)}>{totalPages}</button>
					{/if}

					<button
						type="button"
						class="pagination-button"
						on:click={() => changePage(currentPage + 1)}
						disabled={currentPage === totalPages}
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Container */
	.analysis-container {
		min-height: 100vh;
		background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
		padding: 2rem 1rem;
		padding-top: 5rem;
		font-family: 'Inter', sans-serif;
	}

	/* Loading & Error States */
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
		border-top-color: #a855f7;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}

	.error-card svg {
		color: #ef4444;
		margin-bottom: 1.5rem;
	}

	.error-message {
		font-size: 1rem;
		color: #dc2626;
		margin: 0;
	}

	/* Header */
	.page-header {
		max-width: 1400px;
		margin: 0 auto 2rem;
	}

	.header-content h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.header-content p {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}



	/* Filters */
	.filters-card {
		max-width: 1400px;
		margin: 0 auto 2rem;
		background: #ffffff;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.filters-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.filters-header h2 {
		font-size: 1.25rem;
		font-weight: 700;
		color: #111827;
		margin: 0;
	}

	.reset-button {
		padding: 0.5rem 1rem;
		background: #f3f4f6;
		color: #6b7280;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.reset-button:hover {
		background: #e5e7eb;
		border-color: #d1d5db;
	}

	.filters-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
	}

	.filter-group select {
		padding: 0.625rem;
		background: #faf9fc;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.875rem;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-group select:hover:not(:disabled) {
		border-color: #c4b5fd;
	}

	.filter-group select:focus {
		outline: none;
		border-color: #a78bfa;
		background: #ffffff;
	}

	.filter-group select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Results Header */
	.results-header {
		max-width: 1400px;
		margin: 0 auto 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.results-info {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pagination-button {
		padding: 0.5rem 0.875rem;
		background: #ffffff;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
	}

	.pagination-button:hover:not(:disabled):not(.active) {
		background: #f3f0ff;
		border-color: #c4b5fd;
		color: #a78bfa;
	}

	.pagination-button.active {
		background: linear-gradient(135deg, #c4b5fd, #a78bfa);
		border-color: #a78bfa;
		color: #ffffff;
	}

	.pagination-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-ellipsis {
		color: #9ca3af;
		font-weight: 600;
	}

	.bottom-pagination {
		max-width: 1400px;
		margin: 2rem auto 0;
		display: flex;
		justify-content: center;
	}

	/* Table */
	.table-container {
		max-width: 1400px;
		margin: 0 auto;
		background: #ffffff;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
	}

	.data-table thead {
		background: #f9fafb;
		border-bottom: 2px solid #e5e7eb;
	}

	.data-table th {
		padding: 1rem;
		text-align: left;
		font-size: 0.75rem;
		font-weight: 700;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.data-table th.sortable {
		cursor: pointer;
		user-select: none;
	}

	.data-table th.sortable:hover {
		background: #f3f4f6;
	}

	.th-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sort-indicator {
		color: #a78bfa;
		font-size: 1rem;
	}

	.data-table td {
		padding: 1rem;
		border-top: 1px solid #f3f4f6;
		font-size: 0.875rem;
		color: #374151;
	}

	.data-table tbody tr:hover {
		background: #faf9fc;
	}

	.bank-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bank-name {
		font-weight: 600;
		color: #111827;
	}

	.bank-slug {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.taxonomy-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.topic {
		font-weight: 500;
		color: #111827;
	}

	.subtopic {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.metric-badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.metric-badge.good {
		background: #e8f5ee;
		color: #4a7c59;
	}

	.metric-badge.warning {
		background: #fef6e8;
		color: #a68950;
	}

	.metric-badge.bad {
		background: #fce8e8;
		color: #9c5555;
	}

	.accuracy-cell {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.accuracy-bar {
		flex: 1;
		height: 8px;
		background: #f3f4f6;
		border-radius: 4px;
		overflow: hidden;
	}

	.accuracy-fill {
		height: 100%;
		background: linear-gradient(90deg, #a78bfa, #8b5cf6);
		border-radius: 4px;
		transition: width 0.3s;
	}

	.accuracy-text {
		font-weight: 600;
		color: #111827;
		min-width: 45px;
	}

	.difficulty-badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.difficulty-badge.easy {
		background: #e8f5ee;
		color: #4a7c59;
	}

	.difficulty-badge.medium {
		background: #fef6e8;
		color: #a68950;
	}

	.difficulty-badge.hard {
		background: #fce8e8;
		color: #9c5555;
	}

	.bloom-badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		background: #f3f0ff;
		color: #a78bfa;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	/* Mobile Responsiveness */
	@media (max-width: 768px) {
		.analysis-container {
			padding: 1rem 0.75rem;
			padding-top: 4rem;
		}

		.aggregations-grid {
			grid-template-columns: 1fr;
		}

		.filters-grid {
			grid-template-columns: 1fr;
		}

		.results-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.table-container {
			overflow-x: auto;
		}

		.data-table {
			min-width: 1200px;
		}
	}
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>
