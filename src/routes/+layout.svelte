<script lang="ts">
	import '$lib/styles/app.css';
	import { userStore } from '$lib/stores/userStore';
	import { onMount, onDestroy } from 'svelte';

	let user: any = null;
	let selectedDisciplineId: number | null = null;
	let selectedOrgId: string = '';
	let scrolled = false;
	let drawerOpen = false;

	const unsubscribe = userStore.subscribe((value) => {
		user = value;
		selectedDisciplineId = user?.currentDiscipline?.discipline_id ?? null;
		selectedOrgId = user?.currentOrg?.org_id ?? null;

	});

	onMount(() => {
		// Sync user from localStorage if available
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('user');

			// Only restore from localStorage if store is still empty
			userStore.subscribe((u) => {
				user = u;

				// Once user is defined (first valid login load), ensure current fields
				if (user && !user.currentDiscipline && user.disciplines?.length) {
					userStore.ensureCurrentDiscipline();
				}

				if (user && !user.currentOrg && user.orgs?.length) {
					userStore.ensureCurrentOrg();
				}
			});

			if (!user?.user_id && saved) {
				userStore.set(JSON.parse(saved));
			}

			window.addEventListener('scroll', handleScroll);
		}
	});

	function handleDisciplineChange(e: Event) {
		const value = Number((e.target as HTMLSelectElement).value);
		if (!value) return;
		userStore.setCurrentDisciplineById(value);
		selectedDisciplineId = value;
		closeDrawer();
	}

	function handleOrgChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		if (!value) return;
		userStore.setCurrentOrgById(value);
		selectedOrgId = value;
		closeDrawer();
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
		closeDrawer();
		if (typeof window !== 'undefined') {
			localStorage.removeItem('user');
			window.location.href = '/';
		}
	}

	function toggleDrawer() {
		drawerOpen = !drawerOpen;
	}

	function closeDrawer() {
		drawerOpen = false;
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

		<!-- Hamburger button visible on small screens -->
		{#if user?.display_name}
			<button
				class="button is-dark is-medium hamburger-button"
				aria-label="Toggle menu"
				on:click={toggleDrawer}
				aria-expanded={drawerOpen}
				aria-controls="drawer-menu"
				type="button"
			>
				<span class="icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="feather feather-menu"
					>
						<line x1="3" y1="12" x2="21" y2="12"></line>
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="18" x2="21" y2="18"></line>
					</svg>
				</span>
			</button>
		{/if}

		<!-- Desktop menu visible on large screens -->
		{#if user?.display_name}
			<div class="desktop-menu is-flex is-align-items-center">
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

<!-- Drawer and overlay for small screens -->
{#if drawerOpen}
	<div class="drawer-overlay" on:click={closeDrawer} aria-hidden="true"></div>
{/if}
<aside
	id="drawer-menu"
	class:drawer-open={drawerOpen}
	class="drawer-menu has-background-dark"
	role="menu"
	aria-hidden={!drawerOpen}
>
	{#if user?.display_name}
		<nav class="menu-content">
			{#if user?.orgs && user.orgs.length > 1}
				<div class="menu-item">
					<label for="drawer-org-select" class="menu-label">Organization</label>
					<select
						id="drawer-org-select"
						class="select"
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
				<div class="menu-item">
					<label for="drawer-discipline-select" class="menu-label">Discipline</label>
					<select
						id="drawer-discipline-select"
						class="select"
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

			<div class="menu-item">
				<button class="button is-danger is-fullwidth" on:click={logout}>
					Log out ({user.display_name})
				</button>
			</div>
		</nav>
	{/if}
</aside>

<section class="section">
	<div class="container">
		<slot />
	</div>
</section>

<style>
	.navbar {
		transition: background-color 0.3s ease, box-shadow 0.3s ease;
	}

	.hamburger-button {
		display: none;
	}

	.desktop-menu {
		display: flex;
		gap: 0.75rem;
	}

	/* Drawer styles */
	.drawer-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.5);
		z-index: 20;
	}

	.drawer-menu {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 260px;
		background-color: #222;
		color: #eee;
		transform: translateX(100%);
		transition: transform 0.3s ease;
		z-index: 30;
		padding: 1.5rem 1rem;
		display: flex;
		flex-direction: column;
	}

	.drawer-open {
		transform: translateX(0);
	}

	.menu-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.menu-label {
		font-weight: 600;
		margin-bottom: 0.25rem;
		display: block;
		color: #ddd;
	}

	.menu-item select.select {
		width: 100%;
	}

	.menu-item button {
		font-weight: 600;
	}

	/* Responsive styles */
	@media (max-width: 768px) {
		.hamburger-button {
			display: inline-flex;
		}

		.desktop-menu {
			display: none !important;
		}
	}

	@media (min-width: 769px) {
		.drawer-menu,
		.drawer-overlay {
			display: none;
		}
	}

	.org-select select,
	.discipline-select select {
		min-width: 180px;
		padding: 0.25rem 0.75rem;
	}

	.discipline-pill {
		padding: 0.15rem 0.6rem;
		background: #f2f4f7;
		font-size: 0.85rem;
	}
</style>

<script context="module" lang="ts">
	// Disable SSR since layout uses browser APIs
	export const ssr = false;
</script>