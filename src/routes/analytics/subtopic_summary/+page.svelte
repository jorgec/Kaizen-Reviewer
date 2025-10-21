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
			const { data, error: rpcError } = await supabase.rpc('rpc_user_subtopic_summary', {
				p_user_id: user.user_id,
				p_discipline_id: selectedDiscipline || null
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
				sd_rt_ms: r.sd_rt_ms ?? null
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
		const n = Number(x)/divBy;
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
</script>

<section class="section">
	<div class="container">
		<div class="header-row">
			<h2 class="title is-4 mb-0">Subtopic Summary</h2>
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
						<th class="has-text-right"><span style="font-size:  .8rem;">Avg</span></th>
						<th class="has-text-right"><span style="font-size:  .8rem;">SD</span></th>
					</tr>
					</thead>
					<tbody>
					{#each grouped as subj (subj.subject_id)}
						<tr class={rowClassByAccuracy(subj.accuracyPct)}>
							<td>
								<button class="toggle-btn" type="button" on:click={() => toggleSubject(subj)}
												aria-label="Toggle subject">
									{subj.expanded ? '−' : '+'}
								</button>
								{subj.subject_name}
							</td>
							<td></td>
							<td></td>
							<td class="has-text-right">{subj.distinct_items_30d}</td>
							<td class="has-text-right">{subj.attempts_30d}</td>
							<td class="has-text-right">{subj.correct_30d}</td>
							<td class="has-text-right">{fmtPct(subj.accuracyPct)}</td>
							<td class="has-text-right"></td>
							<td class="has-text-right"></td>
							<td class="has-text-right"></td>
						</tr>

						{#if subj.expanded}
							{#each subj.topics as topic (topic.topic_id)}
								<tr class={rowClassByAccuracy(topic.accuracyPct)}>
									<td></td>
									<td>
										<div class="indent-1">
											<button class="toggle-btn" type="button" on:click={() => toggleTopic(topic)}
															aria-label="Toggle topic">
												{topic.expanded ? '−' : '+'}
											</button>
											{topic.topic_name}
										</div>
									</td>
									<td></td>
									<td class="has-text-right">{topic.distinct_items_30d}</td>
									<td class="has-text-right">{topic.attempts_30d}</td>
									<td class="has-text-right">{topic.correct_30d}</td>
									<td class="has-text-right">{fmtPct(topic.accuracyPct)}</td>
									<td class="has-text-right"></td>
									<td class="has-text-right"></td>
									<td class="has-text-right"></td>
								</tr>

								{#if topic.expanded}
									{#each topic.subtopics as st (st.subtopic_id)}
										<tr class={rowClassByAccuracy((st.accuracy ?? 0) * 100)}>
											<td></td>
											<td></td>
											<td>
												<div class="indent-2">{st.subtopic_name}</div>
											</td>
											<td class="has-text-right">{st.distinct_items_30d}</td>
											<td class="has-text-right">{st.attempts_30d}</td>
											<td class="has-text-right">{st.correct_30d}</td>
											<td class="has-text-right">{fmtPct((st.accuracy ?? 0) * 100)}</td>
											<td class="has-text-right">
												{st.stability_wilson_hw != null ? Number(st.stability_wilson_hw).toFixed(4) : ''}
											</td>
											<td class="has-text-right">{fmtNum(st.avg_rt_ms, 2, 1000)}s</td>
											<td class="has-text-right">{fmtNum(st.sd_rt_ms, 2, 1000)}s</td>
										</tr>
									{/each}
								{/if}
							{/each}
						{/if}
					{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>

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
    }

    .toggle-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        font-weight: 700;
        margin-right: 0.5rem;
        width: 1.5rem;
        height: 1.5rem;
        line-height: 1.5rem;
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
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>