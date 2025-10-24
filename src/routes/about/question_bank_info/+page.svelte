<script lang="ts">

	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';

	let loading = true;
	let error: string | null = null;
	let data: any = null;
	let user: any;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	async function loadData() {
		try {
			loading = true;
			const result = await supabase.rpc('rpc_get_user_bank_summary', {
				p_user_id: user.user_id,
				p_org_id: user.orgs?.[0]?.org_id
			});

			if (result.error) {
				error = result.error.message;
			} else {
				data = result.data;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}


	onMount(async () => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		loadData();
	});

</script>

<svelte:head>
	<title>Question Bank Info | Kaizen</title>
	<meta name="description" content="Overview of the Question Bank Database" />
</svelte:head>

<main class="min-h-screen bg-gray-50 text-gray-800">
	<section class="section">
		<div class="container py-0">
			<header class="mb-6">
				<h1 class="text-3xl font-bold text-[#a855f7]">
					Question Bank Info
				</h1>
				<p class="text-gray-500 mt-1">
					Overview of the Question Bank Database you have access to
				</p>
			</header>


			{#if loading}
				<div class="p-4 text-center text-gray-500 animate-pulse">
					Loading Question Bank Info data...
				</div>
			{:else if error}
				<div class="p-4 bg-red-100 text-red-700 rounded-md">
					Error: {error}
				</div>
			{:else if data}
				<div class="data-wrapper">
					<!-- Summary Cards -->
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-icon disciplines">
								<svg xmlns="http://www.w3.org/2000/svg"
										 width="128" height="128" viewBox="0 0 64 64"
										 fill="none" stroke="currentColor" stroke-width="4"
										 stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="book over shield">
									<!-- outer U / shield -->
									<path d="M12 24
           C12 42 22 52 32 56
           C42 52 52 42 52 24"/>

									<!-- inner U -->
									<path d="M18 24
           C18 38 25 44 32 48
           C39 44 46 38 46 24"/>

									<!-- book spine -->
									<path d="M32 12 L32 40"/>

									<!-- book left page outline -->
									<path d="M32 40
           C26 38 22 34 22 28
           L22 16
           C22 12 28 10 32 12"/>

									<!-- book right page outline -->
									<path d="M32 40
           C38 38 42 34 42 28
           L42 16
           C42 12 36 10 32 12"/>
								</svg>
							</div>
							<div class="stat-content">
								<div class="stat-label">Total Disciplines</div>
								<div class="stat-value">{data.disciplines?.length || 0}</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="stat-icon banks">
								<svg xmlns="http://www.w3.org/2000/svg"
										 width="128" height="128" viewBox="0 0 64 64"
										 fill="none" stroke="currentColor" stroke-width="4"
										 stroke-linecap="round" stroke-linejoin="round"
										 role="img" aria-label="two-drawer cabinet icon">
									<!-- Outer rounded cabinet -->
									<rect x="8" y="6" width="48" height="52" rx="14"/>

									<!-- Middle divider -->
									<path d="M8 32h48"/>

									<!-- Handles -->
									<path d="M26 20h12"/>
									<path d="M26 44h12"/>
								</svg>
							</div>
							<div class="stat-content">
								<div class="stat-label">Question Banks</div>
								<div class="stat-value">
									{data.disciplines?.reduce((sum, d) => sum + (d.banks?.length || 0), 0) || 0}
								</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="stat-icon questions">
								<svg xmlns="http://www.w3.org/2000/svg"
										 width="128" height="128" viewBox="0 0 64 64"
										 fill="none" stroke="currentColor" stroke-width="5.5"
										 stroke-linecap="round" stroke-linejoin="round"
										 role="img" aria-label="question mark in rounded box">
									<!-- Rounded square -->
									<rect x="7.5" y="7.5" width="49" height="49" rx="12"/>

									<!-- Question mark -->
									<path d="M24 24c0-4.5 3.8-8 8.5-8s8.5 2.9 8.5 7c0 6-8.5 6.2-8.5 12.5"/>
									<circle cx="32.5" cy="46.5" r="2.8"/>
								</svg>
							</div>
							<div class="stat-content">
								<div class="stat-label">Total Questions</div>
								<div class="stat-value">
									{data.disciplines?.reduce((sum, d) =>
										sum + (d.banks?.reduce((bankSum, b) => bankSum + (b.question_count || 0), 0) || 0), 0) || 0}
								</div>
							</div>
						</div>
					</div>

					<!-- Disciplines Section -->
					{#if data.disciplines && data.disciplines.length > 0}
						{#each data.disciplines as discipline}
							<div class="discipline-section">
								<div class="discipline-header">
									<div>
										<h2 class="discipline-title">{discipline.name}</h2>
										<div class="discipline-code">{discipline.code}</div>
									</div>
								</div>

								<!-- Banks -->
								{#if discipline.banks && discipline.banks.length > 0}
									<div class="banks-grid">
										{#each discipline.banks as bank}
											<div class="bank-card">
												<div class="bank-header">
													<h3 class="bank-title">{bank.name}</h3>
													<div class="bank-question-count">{bank.question_count} questions</div>
												</div>

												<!-- Difficulty Distribution -->
												<div class="distribution-section">
													<div class="distribution-title">Difficulty Distribution</div>
													<div class="difficulty-bars">
														{#if bank.by_difficulty}
															<div class="difficulty-item">
																<div class="difficulty-label">
																	<span class="difficulty-dot easy"></span>
																	Easy
																</div>
																<div class="difficulty-bar-container">
																	<div
																		class="difficulty-bar easy"
																		style="width: {(bank.by_difficulty.easy / bank.question_count * 100).toFixed(1)}%"
																	></div>
																</div>
																<div class="difficulty-count">{bank.by_difficulty.easy}</div>
															</div>
															<div class="difficulty-item">
																<div class="difficulty-label">
																	<span class="difficulty-dot medium"></span>
																	Medium
																</div>
																<div class="difficulty-bar-container">
																	<div
																		class="difficulty-bar medium"
																		style="width: {(bank.by_difficulty.medium / bank.question_count * 100).toFixed(1)}%"
																	></div>
																</div>
																<div class="difficulty-count">{bank.by_difficulty.medium}</div>
															</div>
															<div class="difficulty-item">
																<div class="difficulty-label">
																	<span class="difficulty-dot hard"></span>
																	Hard
																</div>
																<div class="difficulty-bar-container">
																	<div
																		class="difficulty-bar hard"
																		style="width: {(bank.by_difficulty.hard / bank.question_count * 100).toFixed(1)}%"
																	></div>
																</div>
																<div class="difficulty-count">{bank.by_difficulty.hard}</div>
															</div>
														{/if}
													</div>
												</div>

												<!-- Bloom's Taxonomy -->
												<div class="distribution-section">
													<div class="distribution-title">Bloom's Taxonomy</div>
													<div class="bloom-grid">
														{#if bank.by_bloom}
															{#each Object.entries(bank.by_bloom) as [level, count]}
																{#if count > 0 && level !== 'unknown'}
																	<div class="bloom-badge">
																		<div class="bloom-level">{level}</div>
																		<div class="bloom-count">{count}</div>
																	</div>
																{/if}
															{/each}
														{/if}
													</div>
												</div>

												<!-- Subjects -->
												{#if bank.subjects && bank.subjects.length > 0}
													<div class="subjects-section">
														<div class="distribution-title">Subjects</div>
														{#each bank.subjects as subject}
															<div class="subject-item">
																<div class="subject-header">
																	<span class="subject-name">{subject.subject_name}</span>
																	<span class="subject-count">{subject.question_count} questions</span>
																</div>

																<!-- Topics -->
																{#if subject.topics && subject.topics.length > 0}
																	<div class="topics-list">
																		{#each subject.topics as topic}
																			<div class="topic-item">
																				<div class="topic-name">{topic.topic_name}</div>
																				<div class="topic-count">{topic.question_count}</div>
																			</div>
																		{/each}
																	</div>
																{/if}
															</div>
														{/each}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</section>


</main>

<style>
    main {
        font-family: Inter, system-ui, sans-serif;
        background: linear-gradient(135deg, #faf5ff 0%, #f3f4f6 100%);
    }

    h1 {
        color: #a855f7;
    }

    .data-wrapper {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    /* Stats Grid */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .stat-card {
        background: white;
        border-radius: 16px;
        padding: 1.75rem;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.06);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(168, 85, 247, 0.08);
    }

    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(168, 85, 247, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08);
    }

    .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        flex-shrink: 0;
    }

    .stat-icon.disciplines {
        background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%);
        color: #7c3aed;
    }

    .stat-icon.banks {
        background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
        color: #6d28d9;
    }

    .stat-icon.questions {
        background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
        color: #5b21b6;
    }

    .stat-content {
        flex: 1;
    }

    .stat-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .stat-value {
        font-size: 2rem;
        font-weight: 700;
        color: #1f2937;
        margin-top: 0.25rem;
        background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Discipline Section */
    .discipline-section {
        background: white;
        border-radius: 20px;
        padding: 2rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(168, 85, 247, 0.08);
    }

    .discipline-header {
        margin-bottom: 1.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid rgba(168, 85, 247, 0.1);
    }

    .discipline-title {
        font-size: 1.75rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 0.5rem 0;
    }

    .discipline-code {
        display: inline-block;
        background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%);
        color: #7c3aed;
        padding: 0.375rem 1rem;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.05em;
    }

    /* Banks Grid */
    .banks-grid {
        display: grid;
        gap: 1.5rem;
    }

    .bank-card {
        background: linear-gradient(135deg, #faf5ff 0%, #ffffff 100%);
        border-radius: 16px;
        padding: 1.75rem;
        border: 1px solid rgba(168, 85, 247, 0.12);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .bank-card:hover {
        border-color: rgba(168, 85, 247, 0.25);
        box-shadow: 0 4px 12px rgba(168, 85, 247, 0.08);
    }

    .bank-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid rgba(168, 85, 247, 0.1);
    }

    .bank-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
    }

    .bank-question-count {
        background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
        color: #6d28d9;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
    }

    /* Distribution Sections */
    .distribution-section {
        margin-top: 1.5rem;
    }

    .distribution-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 1rem;
    }

    /* Difficulty Bars */
    .difficulty-bars {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .difficulty-item {
        display: grid;
        grid-template-columns: 100px 1fr 50px;
        align-items: center;
        gap: 1rem;
    }

    .difficulty-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #4b5563;
    }

    .difficulty-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .difficulty-dot.easy {
        background: #10b981;
    }

    .difficulty-dot.medium {
        background: #f59e0b;
    }

    .difficulty-dot.hard {
        background: #ef4444;
    }

    .difficulty-bar-container {
        background: #f3f4f6;
        border-radius: 8px;
        height: 8px;
        overflow: hidden;
    }

    .difficulty-bar {
        height: 100%;
        border-radius: 8px;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .difficulty-bar.easy {
        background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
    }

    .difficulty-bar.medium {
        background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
    }

    .difficulty-bar.hard {
        background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
    }

    .difficulty-count {
        text-align: right;
        font-weight: 600;
        color: #1f2937;
        font-size: 0.875rem;
    }

    /* Bloom's Taxonomy */
    .bloom-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    }

    .bloom-badge {
        background: white;
        border: 1.5px solid rgba(168, 85, 247, 0.2);
        border-radius: 10px;
        padding: 0.625rem 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        transition: all 0.2s ease;
    }

    .bloom-badge:hover {
        border-color: rgba(168, 85, 247, 0.4);
        background: linear-gradient(135deg, #faf5ff 0%, #ffffff 100%);
        transform: translateY(-1px);
    }

    .bloom-level {
        font-size: 0.75rem;
        font-weight: 600;
        color: #7c3aed;
        text-transform: capitalize;
    }

    .bloom-count {
        font-size: 1.125rem;
        font-weight: 700;
        color: #1f2937;
    }

    /* Subjects */
    .subjects-section {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(168, 85, 247, 0.1);
    }

    .subject-item {
        background: white;
        border-radius: 12px;
        padding: 1.25rem;
        margin-bottom: 1rem;
        border: 1px solid rgba(168, 85, 247, 0.1);
    }

    .subject-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .subject-name {
        font-weight: 600;
        color: #1f2937;
        font-size: 1rem;
    }

    .subject-count {
        background: linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%);
        color: #7c3aed;
        padding: 0.375rem 0.875rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    /* Topics */
    .topics-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
    }

    .topic-item {
        background: linear-gradient(135deg, #faf5ff 0%, #f9fafb 100%);
        border-radius: 8px;
        padding: 0.875rem 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid rgba(168, 85, 247, 0.08);
        transition: all 0.2s ease;
    }

    .topic-item:hover {
        border-color: rgba(168, 85, 247, 0.2);
        background: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%);
    }

    .topic-name {
        font-size: 0.875rem;
        color: #4b5563;
        font-weight: 500;
    }

    .topic-count {
        background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%);
        color: white;
        padding: 0.25rem 0.625rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
    }

    /* Loading State */
    .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    /* Responsive */
    @media (max-width: 768px) {
        .stats-grid {
            grid-template-columns: 1fr;
        }

        .difficulty-item {
            grid-template-columns: 90px 1fr 40px;
        }

        .topics-list {
            grid-template-columns: 1fr;
        }
    }
</style>