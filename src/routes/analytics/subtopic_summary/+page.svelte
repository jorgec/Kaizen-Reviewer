<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { supabase } from '$lib/supabaseClient';

	let user: any = null;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	let loading = true;
	let error = '';

	// Raw API rows
	let summary: any[] = [];

	// Collapsible help section
	let showHelp = false;

	// Grouped structure: Subject -> Topic -> Subtopics
	type SubtopicRow = {
		subject_id: number;
		subject_name: string;
		topic_id: number;
		topic_name: string;
		subtopic_id: number;
		subtopic_name: string;
		distinct_items_30d: number;
		attempts_30d: number;
		correct_30d: number;
		accuracy: number; // 0..1 from API, convert to %
		stability_wilson_hw?: number | null;
		avg_rt_ms?: number | null;
		sd_rt_ms?: number | null;
		ewm_accuracy?: number | null;
	};

	type TopicGroup = {
		topic_id: number;
		topic_name: string;
		attempts_30d: number;
		correct_30d: number;
		distinct_items_30d: number;
		accuracyPct: number; // computed %
		subtopics: SubtopicRow[];
		expanded: boolean;
	};

	type SubjectGroup = {
		subject_id: number;
		subject_name: string;
		attempts_30d: number;
		correct_30d: number;
		distinct_items_30d: number;
		accuracyPct: number; // computed %
		topics: TopicGroup[];
		expanded: boolean;
	};

	let grouped: SubjectGroup[] = [];

	// Reactive statement: fetch data whenever discipline changes
	$: if (user?.user_id && user?.currentDiscipline?.discipline_id) {
		fetchSummary();
	}

	async function fetchSummary() {
		if (!user?.user_id || !user?.currentDiscipline?.discipline_id) return;

		loading = true;
		error = '';

		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_user_subtopic_summary_ewm', {
				p_user_id: user.user_id,
				p_discipline_id: user.currentDiscipline.discipline_id,
				p_half_life_days: 30
			});
			if (rpcError) throw rpcError;

			summary = Array.isArray(data) ? data : [];

			grouped = buildGroups(summary);
		} catch (e: any) {
			error = e?.message || 'Failed to load summary.';
			summary = [];
			grouped = [];
		} finally {
			loading = false;
		}
	}

	function buildGroups(rows: any[]): SubjectGroup[] {
		// subject -> topic -> subtopics
		const subjectsMap = new Map<number, SubjectGroup>();

		for (const r of rows) {
			const subject_id = Number(r.subject_id);
			const topic_id = Number(r.topic_id);

			const subtopicRow: SubtopicRow = {
				subject_id,
				subject_name: r.subject_name,
				topic_id,
				topic_name: r.topic_name,
				subtopic_id: Number(r.subtopic_id),
				subtopic_name: r.subtopic_name,
				distinct_items_30d: Number(r.distinct_items_30d ?? 0),
				attempts_30d: Number(r.attempts_30d ?? 0),
				correct_30d: Number(r.correct_30d ?? 0),
				accuracy: Number(r.accuracy ?? 0), // API gives fraction
				stability_wilson_hw: r.stability_wilson_hw ?? null,
				avg_rt_ms: r.avg_rt_ms ?? null,
				sd_rt_ms: r.sd_rt_ms ?? null,
				ewm_accuracy: r.ewm_accuracy
			};

			// subject
			let subj = subjectsMap.get(subject_id);
			if (!subj) {
				subj = {
					subject_id,
					subject_name: r.subject_name,
					attempts_30d: 0,
					correct_30d: 0,
					distinct_items_30d: 0,
					accuracyPct: 0,
					topics: [],
					expanded: false
				};
				subjectsMap.set(subject_id, subj);
			}

			// topic
			let topic = subj.topics.find((t) => t.topic_id === topic_id);
			if (!topic) {
				topic = {
					topic_id,
					topic_name: r.topic_name,
					attempts_30d: 0,
					correct_30d: 0,
					distinct_items_30d: 0,
					accuracyPct: 0,
					subtopics: [],
					expanded: false
				};
				subj.topics.push(topic);
			}

			// push subtopic
			topic.subtopics.push(subtopicRow);

			// accumulate topic
			topic.attempts_30d += subtopicRow.attempts_30d;
			topic.correct_30d += subtopicRow.correct_30d;
			topic.distinct_items_30d += subtopicRow.distinct_items_30d;

			// accumulate subject
			subj.attempts_30d += subtopicRow.attempts_30d;
			subj.correct_30d += subtopicRow.correct_30d;
			subj.distinct_items_30d += subtopicRow.distinct_items_30d;
		}

		// finalize accuracies
		for (const subj of subjectsMap.values()) {
			for (const topic of subj.topics) {
				topic.accuracyPct = pct(topic.correct_30d, topic.attempts_30d);
			}
			subj.accuracyPct = pct(subj.correct_30d, subj.attempts_30d);
		}

		// sort for stability
		return Array.from(subjectsMap.values()).sort((a, b) =>
			a.subject_name.localeCompare(b.subject_name)
		);
	}

	function pct(correct: number, attempts: number) {
		if (!attempts) return 0;
		return Math.min(100, Math.max(0, (correct / attempts) * 100));
	}

	function fmtPct(x: number, maxDecimals = 2) {
		return Number.isFinite(x) ? Number(x.toFixed(maxDecimals)) : 0;
	}

	function fmtNum(x: number | null | undefined, maxDecimals = 2, divBy = 1) {
		if (x == null) return '';
		const n = Number(x) / divBy;
		return Number.isFinite(n) ? n.toFixed(maxDecimals) : '';
	}

	function getAccuracyColor(pctVal: number): string {
		// Returns subtle color based on performance (matching calendar colors but muted)
		if (pctVal >= 90) return '#81d4c4'; // muted cyan
		if (pctVal >= 85) return '#7ba894'; // muted teal
		if (pctVal >= 80) return '#a8c8d9'; // muted light blue
		if (pctVal >= 75) return '#f5c97f'; // muted amber
		if (pctVal >= 50) return '#e8a876'; // muted orange
		if (pctVal >= 30) return '#d88888'; // muted red
		return '#d88888'; // muted red for very low
	}

	function rowClassByAccuracy(pctVal: number) {
		// pctVal is in 0..100
		if (pctVal >= 90) return 'row-high';
		if (pctVal >= 75) return 'row-good';
		if (pctVal >= 50) return 'row-fair';
		return 'row-low';
	}

	function toggleSubject(subj: SubjectGroup) {
		// mutate then replace array reference to trigger reactivity
		subj.expanded = !subj.expanded;
		grouped = [...grouped];
	}

	function toggleTopic(topic: TopicGroup) {
		topic.expanded = !topic.expanded;
		// find parent subject and refresh reference chain to ensure DOM updates
		grouped = grouped.map(s => {
			const hasTopic = s.topics.some(t => t.topic_id === topic.topic_id);
			return hasTopic ? { ...s, topics: [...s.topics] } : s;
		});

	}

	let showModal = false;
	let modalLoading = false;
	let modalData: any[] = [];
	let modalTitle = '';

	async function openDrilldown(level: string, ids: any, label: string) {
		if (!user?.user_id) return;
		showModal = true;
		modalLoading = true;
		modalTitle = label;
		modalData = [];

		const payload = {
			p_user_id: user.user_id,
			p_subject_id: null,
			p_topic_id: null,
			p_subtopic_id: null
		};

		if (level === 'subject') payload.p_subject_id = ids.subject_id;
		if (level === 'topic') payload.p_topic_id = ids.topic_id;
		if (level === 'subtopic') payload.p_subtopic_id = ids.subtopic_id;

		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_user_taxonomy_drilldown', payload);
			if (rpcError) throw rpcError;
			modalData = data || [];
		} catch (err: any) {
			modalData = [];
			modalTitle = 'Error loading details';
			console.error(err);
		} finally {
			modalLoading = false;
		}
	}

	function closeModal() {
		showModal = false;
		modalData = [];
		modalTitle = '';
	}
