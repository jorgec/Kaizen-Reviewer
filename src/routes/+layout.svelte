<script lang="ts">
	import '$lib/styles/app.css';
	import { userStore } from '$lib/stores/userStore';
	import { onMount, onDestroy } from 'svelte';

	let user: any = null;
	let selectedDisciplineId: number | null = null;
	let selectedOrgId: string = '';
	let scrolled = false;

	const unsubscribe = userStore.subscribe((value) => {
		user = value;
		selectedDisciplineId = user?.currentDiscipline?.discipline_id ?? null;
		selectedOrgId = user?.currentOrg?.org_id ?? null;

	});

	onMount(() => {
		// Sync user from localStorage if available
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('user');
			if (saved) userStore.set(JSON.parse(saved));

			// Handle scroll-based navbar shrink effect
			window.addEventListener('scroll', handleScroll);

			if (user?.disciplines?.length) {
				userStore.ensureCurrentDiscipline();
			}

			if (user?.orgs?.length) {
				userStore.ensureCurrentOrg();
			}
		}
	});

	function handleDisciplineChange(e: Event) {
		const value = Number((e.target as HTMLSelectElement).value);
		if (!value) return;
		userStore.setCurrentDisciplineById(value);
		selectedDisciplineId = value;
	}

	function handleOrgChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		if (!value) return;
		userStore.setCurrentOrgById(value);
		selectedOrgId = value;
	}

	onDestroy(() => {
		unsubscribe();
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', handleScroll);
		}
	});

	function handleScroll() {
		if (window.scrollY > 20 && !scrolled) scrolled = true;
		else if (window.scrollY <= 20 && scrolled) scrolled = false;
	}

	function logout() {
		userStore.set({
			user_id: null,
			email: null,
			display_name: null,
			orgs: [],
			roles: []
		});
		if (typeof window !== 'undefined') {
			localStorage.removeItem('user');
			window.location.href = '/';
		}
	}

	$: selectedDisciplineId = user?.currentDiscipline?.discipline_id ?? null;
	$: selectedOrgId = user?.currentOrg?.org_id ?? null;
</script>

<nav
	class="navbar has-background-dark has-shadow"
	class:shrink={scrolled}
	style="position: fixed; width: 100%; top: 0; z-index: 10;"
>
	<div
		class="container is-flex is-justify-content-space-between is-align-items-center py-3 px-5"
	>
		<a href="/dashboard" class="navbar-brand-link">
			<h1 class="title is-5" style="margin: 0; color: #eee">Kaizen</h1>
		</a>

		{#if user?.display_name}
			<div class="is-flex is-align-items-center">
				{#if user?.orgs && user.orgs.length > 1}
					<div class="org-select">
						<select
							class="select is-small"
							on:change={handleOrgChange}
							bind:value={selectedOrgId}
						>
							{#each user.orgs as d}
								<option value={d.org_id}>
									{d.org_name ?? d.org_code ?? d.org_id}
								</option>
							{/each}
						</select>
					</div>
				{/if}
				{#if user?.disciplines && user.disciplines.length > 1}
					<div class="discipline-select">
						<select
							class="select is-small"
							on:change={handleDisciplineChange}
							bind:value={selectedDisciplineId}
						>
							{#each user.disciplines as d}
								<option value={d.discipline_id}>
									{d.discipline_name ?? d.discipline_code ?? d.discipline_id}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<button class="button is-danger is-small ml-3" on:click={logout}>Hi {user.display_name}. Log out?</button>
			</div>
		{:else}
			<a href="/login" class="button is-primary">Login</a>
		{/if}
	</div>
</nav>

<section class="section">
	<div class="container">
		<slot />
	</div>
</section>

<style>
    .app-topbar {
        position: sticky;
        top: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: .5rem .75rem;
        background: rgba(255, 255, 255, .9);
        backdrop-filter: blur(6px);
        border-bottom: 1px solid rgba(0, 0, 0, .06);
    }

    .brand {
        font-weight: 700;
        color: inherit;
        text-decoration: none
    }

    .right {
        display: flex;
        align-items: center;
        gap: .5rem
    }

    .discipline-select select {
        min-width: 180px;
        padding: .25rem .75rem;
    }

    .discipline-pill {
        padding: .15rem .6rem;
        background: #f2f4f7;
        font-size: .85rem;
    }

</style>

<script context="module" lang="ts">
	// Disable SSR since layout uses browser APIs
	export const ssr = false;
</script>