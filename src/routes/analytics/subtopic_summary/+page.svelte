<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { supabase } from '$lib/supabaseClient';

	let user: any = null;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	let loading = true;
	let error = '';

	// Discipline selector
	let disciplines: Array<{ id?: string; name?: string } | string> = [];
	let selectedDiscipline: string = '';

	// Raw API rows
	let summary: any[] = [];

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

	onMount(async () => {
		try {
			// populate discipline options from stored user
			disciplines = Array.isArray(user?.disciplines) ? user.disciplines : [];
			if (disciplines.length > 0) {
				const first = disciplines[0] as any;
				selectedDiscipline = typeof first === 'string' ? first : (first.discipline_id ?? first.discipline_name ?? '');
			}
			await fetchSummary();
		} catch (e: any) {
			error = e?.message || 'Failed to load page.';
		} finally {
			loading = false;
		}
	});

	async function fetchSummary() {
		if (!user?.user_id) return;

		loading = true;
		error = '';

		try {
			const { data, error: rpcError } = await supabase.rpc('rpc_user_subtopic_summary_ewm', {
				p_user_id: user.user_id,
				p_discipline_id: selectedDiscipline || null,
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

	function rowClassByAccuracy(pctVal: number) {
		// pctVal is in 0..100
		if (pctVal >= 90) return `row-high score-${pctVal}`;
		if (pctVal >= 75) return `row-good score-${pctVal}`;
		if (pctVal >= 41) return `row-fair score-${pctVal}`;
		if (pctVal < 40) return `row-low score-${pctVal}`;
		return '';
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

<section class="section">
	<div class="container">
		<div class="header-row">
			<h2 class="title is-4 mb-0">Learner × Skill (subtopic) with Recency-Weighted Mastery (EWM-Acc)</h2>

			<div class="controls">
				<div class="select is-small">
					<select bind:value={selectedDiscipline} on:change={fetchSummary} aria-label="Select Discipline">
						{#if disciplines.length === 0}
							<option value="">No disciplines</option>
						{:else}
							{#each disciplines as d, i}
								<option value={typeof d === 'string' ? d : (d.discipline_id ?? d.discipline_name ?? String(i))}>
									{typeof d === 'string' ? d : (d.discipline_name ?? d.discipline_id ?? `Discipline ${i + 1}`)}
								</option>
							{/each}
						{/if}
					</select>
				</div>
			</div>
		</div>
		<h3 class="subtitle">A per-user weak/strong map with both level and stability, taking the user’s 0/1 correctness over time and computing an exponentially weighted mean of those outcomes—so recent answers get more weight than older ones.</h3>
		{#if loading}
			<p>Loading...</p>
		{:else if error}
			<p class="has-text-danger">{error}</p>
		{:else if grouped.length === 0}
			<p>No data to display.</p>
		{:else}
			<div class="summary-grid">
				<table class="table is-fullwidth is-hoverable">
					<thead class="th-small">
					<tr>
						<th style="width: 22%"><span style="font-size:  .8rem;">Subject</span></th>
						<th style="width: 22%"><span style="font-size:  .8rem;">Topic</span></th>
						<th style="width: 22%"><span style="font-size:  .8rem;">Subtopic</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">Distinct (30d)</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">Attempts (30d)</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">Correct (30d)</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">Accuracy %</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">Stability (HW)</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">EWM</span></th>
					</tr>
					</thead>
					<tbody>
					{#each grouped as subj (subj.subject_id)}
						<tr class={rowClassByAccuracy(subj.accuracyPct)}>
							<td colspan="3">
								<button class="toggle-btn" type="button" on:click={() => toggleSubject(subj)}
												aria-label="Toggle subject">
									{subj.expanded ? '−' : '+'}
								</button>
										{subj.subject_name}
							</td>
							<td class="has-text-right">{subj.distinct_items_30d}</td>
							<td class="has-text-right">{subj.attempts_30d}</td>
							<td class="has-text-right">{subj.correct_30d}</td>
							<td class="has-text-right">{fmtPct(subj.accuracyPct)}</td>
							<td class="has-text-right"></td>
							<td class="has-text-right"></td>
						</tr>

						{#if subj.expanded}
							{#each subj.topics as topic (topic.topic_id)}
								<tr class={rowClassByAccuracy(topic.accuracyPct)}>
									<td></td>
									<td colspan="2">
										<div class="indent-1">
											<button class="toggle-btn" type="button" on:click={() => toggleTopic(topic)}
															aria-label="Toggle topic">
												{topic.expanded ? '−' : '+'}
											</button>
											{topic.topic_name}
										</div>
									</td>
									<td class="has-text-right">{topic.distinct_items_30d}</td>
									<td class="has-text-right">{topic.attempts_30d}</td>
									<td class="has-text-right">{topic.correct_30d}</td>
									<td class="has-text-right">{fmtPct(topic.accuracyPct)}</td>
									<td class="has-text-right"></td>
									<td class="has-text-right"></td>
								</tr>

								{#if topic.expanded}
									{#each topic.subtopics as st (st.subtopic_id)}
										<tr class={rowClassByAccuracy((st.accuracy ?? 0) * 100)}>
											<td></td>
											<td></td>
											<td>
												<div class="indent-2">
													<span
														on:click={() => openDrilldown('subtopic', st, st.subtopic_name)}
														style="cursor:pointer;">
															{st.subtopic_name}
													</span>
												</div>
											</td>
											<td class="has-text-right">{st.distinct_items_30d}</td>
											<td class="has-text-right">{st.attempts_30d}</td>
											<td class="has-text-right">{st.correct_30d}</td>
											<td class="has-text-right">{fmtPct((st.accuracy ?? 0) * 100)}</td>
											<td class="has-text-right">
												{st.stability_wilson_hw != null ? Number(st.stability_wilson_hw).toFixed(4) : ''}
											</td>
											<td class="has-text-right">{fmtNum(st.ewm_accuracy, 2)}</td>
										</tr>
									{/each}
								{/if}
							{/each}
						{/if}
					{/each}
					</tbody>
				</table>
			</div>
			<div class="has-mw-5xl mx-auto mb-20 px-8 mt-4 is-small is-size-6" style="font-size: 80% !important;">
				<h3 class="title is-3">How to Read <code class="mono">stability_wilson_hw</code> and EWM</h3>


					<p class="lead">
						<strong><span class="mono">stability_wilson_hw</span></strong> is the half-width of the 95% Wilson score confidence interval
						for a user’s accuracy on a topic/subtopic. Think of it as an uncertainty radius around the measured accuracy:
						the smaller it is, the more <em>stable</em> (reliable) the accuracy.
					</p>


				<div class="content">
					<p class="mono">Example: accuracy = 0.70 and stability_wilson_hw = 0.088 ⇒ Wilson 95% CI ≈ [0.612, 0.781]</p>
					<p>Smaller half-width (HW) ⇒ more confidence that the “true” accuracy is close to the observed value.
						HW shrinks with more attempts and is largest near <span class="mono">p̂ ≈ 0.5</span>.</p>
				</div>


				<h3 class="title is-6">Quick rule of thumb (UI)</h3>
				<ul class="content">
					<li><span class="tag is-danger is-light mono">HW &gt; 0.20</span> → very noisy (low stability)</li>
					<li><span class="tag is-warning is-light mono">0.10–0.20</span> → moderate stability</li>
					<li><span class="tag is-success is-light mono">&lt; 0.10</span> → decent stability</li>
					<li><span class="tag is-primary is-light mono">&lt; 0.05</span> → strong stability</li>
				</ul>

				<hr class="rule">

				<h3 class="title is-5">What EWM tells you (at a glance)</h3>
				<div class="content">
					<ul>
						<li><strong>Value range:</strong> 0.00–1.00 (or 0–100%). Higher = better recent mastery.</li>
						<li><strong>Recency bias:</strong> Newer attempts count more (controlled by your chosen half-life).</li>
						<li><strong>Responsiveness:</strong> EWM moves faster than raw accuracy; it reflects current skill, not lifetime history.</li>
					</ul>
				</div>

				<h3 class="title is-6">Suggested interpretation bands</h3>
				<table class="table is-striped is-fullwidth is-hoverable is-small">
					<thead>
					<tr class="is-size-7">
						<th class="mono is-size-7">EWM accuracy</th>
						<th class="is-size-7">Meaning</th>
						<th class="is-size-7">Recommended action</th>
					</tr>
					</thead>
					<tbody>
					<tr class="is-size-7">
						<td class="mono is-size-7">≥ 0.85</td>
						<td class="is-size-7">Strong mastery</td>
						<td class="is-size-7">Advance difficulty; occasional review</td>
					</tr>
					<tr class="is-size-7">
						<td class="mono is-size-7">0.70–0.84</td>
						<td class="is-size-7">Solid but improvable</td>
						<td class="is-size-7">Mixed practice; a few targeted items</td>
					</tr>
					<tr class="is-size-7">
						<td class="mono is-size-7">0.55–0.69</td>
						<td class="is-size-7">Emerging</td>
						<td class="is-size-7">Focused practice; scaffolded hints</td>
					</tr>
					<tr class="is-size-7">
						<td class="mono is-size-7">&lt; 0.55</td>
						<td class="is-size-7">Struggling</td>
						<td class="is-size-7">Remediate; revisit prerequisites</td>
					</tr>
					</tbody>
				</table>

				<hr class="rule">

				<h3 class="title is-5">How half-life affects interpretation</h3>
				<div class="content">
					<ul>
						<li><strong>Short</strong> (e.g., 7 days): reacts quickly; great for cramming/rapid change, but volatile.</li>
						<li><strong>Medium</strong> (≈ 30 days): balanced; good general default.</li>
						<li><strong>Long</strong> (≥ 60–90 days): slow-moving; closer to smoothed long-term mastery.</li>
					</ul>
				</div>

				<h2 class="title is-5">Patterns to look for</h2>
				<div class="content">
					<ul>
						<li><strong>High EWM + Low stability HW:</strong> confident mastery now → promote difficulty.</li>
						<li><strong>High EWM + High stability HW:</strong> possibly lucky streak / small sample → gather a few more items.</li>
						<li><strong>Low EWM + Low stability HW:</strong> consistently weak → intervene.</li>
						<li><strong>Dropping EWM (week-over-week):</strong> skill decay → schedule spaced review.</li>
						<li><strong>EWM ≫ raw accuracy:</strong> recent improvement.</li>
						<li><strong>EWM ≪ raw accuracy:</strong> regression/forgetting; recent misses outweigh older success.</li>
					</ul>
				</div>
			</div>
		{/if}
	</div>
</section>

<!-- ================= Modal ================= -->
{#if showModal}
	<div class="modal is-active">
		<div class="modal-background" on:click={closeModal}></div>
		<div class="modal-card large-modal">
			<header class="modal-card-head">
				<p class="modal-card-title">{modalTitle}</p>
				<button class="delete" aria-label="close" on:click={closeModal}></button>
			</header>

			<section class="modal-card-body scrollable-body">
				{#if modalLoading}
					<p>Loading details...</p>
				{:else if modalData.length === 0}
					<p>No questions found for this category.</p>
				{:else}
					<table class="table is-fullwidth is-hoverable">
						<thead>
						<tr>
							<th style="width: 45%">Question</th>
							<th>Difficulty</th>
							<th>Responses</th>
						</tr>
						</thead>
						<tbody>
						{#each modalData as q}
							<tr>
								<td>{q.stem}</td>
								<td>
										<span
											class="tag"
											class:easy={q.difficulty === 'easy'}
											class:medium={q.difficulty === 'medium'}
											class:hard={q.difficulty === 'hard'}
										>
											{q.difficulty}
										</span>
								</td>

								<td>
									{#if q.responses && q.responses.length > 0}
										<ul class="response-list">
											{#each q.responses as r}
												<li class={r.is_correct ? 'has-text-success' : 'has-text-danger'}>
													<strong>{r.choice_label}</strong> — {r.choice_text}
													<br />
													<small>{new Date(r.answered_at).toLocaleString()}</small>
													<span class="ml-2">{r.is_correct ? '✅' : '❌'}</span>
												</li>
											{/each}
										</ul>
									{:else}
										<em class="has-text-grey-light">No responses yet</em>
									{/if}
								</td>
							</tr>
						{/each}
						</tbody>
					</table>
				{/if}
			</section>
		</div>
	</div>
{/if}

<style>
    .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        gap: 1rem;
        font-size: 1.125rem;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .summary-grid {
        overflow-x: auto;
    }

    .summary-grid table th {
        font-size: 1rem !important;
    }

    .summary-grid table td {
        font-size: .875rem !important;
				line-height: .85rem !important;
    }

    .toggle-btn {
        line-height: .85rem !important;
        background: transparent;
        border: none;
        cursor: pointer;
        font-weight: 700;
        margin-right: 0.5rem;
        text-align: center;
        border-radius: 4px;
        color: inherit;
    }

    .indent-1 {
        /*padding-left: 1rem;*/
    }

    .indent-2 {
        /*padding-left: 2rem;*/
    }

    /* Accuracy color bands */
    .row-low {
        background-color: rgba(236, 62, 44, 0.2);
    }

    .row-fair {
        background-color: rgba(255, 152, 0, 0.2);
    }

    .row-good {
        background-color: rgba(255, 214, 0, 0.2);
    }

    .row-high {
        background-color: rgba(0, 191, 174, 0.2);
    }

    /* Keep hover readable with Bulma */
    table.table.is-hoverable tbody tr:hover {
        filter: brightness(0.98);
    }

    .modal-card.large-modal {
        width: 90vw;
        max-width: 1200px;
        height: 80vh;
        display: flex;
        flex-direction: column;
    }

    .scrollable-body {
        overflow-y: auto;
        padding: 1rem;
    }

    .response-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .response-list li {
        margin-bottom: 0.5rem;
        line-height: 1.4em;
    }

    .modal-card-title {
        font-weight: 600;
        font-size: 1.4rem;
    }

    .tag.easy { background-color: #2a9d8f; color: #fff; }
    .tag.medium { background-color: #f4a261; color: #1d1d1d; }
    .tag.hard { background-color: #e76f51; color: #fff; }

    @media (max-width: 768px) {
        .modal-card.large-modal {
            width: 95vw;
            height: 85vh;
        }
        .aptitude-table th,
        .aptitude-table td {
            font-size: 1.1rem;
            padding: 1rem 0.75rem;
        }
        table.is-fullwidth {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
        }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>