</script>

<div class="analytics-container">
	<div class="analytics-wrapper">
		<!-- Header -->
		<div class="analytics-header">
			<div class="header-content">
				<div class="title-group">
					<h1 class="analytics-title">Subtopic Performance Analysis</h1>
					<p class="analytics-subtitle">Recency-weighted mastery across subjects, topics, and subtopics (30-day window)</p>
				</div>
				<button class="help-toggle-btn" on:click={() => (showHelp = !showHelp)} type="button">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
						<line x1="12" y1="17" x2="12.01" y2="17"></line>
					</svg>
					<span>{showHelp ? 'Hide' : 'Show'} Guide</span>
				</button>
			</div>
		</div>

		<!-- Help Section (Collapsible) -->
		{#if showHelp}
			<div class="help-panel">
				<div class="help-content">
					<h3 class="help-title">Understanding This Report</h3>
					<p class="help-description">
						This view shows your performance across the subject taxonomy using exponentially-weighted moving averages.
						Recent attempts count more than older ones, giving you a current picture of mastery that responds quickly to improvement or decay.
					</p>

					<div class="help-sections">
						<div class="help-section">
							<h4 class="help-section-title">Stability (Wilson HW)</h4>
							<p class="help-text">
								Half-width of the 95% Wilson confidence interval. Lower values = more reliable accuracy estimate.
							</p>
							<ul class="help-list">
								<li><strong>&lt; 0.05:</strong> Strong stability</li>
								<li><strong>&lt; 0.10:</strong> Decent stability</li>
								<li><strong>0.10–0.20:</strong> Moderate stability</li>
								<li><strong>&gt; 0.20:</strong> Low stability (noisy data)</li>
							</ul>
						</div>

						<div class="help-section">
							<h4 class="help-section-title">EWM Accuracy</h4>
							<p class="help-text">
								Exponentially-weighted mean of correctness. Shows current mastery, not lifetime average.
							</p>
							<ul class="help-list">
								<li><strong>≥ 0.85:</strong> Strong mastery → advance difficulty</li>
								<li><strong>0.70–0.84:</strong> Solid → mixed practice</li>
								<li><strong>0.55–0.69:</strong> Emerging → focused practice</li>
								<li><strong>&lt; 0.55:</strong> Struggling → remediate</li>
							</ul>
						</div>

						<div class="help-section">
							<h4 class="help-section-title">Patterns to Watch</h4>
							<ul class="help-list">
								<li><strong>High EWM + Low HW:</strong> Confident mastery</li>
								<li><strong>High EWM + High HW:</strong> Small sample, gather more data</li>
								<li><strong>Low EWM + Low HW:</strong> Consistently weak, intervene</li>
								<li><strong>EWM ≫ accuracy:</strong> Recent improvement trend</li>
								<li><strong>EWM ≪ accuracy:</strong> Recent regression/forgetting</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		{/if}
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p class="loading-text">Loading performance data...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<p class="error-text">{error}</p>
			</div>
		{:else if grouped.length === 0}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="9" y1="9" x2="15" y2="15"></line>
					<line x1="15" y1="9" x2="9" y2="15"></line>
				</svg>
				<p class="empty-text">No performance data available for the past 30 days.</p>
			</div>
		{:else}
			<div class="data-card">
				<div class="table-wrapper">
					<table class="modern-analytics-table">
						<thead>
							<tr>
								<th class="col-taxonomy">Subject / Topic / Subtopic</th>
								<th class="col-number">Items</th>
								<th class="col-number">Attempts</th>
								<th class="col-number">Correct</th>
								<th class="col-number">Accuracy</th>
								<th class="col-number">Stability</th>
								<th class="col-number">EWM</th>
							</tr>
						</thead>
						<tbody>
					{#each grouped as subj (subj.subject_id)}
						<tr class="subject-row {rowClassByAccuracy(subj.accuracyPct)}" style="border-left: 4px solid {getAccuracyColor(subj.accuracyPct)}">
							<td class="col-taxonomy">
								<div class="taxonomy-cell level-subject">
									<button class="expand-btn" type="button" on:click={() => toggleSubject(subj)} aria-label="Toggle subject">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class:rotated={subj.expanded}>
											<polyline points="9 18 15 12 9 6"></polyline>
										</svg>
									</button>
									<span class="taxonomy-name">{subj.subject_name}</span>
								</div>
							</td>
							<td class="col-number">{subj.distinct_items_30d}</td>
							<td class="col-number">{subj.attempts_30d}</td>
							<td class="col-number">{subj.correct_30d}</td>
							<td class="col-number">
								<span class="accuracy-badge" style="background: {getAccuracyColor(subj.accuracyPct)}20; color: {getAccuracyColor(subj.accuracyPct)}; border: 1px solid {getAccuracyColor(subj.accuracyPct)}40">
									{fmtPct(subj.accuracyPct)}%
								</span>
							</td>
							<td class="col-number">—</td>
							<td class="col-number">—</td>
						</tr>

						{#if subj.expanded}
							{#each subj.topics as topic (topic.topic_id)}
								<tr class="topic-row {rowClassByAccuracy(topic.accuracyPct)}" style="border-left: 4px solid {getAccuracyColor(topic.accuracyPct)}">
									<td class="col-taxonomy">
										<div class="taxonomy-cell level-topic">
											<button class="expand-btn" type="button" on:click={() => toggleTopic(topic)} aria-label="Toggle topic">
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class:rotated={topic.expanded}>
													<polyline points="9 18 15 12 9 6"></polyline>
												</svg>
											</button>
											<span class="taxonomy-name">{topic.topic_name}</span>
										</div>
									</td>
									<td class="col-number">{topic.distinct_items_30d}</td>
									<td class="col-number">{topic.attempts_30d}</td>
									<td class="col-number">{topic.correct_30d}</td>
									<td class="col-number">
										<span class="accuracy-badge" style="background: {getAccuracyColor(topic.accuracyPct)}20; color: {getAccuracyColor(topic.accuracyPct)}; border: 1px solid {getAccuracyColor(topic.accuracyPct)}40">
											{fmtPct(topic.accuracyPct)}%
										</span>
									</td>
									<td class="col-number">—</td>
									<td class="col-number">—</td>
								</tr>

								{#if topic.expanded}
									{#each topic.subtopics as st (st.subtopic_id)}
										<tr class="subtopic-row {rowClassByAccuracy((st.accuracy ?? 0) * 100)}" style="border-left: 4px solid {getAccuracyColor((st.accuracy ?? 0) * 100)}">
											<td class="col-taxonomy">
												<div class="taxonomy-cell level-subtopic">
													<button
														class="subtopic-link"
														type="button"
														on:click={() => openDrilldown('subtopic', st, st.subtopic_name)}
													>
														{st.subtopic_name}
														<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
															<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
															<polyline points="15 3 21 3 21 9"></polyline>
															<line x1="10" y1="14" x2="21" y2="3"></line>
														</svg>
													</button>
												</div>
											</td>
											<td class="col-number">{st.distinct_items_30d}</td>
											<td class="col-number">{st.attempts_30d}</td>
											<td class="col-number">{st.correct_30d}</td>
											<td class="col-number">
												<span class="accuracy-badge" style="background: {getAccuracyColor((st.accuracy ?? 0) * 100)}20; color: {getAccuracyColor((st.accuracy ?? 0) * 100)}; border: 1px solid {getAccuracyColor((st.accuracy ?? 0) * 100)}40">
													{fmtPct((st.accuracy ?? 0) * 100)}%
												</span>
											</td>
											<td class="col-number">
												{#if st.stability_wilson_hw != null}
													<span class="metric-value">{Number(st.stability_wilson_hw).toFixed(4)}</span>
												{:else}
													<span class="no-data">—</span>
												{/if}
											</td>
											<td class="col-number">
												{#if st.ewm_accuracy != null}
													<span class="metric-value">{fmtNum(st.ewm_accuracy, 3)}</span>
												{:else}
													<span class="no-data">—</span>
												{/if}
											</td>
										</tr>
									{/each}
								{/if}
							{/each}
						{/if}
					{/each}
					</tbody>
				</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ================= Modal ================= -->
{#if showModal}
	<div class="modern-modal-overlay" on:click={closeModal}>
		<div class="modern-modal-card" on:click={(e) => e.stopPropagation()}>
			<div class="modern-modal-header">
				<h3 class="modern-modal-title">{modalTitle}</h3>
				<button class="modern-close-btn" type="button" on:click={closeModal} aria-label="Close modal">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="modern-modal-body">
				{#if modalLoading}
					<div class="modal-loading">
						<div class="spinner"></div>
						<p>Loading details...</p>
					</div>
				{:else if modalData.length === 0}
					<div class="modal-empty">
						<p>No questions found for this category.</p>
					</div>
				{:else}
					<div class="questions-list">
						{#each modalData as q, idx}
							<div class="question-item">
								<div class="question-header-row">
									<span class="question-number">Q{idx + 1}</span>
									<span class="difficulty-badge difficulty-{q.difficulty}">
										{q.difficulty || 'unknown'}
									</span>
								</div>
								<p class="question-stem">{q.stem}</p>

								{#if q.responses && q.responses.length > 0}
									<div class="responses-section">
										<h4 class="responses-title">Your Responses ({q.responses.length})</h4>
										<div class="response-cards">
											{#each q.responses as r}
												<div class="response-card {r.is_correct ? 'correct' : 'incorrect'}">
													<div class="response-choice">
														<span class="choice-label">{r.choice_label}</span>
														<span class="choice-text">{r.choice_text}</span>
													</div>
													<div class="response-meta">
														<span class="response-date">{new Date(r.answered_at).toLocaleString()}</span>
														<span class="response-status">
															{#if r.is_correct}
																<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
																	<polyline points="20 6 9 17 4 12"></polyline>
																</svg>
																Correct
															{:else}
																<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
																	<line x1="18" y1="6" x2="6" y2="18"></line>
																	<line x1="6" y1="6" x2="18" y2="18"></line>
																</svg>
																Incorrect
															{/if}
														</span>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{:else}
									<p class="no-responses">No responses yet</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
    /* Container */
    .analytics-container {
        min-height: 100vh;
        background: linear-gradient(135deg, #faf9fc 0%, #f5f3f7 100%);
        padding: 2rem 1rem;
    }

    .analytics-wrapper {
        max-width: 1400px;
        margin: 0 auto;
    }

    /* Header */
    .analytics-header {
        background: #ffffff;
        border-radius: 16px;
        padding: 2rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(139, 92, 246, 0.1);
    }

    .header-content {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 2rem;
    }

    .title-group {
        flex: 1;
    }

    .analytics-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.75rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 0.5rem 0;
    }

    .analytics-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #6b7280;
        margin: 0;
        line-height: 1.5;
    }

    .help-toggle-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        background: linear-gradient(135deg, #a855f7, #8b5cf6);
        color: #ffffff;
        border: none;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
        flex-shrink: 0;
    }

    .help-toggle-btn:hover {
        background: linear-gradient(135deg, #9333ea, #7c3aed);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    /* Help Panel */
    .help-panel {
        background: #ffffff;
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(139, 92, 246, 0.15);
        animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .help-content {
        max-width: 100%;
    }

    .help-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #111827;
        margin: 0 0 1rem 0;
    }

    .help-description {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #4b5563;
        line-height: 1.6;
        margin: 0 0 1.5rem 0;
    }

    .help-sections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
    }

    .help-section {
        background: linear-gradient(135deg, #faf9fc, #f9f8fb);
        border-radius: 10px;
        padding: 1.25rem;
        border: 1px solid rgba(139, 92, 246, 0.1);
    }

    .help-section-title {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #8b5cf6;
        margin: 0 0 0.75rem 0;
    }

    .help-text {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.5;
        margin: 0 0 0.75rem 0;
    }

    .help-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .help-list li {
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        color: #4b5563;
        line-height: 1.6;
        padding: 0.25rem 0;
    }

    .help-list li strong {
        color: #111827;
        font-weight: 600;
    }

    /* Loading/Error/Empty States */
    .loading-state,
    .error-state,
    .empty-state {
        background: #ffffff;
        border-radius: 12px;
        padding: 3rem 2rem;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #f3f4f6;
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 1rem;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .loading-text,
    .error-text,
    .empty-text {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #6b7280;
        margin: 0;
    }

    .error-state svg {
        color: #ef4444;
        margin-bottom: 1rem;
    }

    .empty-state svg {
        color: #9ca3af;
        margin-bottom: 1rem;
    }

    /* Data Card */
    .data-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .table-wrapper {
        overflow-x: auto;
    }

    /* Modern Table */
    .modern-analytics-table {
        width: 100%;
        border-collapse: collapse;
        font-family: 'Inter', sans-serif;
    }

    .modern-analytics-table thead {
        background: linear-gradient(135deg, #faf9fc, #f5f3f7);
        border-bottom: 2px solid rgba(139, 92, 246, 0.1);
    }

    .modern-analytics-table thead th {
        padding: 1rem;
        text-align: left;
        font-size: 0.8125rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .modern-analytics-table thead th.col-number {
        text-align: right;
    }

    .modern-analytics-table tbody tr {
        border-bottom: 1px solid #f3f4f6;
        transition: all 0.15s ease;
    }

    .modern-analytics-table tbody tr:hover {
        background: #faf9fc;
    }

    .modern-analytics-table tbody td {
        padding: 0.875rem 1rem;
        font-size: 0.875rem;
        color: #374151;
    }

    .modern-analytics-table tbody td.col-number {
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: #6b7280;
    }

    /* Row Styling by Accuracy */
    .row-low {
        background: rgba(216, 136, 136, 0.05);
    }

    .row-fair {
        background: rgba(232, 168, 118, 0.05);
    }

    .row-good {
        background: rgba(245, 201, 127, 0.05);
    }

    .row-high {
        background: rgba(129, 212, 196, 0.05);
    }

    .row-low:hover {
        background: rgba(216, 136, 136, 0.08) !important;
    }

    .row-fair:hover {
        background: rgba(232, 168, 118, 0.08) !important;
    }

    .row-good:hover {
        background: rgba(245, 201, 127, 0.08) !important;
    }

    .row-high:hover {
        background: rgba(129, 212, 196, 0.08) !important;
    }

    /* Hierarchy Levels */
    .subject-row {
        font-weight: 600;
    }

    .topic-row {
        font-weight: 500;
    }

    .subtopic-row {
        font-weight: 400;
    }

    /* Taxonomy Cell */
    .taxonomy-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .taxonomy-cell.level-subject {
        padding-left: 0;
    }

    .taxonomy-cell.level-topic {
        padding-left: 1.5rem;
    }

    .taxonomy-cell.level-subtopic {
        padding-left: 3rem;
    }

    .taxonomy-name {
        font-family: 'Inter', sans-serif;
        color: #111827;
    }

    /* Expand Button */
    .expand-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
        color: #9ca3af;
    }

    .expand-btn:hover {
        background: rgba(139, 92, 246, 0.1);
        color: #8b5cf6;
    }

    .expand-btn svg {
        transition: transform 0.2s ease;
    }

    .expand-btn svg.rotated {
        transform: rotate(90deg);
    }

    /* Subtopic Link */
    .subtopic-link {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        background: transparent;
        border: none;
        padding: 0;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #6366f1;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s ease;
    }

    .subtopic-link:hover {
        color: #4f46e5;
        text-decoration: underline;
    }

    .subtopic-link svg {
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .subtopic-link:hover svg {
        opacity: 1;
    }

    /* Accuracy Badge */
    .accuracy-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.375rem 0.75rem;
        border-radius: 6px;
        font-size: 0.8125rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }

    .metric-value {
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 0.8125rem;
        color: #374151;
        font-weight: 500;
    }

    .no-data {
        color: #d1d5db;
    }

    /* Modal Styles */
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
        z-index: 1000;
        padding: 2rem;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .modern-modal-card {
        background: #ffffff;
        border-radius: 16px;
        width: 100%;
        max-width: 900px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: modalSlideUp 0.3s ease;
    }

    @keyframes modalSlideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .modern-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #f3f4f6;
    }

    .modern-modal-title {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 700;
        color: #111827;
        margin: 0;
    }

    .modern-close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #9ca3af;
    }

    .modern-close-btn:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .modern-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
    }

    .modal-loading,
    .modal-empty {
        text-align: center;
        padding: 3rem 2rem;
    }

    .modal-loading .spinner {
        margin: 0 auto 1rem;
    }

    .modal-loading p,
    .modal-empty p {
        font-family: 'Inter', sans-serif;
        color: #6b7280;
        margin: 0;
    }

    /* Questions List */
    .questions-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .question-item {
        background: linear-gradient(135deg, #faf9fc, #f9f8fb);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid rgba(139, 92, 246, 0.1);
    }

    .question-header-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .question-number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #a855f7, #8b5cf6);
        color: #ffffff;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 700;
    }

    .difficulty-badge {
        padding: 0.375rem 0.875rem;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 600;
        text-transform: capitalize;
    }

    .difficulty-badge.difficulty-easy {
        background: rgba(16, 185, 129, 0.15);
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .difficulty-badge.difficulty-medium {
        background: rgba(245, 158, 11, 0.15);
        color: #d97706;
        border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .difficulty-badge.difficulty-hard {
        background: rgba(239, 68, 68, 0.15);
        color: #dc2626;
        border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .difficulty-badge.difficulty-unknown {
        background: rgba(156, 163, 175, 0.15);
        color: #6b7280;
        border: 1px solid rgba(156, 163, 175, 0.3);
    }

    .question-stem {
        font-family: 'Inter', sans-serif;
        font-size: 0.9375rem;
        color: #111827;
        line-height: 1.6;
        margin: 0 0 1.25rem 0;
    }

    .responses-section {
        margin-top: 1.25rem;
    }

    .responses-title {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
        margin: 0 0 0.75rem 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .response-cards {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .response-card {
        background: #ffffff;
        border-radius: 8px;
        padding: 1rem;
        border: 1px solid #e5e7eb;
    }

    .response-card.correct {
        border-left: 3px solid #10b981;
        background: rgba(16, 185, 129, 0.02);
    }

    .response-card.incorrect {
        border-left: 3px solid #ef4444;
        background: rgba(239, 68, 68, 0.02);
    }

    .response-choice {
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .choice-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        background: linear-gradient(135deg, #a855f7, #8b5cf6);
        color: #ffffff;
        border-radius: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0 0.375rem;
        flex-shrink: 0;
    }

    .choice-text {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #374151;
        line-height: 1.5;
        flex: 1;
    }

    .response-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 0.75rem;
        border-top: 1px solid #f3f4f6;
    }

    .response-date {
        font-family: 'Inter', sans-serif;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .response-status {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .response-card.correct .response-status {
        color: #10b981;
    }

    .response-card.incorrect .response-status {
        color: #ef4444;
    }

    .no-responses {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        color: #9ca3af;
        font-style: italic;
        margin: 1rem 0 0 0;
    }

    /* Mobile Responsiveness */
    @media (max-width: 768px) {
        .analytics-container {
            padding: 1rem 0.5rem;
        }

        .analytics-header {
            padding: 1.5rem;
        }

        .header-content {
            flex-direction: column;
            gap: 1rem;
        }

        .analytics-title {
            font-size: 1.5rem;
        }

        .analytics-subtitle {
            font-size: 0.875rem;
        }

        .help-sections {
            grid-template-columns: 1fr;
        }

        .modern-analytics-table {
            font-size: 0.8125rem;
        }

        .modern-analytics-table thead th,
        .modern-analytics-table tbody td {
            padding: 0.75rem 0.5rem;
        }

        .taxonomy-cell.level-topic {
            padding-left: 1rem;
        }

        .taxonomy-cell.level-subtopic {
            padding-left: 2rem;
        }

        .modern-modal-overlay {
            padding: 1rem;
        }

        .modern-modal-body {
            padding: 1.5rem;
        }

        .question-item {
            padding: 1rem;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>