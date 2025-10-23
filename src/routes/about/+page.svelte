<script lang="ts">
	
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let loading = true;
	let error: string | null = null;
	let data: any = null;

	async function loadData() {
		// try {
		// 	loading = true;
		// 	error = null;
		// 	const res = await fetch('/api/example');
		// 	if (!res.ok) throw new Error(`HTTP ${res.status}`);
		// 	data = await res.json();
		// } catch (err) {
		// 	error = err instanceof Error ? err.message : String(err);
		// } finally {
		// 	loading = false;
		// }
	}

	onMount(() => {
		loadData();
	});
	
</script>

<svelte:head>
	<title>About Kaizen | Kaizen</title>
	<meta name="description" content="Make small, meaningful changes every day to enhance performance and mastery." />
</svelte:head>

<main class="p-6 min-h-screen bg-gray-50 text-gray-800">
	<section class="section">
		<div class="container">
			<header class="mb-6">
				<h1 class="text-3xl font-bold text-[#a855f7]">
					About Kaizen
				</h1>
				<p class="text-gray-500 mt-1">
					Make small, meaningful changes every day to enhance performance and mastery.
				</p>
			</header>


			{#if loading}
				<div class="p-4 text-center text-gray-500 animate-pulse">
					Loading about data...
				</div>
			{:else if error}
				<div class="p-4 bg-red-100 text-red-700 rounded-md">
					Error: {error}
				</div>
			{:else}
				<section class="p-4 bg-white shadow rounded-lg">
					<h2 class="text-xl font-semibold mb-4">Data Preview</h2>
					{#if Array.isArray(data)}
						<ul class="space-y-2">
							{#each data as item}
								<li class="p-3 bg-gray-100 rounded-md">{JSON.stringify(item)}</li>
							{/each}
						</ul>
					{:else}
					<pre class="text-sm bg-gray-100 p-3 rounded-md overflow-auto">
						{JSON.stringify(data, null, 2)}
					</pre>
					{/if}
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