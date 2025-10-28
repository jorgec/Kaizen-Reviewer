<script lang="ts">


	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { computeInsights, toKPIBadges, toTableRows } from './utils';

	let loading = true;
	let error: string | null = null;
	let data: any = null;
	let user: any;
	const unsubscribe = userStore.subscribe((v) => (user = v));

	let kpiBadges: any[] = [];
	let strengthsTable: any[] = [];
	let weaknessesTable: any[] = [];
	let gapsTable: any[] = [];
	let slowTable: any[] = [];
	let workNextTable: any[] = [];

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

			const insights = computeInsights(result.data, {
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

			console.log('KPI Badges:', kpiBadges);
			console.log('Strengths Table:', strengthsTable);
			console.log('Weaknesses Table:', weaknessesTable);
			console.log('Low Sample Gaps Table:', gapsTable);
			console.log('Slow Outliers Table:', slowTable);
			console.log('Work Next Table:', workNextTable);
			console.log('Overall Insights:', insights.overall);


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
	<section class="section">
		<div class="container">
			<header class="mb-6">
				<h1 class="text-3xl font-bold text-[#a855f7]">
					My Stats
				</h1>
				<p class="text-gray-500 mt-1">
					My Assessment Stats
				</p>
			</header>


			{#if loading}
				<div class="p-4 text-center text-gray-500 animate-pulse">
					Loading My Stats data...
				</div>
			{:else if error}
				<div class="p-4 bg-red-100 text-red-700 rounded-md">
					Error: {error}
				</div>
			{:else}
				<section class="p-4 bg-white shadow rounded-lg">
					<h2 class="text-xl font-semibold mb-4">KPIs</h2>
					<div class="aggregations-grid">
						{#each kpiBadges as kpiBadge}
							<div class="agg-card">
								<div class="agg-icon svelte-162lzlq">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
											 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="20" x2="18" y2="10"></line>
										<line x1="12" y1="20" x2="12" y2="4"></line>
										<line x1="6" y1="20" x2="6" y2="14"></line>
									</svg>
								</div>
								<div class="agg-content">
									<div class="agg-label">{kpiBadge.label}</div>
									<div class="agg-value">{kpiBadge.value}</div>
								</div>
							</div>
						{/each}
					</div>

					<div class="results-header">
						<div class="results-info">
							Strengths
						</div>
					</div>
					<div class="aggregations-grid">
						{#each strengthsTable as str}
							<div class="agg-card">
								<div class="agg-icon svelte-162lzlq">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
											 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="20" x2="18" y2="10"></line>
										<line x1="12" y1="20" x2="12" y2="4"></line>
										<line x1="6" y1="20" x2="6" y2="14"></line>
									</svg>
								</div>
								<div class="agg-content">
									<div class="agg-label">{str.label}</div>
									<div class="agg-value">{str.accuracy}</div>
									<div class="card-footer">
										<div class="card-footer-item is-size-7">
											{str.attempts} attempts
										</div>
										<div class="card-footer-item is-size-7">
											{str.wilsonLB} wilson LB
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<div class="results-header">
						<div class="results-info">
							Weaknesses
						</div>
					</div>
					<div class="aggregations-grid">
						{#each weaknessesTable as wk}
							<div class="agg-card">
								<div class="agg-icon svelte-162lzlq">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
											 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="20" x2="18" y2="10"></line>
										<line x1="12" y1="20" x2="12" y2="4"></line>
										<line x1="6" y1="20" x2="6" y2="14"></line>
									</svg>
								</div>
								<div class="agg-content">
									<div class="agg-label">{wk.label}</div>
									<div class="agg-value">{wk.accuracy}</div>
									<div class="card-footer">
										<div class="card-footer-item is-size-7">
											{wk.attempts} attempts
										</div>
										<div class="card-footer-item is-size-7">
											{wk.wilsonLB} wilson LB
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<div class="results-header">
						<div class="results-info">
							Low Sample Gaps
						</div>
					</div>
					<div class="aggregations-grid">
						{#each gapsTable as wk}
							<div class="agg-card">
								<div class="agg-icon svelte-162lzlq">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
											 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="20" x2="18" y2="10"></line>
										<line x1="12" y1="20" x2="12" y2="4"></line>
										<line x1="6" y1="20" x2="6" y2="14"></line>
									</svg>
								</div>
								<div class="agg-content">
									<div class="agg-label">{wk.label}</div>
									<div class="agg-value">{wk.accuracy}</div>
									<div class="card-footer">
										<div class="card-footer-item is-size-7">
											{wk.attempts} attempts
										</div>
										<div class="card-footer-item is-size-7">
											{wk.wilsonLB} wilson LB
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>



				</section>
			{/if}
		</div>
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
</style>