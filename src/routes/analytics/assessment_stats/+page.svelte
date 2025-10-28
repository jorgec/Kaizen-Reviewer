<script lang="ts">


	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	// import { computeInsights, toKPIBadges, toTableRows } from './utils';
	import { computeInsights, toKPIBadges, toTableRows, toAdvicePills, bandFromLB, msToSec } from './utils.js';

	let loading = true;
	let error: string | null = null;
	let data: any = null;
	let user: any;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	let insights: any = null;
	let kpiBadges: any[] = [];
	let strengthsTable: any[] = [];
	let weaknessesTable: any[] = [];
	let gapsTable: any[] = [];
	let slowTable: any[] = [];
	let workNextTable: any[] = [];
	let adviceChips: any[] = [];
	let byAssessmentTypeTable: any[] = [];
	let byBloomLevelTable: any[] = [];
	let bySubjectTable: any[] = [];

	let showLBTooltip = false;
	let showLBModal = false;

	// replace your existing lbPctNumber/lbPctLabel lines with:
	$: lbPctNumber = Number(((insights?.overall?.wilsonLB95 ?? 0) * 100));
	$: lbPctLabel  = `${(Math.round(lbPctNumber * 10) / 10).toFixed(1)}%`;

	async function loadData() {
		try {
			loading = true;
			error = null;
			const result = await supabase.rpc('rpc_get_user_test_stats', {
				p_user_id: user.user_id,
				p_discipline_id: user.currentDiscipline?.discipline_id
			});

			if (result.error) {
				error = result.error.message;
				data = null;
				return;
			}

			data = result.data;

			insights = computeInsights(result.data, {
				minAttempts: 5,
				strongWilsonLB: 0.80,
				weakWilsonLB: 0.50,
				slowMedianMs: 30000,
				topN: 8
			});

			kpiBadges = toKPIBadges(insights.overall);
			strengthsTable = toTableRows(insights.strengths);
			weaknessesTable = toTableRows(insights.weaknesses);
			gapsTable = toTableRows(insights.lowSampleGaps);
			slowTable = toTableRows(insights.slowOutliers);
			workNextTable = toTableRows(insights.highAttemptsLowAccuracy);
			adviceChips = toAdvicePills(insights);

			byAssessmentTypeTable = toTableRows(insights.byAssessmentType);
			byBloomLevelTable   = toTableRows(insights.byBloomLevel);
			bySubjectTable      = toTableRows(insights.bySubject);

			console.log(strengthsTable);


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

	onMount(() => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		loadData();
	});


</script>

<svelte:head>
	<title>My Stats | Kaizen</title>
	<meta name="description" content="My Assessment Stats" />
</svelte:head>

<main class="p-6 min-h-screen bg-gray-50 text-gray-800">
	<section class="section infographic">
		{#if loading}
			<div class="ig-skeleton">
				<div class="ig-skel-hero"></div>
				<div class="ig-skel-row"></div>
				<div class="ig-skel-row"></div>
			</div>
		{:else if error}
			<div class="ig-error">
				<strong>We hit a snag:</strong> {error}
			</div>
		{:else}
			<!-- HERO STRIP -->
			<div class="ig-hero">
				<div class="ig-hero-left">
					<div class="ig-eyebrow">Confidence-weighted score (LB)</div>
					<div class="ig-hero-score">
						<span class="ig-score">{lbPctLabel}</span>
					</div>
					<div class="ig-hero-meta">
						<li><strong>Attempts:</strong> {insights?.overall?.attempts ?? 0}</li>
						<li><strong>Median pace:</strong> {msToSec(insights?.overall?.medianRtMs ?? 0)}s</li>
					</div>
					<div class="ig-pills">
						{#each adviceChips as chip}
						<span class="ig-pill" data-tone={chip.tone}>
							{chip.text}
						</span>
						{/each}
					</div>
				</div>
				<div class="ig-hero-art" aria-hidden="true">
					<svg viewBox="0 0 240 160" class="ig-blob">
						<defs>
							<linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
								<stop offset="0%" stop-color="#a855f7"/>
								<stop offset="100%" stop-color="#6366f1"/>
							</linearGradient>
						</defs>
						<path fill="url(#g1)" opacity="0.25" d="M10 90c20-60 100-110 150-60s40 110-20 120-130-10-130-60z"/>
						<circle cx="170" cy="40" r="8" fill="#a855f7" opacity="0.5"/>
						<circle cx="200" cy="60" r="5" fill="#6366f1" opacity="0.5"/>
					</svg>
					<a
						class="ig-ring"
						tabindex="0"
						role="button"
						aria-label={`Confidence score, LB ${lbPctLabel}`}
						title={`LB ${lbPctLabel} — click for details`}
						on:mouseenter={() => (showLBTooltip = true)}
						on:mouseleave={() => (showLBTooltip = false)}
						on:focus={() => (showLBTooltip = true)}
						on:blur={() => (showLBTooltip = false)}
						on:click={() => (showLBModal = true)}
					>
						<svg viewBox="0 0 120 120">
							<circle cx="60" cy="60" r="50" class="ring-bg"/>
							{#if Number.isFinite(lbPctNumber) && lbPctNumber > 0}
								<circle cx="60" cy="60" r="50" class="ring-fg" style="--pct:{lbPctNumber};"/>
							{/if}
						</svg>
						<div class="ig-ring-label">LB</div>

						{#if showLBTooltip}
							<div class="ig-tooltip">
								<div class="ig-tip-row"><span>LB</span><strong>{lbPctLabel}</strong></div>
								<div class="ig-tip-row"><span>Attempts</span><strong>{insights?.overall?.attempts ?? 0}</strong></div>
								<div class="ig-tip-row"><span>Median pace</span><strong>{msToSec(insights?.overall?.medianRtMs ?? 0)}s</strong></div>
								<div class="ig-tip-footer">Click for an explainer</div>
							</div>
						{/if}
					</a>
				</div>
			</div>

			<!-- KPI STRIP -->
			<div class="ig-kpis">
				{#each kpiBadges as k}
					<div class="ig-kpi">
						<div class="ig-kpi-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24"><path d="M4 20h16M7 17V7m5 10V4m5 13v-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
						</div>
						<div class="ig-kpi-body">
							<div class="ig-kpi-label">{k.label}</div>
							<div class="ig-kpi-value">{k.value}</div>
						</div>
					</div>
				{/each}
			</div>
			{#if strengthsTable.length > 0}
				<h3 class=" my-4 mx-0">Where you're doing great</h3>
				<div class="aggregations-grid">
					{#each strengthsTable as str}
					<div class="agg-card">
						<div class="agg-icon">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
								<polyline points="14 2 14 8 20 8"></polyline>
							</svg>
						</div>
						<div class="agg-content">
							<div class="agg-label">{str.label}</div>
							<div class="agg-value">{str.wilsonLB}</div>
							<div class="ig-card-metrics is-size-7">
								<div class="m-pair"><span>Accuracy</span><strong>{str.accuracy}</strong></div>
								<div class="m-pair"><span>Attempts</span><strong>{str.attempts}</strong></div>
								<div class="m-pair"><span>RT</span><strong>{str.medianRT}</strong></div>
							</div>
						</div>
					</div>
						{/each}
				</div>
			{/if}
			{#if weaknessesTable.length > 0}
				<h3 class=" my-4 mx-0">Where you need to focus on</h3>
				<div class="aggregations-grid">
					{#each weaknessesTable as str}
						<div class="agg-card">
							<div class="agg-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
									<polyline points="14 2 14 8 20 8"></polyline>
								</svg>
							</div>
							<div class="agg-content">
								<div class="agg-label">{str.label}</div>
								<div class="agg-value">{str.wilsonLB}</div>
								<div class="ig-card-metrics is-size-7">
									<div class="m-pair"><span>Accuracy</span><strong>{str.accuracy}</strong></div>
									<div class="m-pair"><span>Attempts</span><strong>{str.attempts}</strong></div>
									<div class="m-pair"><span>RT</span><strong>{str.medianRT}</strong></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- PERFORMANCE BY DIMENSIONS -->
			<div class="ig-panels">
				<div class="ig-panel">
					<h3>By Assessment Type</h3>
					<div class="ig-cards">
						{#each byAssessmentTypeTable as r}
							<div class="ig-card">
								<div class="ig-card-top">
									<div class="ig-card-title">{r.label}</div>
									<span class="ig-badge">{bandFromLB(parseFloat(r.wilsonLB) / 100)}</span>
								</div>
								<div class="ig-card-metrics is-size-7">
									<div class="m-pair"><span>Accuracy</span><strong>{r.accuracy}</strong></div>
									<div class="m-pair"><span>Attempts</span><strong>{r.attempts}</strong></div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="ig-panel">
					<h3>By Bloom Level</h3>
					<div class="ig-cards">
						{#each byBloomLevelTable as r}
							<div class="ig-card">
								<div class="ig-card-top">
									<div class="ig-card-title">{r.label}</div>
									<span class="ig-badge">{bandFromLB(parseFloat(r.wilsonLB) / 100)}</span>
								</div>
								<div class="ig-card-metrics is-size-7">
									<div class="m-pair"><span>Accuracy</span><strong>{r.accuracy}</strong></div>
									<div class="m-pair"><span>Attempts</span><strong>{r.attempts}</strong></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			{#if showLBModal}
				<div class="ig-modal-backdrop" on:click={() => (showLBModal = false)}></div>
				<div class="ig-modal" role="dialog" aria-modal="true" aria-label="What is LB?">
					<div class="ig-modal-card">
						<div class="ig-modal-header">
							<h3>What is LB?</h3>
							<button class="ig-close" on:click={() => (showLBModal = false)} aria-label="Close">×</button>
						</div>
						<div class="ig-modal-body">
							<p><strong>LB</strong> is the <em>Wilson 95% confidence lower bound</em> of your accuracy. It’s a conservative score that accounts for uncertainty from limited attempts. Higher LB means you’re consistently correct enough that the score is statistically trustworthy.</p>
							<ul>
								<li><strong>LB shown:</strong> {lbPctLabel}</li>

								<li><strong>Median pace:</strong> {msToSec(insights?.overall?.medianRtMs ?? 0)}s</li>
							</ul>
						</div>
						<div class="ig-modal-footer">
							<button class="ig-primary" on:click={() => (showLBModal = false)}>Got it</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</section>

</main>

<style>
    main {
        font-family: Inter, system-ui, sans-serif;
    }

    h1 {
        color: #a855f7;
    }

    a {
        color: #14b8a6;
    }

    a:hover {
        color: #8b5cf6;
    }

		.aggregations-grid{
				min-width: 100%;
		}

    /* ——— Infographic styles ——— */
    .section.infographic { padding: 0; }
    .ig-hero { display:flex; align-items:center; justify-content:space-between; gap:2rem; background:linear-gradient(135deg, rgba(168,85,247,.08), rgba(99,102,241,.08)); border:1px solid rgba(168,85,247,.25); border-radius:16px; padding:1.25rem 1.25rem 1.5rem; position:relative; overflow:hidden; }
    .ig-hero-left { position:relative; z-index:1; }
    .ig-eyebrow { font-size:.85rem; letter-spacing:.02em; color:#6b7280; margin-bottom:.25rem; }
    .ig-hero-score { line-height:1; }
    .ig-score { font-size:3rem; font-weight:800; background:linear-gradient(135deg,#a855f7,#6366f1); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
    .ig-hero-meta { margin-top:.35rem; color:#6b7280; display:flex; gap:.5rem; align-items:center; font-size:.9rem; }
    .ig-pills { margin-top:.75rem; display:flex; flex-wrap:wrap; gap:.5rem; }
    .ig-pill { padding:.45rem .65rem; border-radius:999px; font-size:.8rem; font-weight:600; border:1px solid rgba(0,0,0,.06); background:white; color:#374151; box-shadow:0 1px 2px rgba(0,0,0,.06); }
    .ig-pill[data-tone='pro']{ background:linear-gradient(135deg,#ecfeff,#eef2ff); color:#334155; }
    .ig-pill[data-tone='focus']{ background:linear-gradient(135deg,#fff7ed,#fef3c7); color:#7a5c00; }
    .ig-hero-art { position:relative; width:280px; min-width:240px; height:160px; display:flex; align-items:center; justify-content:center; }
    .ig-blob { position:absolute; inset:0; width:100%; height:100%; }
    .ig-ring { position:relative; width:120px; height:120px; }
    .ig-ring .ring-bg { fill:none; stroke:rgba(99,102,241,.2); stroke-width:10; }
    .ig-ring .ring-fg { fill:none; stroke:url(#g1); stroke-width:10; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; stroke-dasharray: 314; /* ~2πr with r=50 */ stroke-dashoffset: calc(314 - (var(--pct, 0) * 3.14)); }
    .ig-ring-label { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:700; color:#6366f1; }

    .ig-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:0.75rem; margin-top:1rem; }
    .ig-kpi { display:flex; gap:.75rem; align-items:center; padding:.85rem; background:white; border:1px solid rgba(0,0,0,.06); border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,.05); }
    .ig-kpi-icon { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#f5f3ff,#eef2ff); color:#7c3aed; display:flex; align-items:center; justify-content:center; }
    .ig-kpi-body .ig-kpi-label { font-size:.8rem; color:#6b7280; }
    .ig-kpi-body .ig-kpi-value { font-size:1.15rem; font-weight:700; }

    .ig-panels { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1.25rem; }
    .ig-panel { background:white; border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:1rem; box-shadow:0 4px 10px rgba(0,0,0,.05); }
    .ig-panel h3 { margin:0 0 .5rem; font-weight:700; color:#374151; font-size:1rem; }
    .ig-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:.75rem; }
    .ig-card { border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:.9rem; background:linear-gradient(180deg, #ffffff, #fafafa); position:relative; overflow:hidden; }
    .ig-card[data-tone='good'] { box-shadow:0 6px 18px rgba(16,185,129,.12); }
    .ig-card[data-tone='focus'] { box-shadow:0 6px 18px rgba(245,158,11,.12); }
    .ig-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:.5rem; }
    .ig-card-title { font-weight:700; color:#111827; }
    .ig-badge { font-size:.75rem; font-weight:700; padding:.25rem .5rem; border-radius:999px; background:#eef2ff; color:#4338ca; border:1px solid #e0e7ff; }
    .ig-card-metrics { display:flex; gap:1rem; color:#374151; }
    .m-pair { display:flex; gap:.35rem; align-items:baseline; }
    .m-pair span { color:#6b7280; font-size:.8rem; }

    .ig-subpanels { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1.25rem; }
    .ig-subpanel { background:white; border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:.9rem; }
    .ig-subpanel h4 { margin:0 0 .5rem; font-weight:700; font-size:.95rem; color:#374151; }
    .ig-list { list-style:none; padding:0; margin:0; display:grid; gap:.4rem; }
    .ig-list li { display:flex; align-items:center; justify-content:space-between; background:#f9fafb; border:1px solid #eef2f7; border-radius:10px; padding:.5rem .6rem; font-size:.9rem; }
    .ig-list li em { color:#6b7280; font-style:normal; font-size:.8rem; }

    /* Skeleton / error */
    .ig-skeleton { display:grid; gap:.75rem; }
    .ig-skel-hero, .ig-skel-row { height:80px; background:linear-gradient(90deg,#f3f4f6, #f9fafb, #f3f4f6); background-size:200% 100%; border-radius:12px; animation:shimmer 1.2s infinite; }
    .ig-skel-hero { height:140px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .ig-error { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; padding:.75rem 1rem; border-radius:10px; }

    @media (max-width: 900px){
        .ig-panels, .ig-subpanels { grid-template-columns:1fr; }
        .ig-hero { flex-direction:column; align-items:flex-start; }
        .ig-hero-art { align-self:center; }
    }

    /* Tooltip */
    .ig-tooltip{ position:absolute; bottom:128px; left:50%; transform:translateX(-50%); background:#111827; color:#f9fafb; border-radius:10px; padding:.6rem .75rem; font-size:.85rem; box-shadow:0 6px 20px rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.08); min-width:180px; }
    .ig-tip-row{ display:flex; align-items:center; justify-content:space-between; gap:.75rem; }
    .ig-tip-row + .ig-tip-row{ margin-top:.25rem; }
    .ig-tip-footer{ margin-top:.4rem; font-size:.75rem; color:#c7d2fe; opacity:.9; }

    /* Modal */
    .ig-modal-backdrop{ position:fixed; inset:0; background:rgba(17,24,39,.55); backdrop-filter:blur(2px); z-index:60; }
    .ig-modal{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:70; padding:1rem; }
    .ig-modal-card{ width:min(540px,96vw); background:#fff; border-radius:14px; border:1px solid rgba(0,0,0,.08); box-shadow:0 20px 60px rgba(0,0,0,.25); overflow:hidden; }
    .ig-modal-header{ display:flex; align-items:center; justify-content:space-between; padding:1rem 1rem .5rem; border-bottom:1px solid #eef2f7; }
    .ig-modal-header h3{ margin:0; font-weight:800; color:#111827; }
    .ig-close{ background:transparent; border:none; font-size:1.5rem; line-height:1; padding:.25rem .5rem; cursor:pointer; color:#6b7280; }
    .ig-close:hover{ color:#111827; }
    .ig-modal-body{ padding:1rem; color:#374151; }
    .ig-modal-body ul{ margin:.5rem 0 0 1rem; }
    .ig-modal-footer{ padding:0 1rem 1rem; display:flex; justify-content:flex-end; }
    .ig-primary{ background:linear-gradient(135deg,#a855f7,#6366f1); color:#fff; border:none; border-radius:10px; padding:.55rem .9rem; font-weight:700; cursor:pointer; box-shadow:0 6px 18px rgba(99,102,241,.25); }
    .ig-primary:hover{ filter:brightness(1.05); }
</style>