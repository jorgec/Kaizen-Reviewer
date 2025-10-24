<script lang="ts">

	{% raw %}
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
			error = null;
			const result = await supabase.rpc('', {
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

	onMount(() => {
		if (!user?.user_id) {
			goto('/login');
			return;
		}
		loadData();
	});
	{% endraw %}
</script>

<svelte:head>
	<title>{{ cookiecutter.route_display_name }} | Kaizen</title>
	<meta name="description" content="{{ cookiecutter.route_description }}" />
</svelte:head>

<main class="p-6 min-h-screen bg-gray-50 text-gray-800">
	<section class="section">
		<div class="container">
			<header class="mb-6">
				<h1 class="text-3xl font-bold text-[{{ cookiecutter.primary_color }}]">
					{{ cookiecutter.route_display_name }}
				</h1>
				<p class="text-gray-500 mt-1">
					{{ cookiecutter.route_description }}
				</p>
			</header>

			{% raw %}
			{#if loading}
				<div class="p-4 text-center text-gray-500 animate-pulse">
					Loading {% endraw %}{{ cookiecutter.route_display_name }}{%raw %} data...
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

	{% endraw %}
</main>

<style>
    main {
        font-family: Inter, system-ui, sans-serif;
    }

    h1 {
        color: {{ cookiecutter.primary_color }};
    }

    a {
        color: {{ cookiecutter.accent_color }};
    }

    a:hover {
        color: {{ cookiecutter.secondary_color }};
    }
</style>