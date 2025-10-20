<script lang="ts">
	import '$lib/styles/app.css';
	import { userStore } from '$lib/stores/userStore';
	import { onMount, onDestroy } from 'svelte';

	let user: any = null;
	let scrolled = false;

	const unsubscribe = userStore.subscribe((value) => {
		user = value;
	});

	onMount(() => {
		// Sync user from localStorage if available
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('user');
			if (saved) userStore.set(JSON.parse(saved));

			// Handle scroll-based navbar shrink effect
			window.addEventListener('scroll', handleScroll);
		}
	});

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
</script>

<nav
	class="navbar has-shadow"
	class:shrink={scrolled}
	style="position: fixed; width: 100%; top: 0; z-index: 10;"
>
	<div
		class="container is-flex is-justify-content-space-between is-align-items-center py-3 px-5"
	>
		<a href="/dashboard" class="navbar-brand-link">
			<h1 class="title is-5" style="margin: 0;">Kaizen Reviewer</h1>
		</a>

		{#if user?.display_name}
			<div class="is-flex is-align-items-center">
				<span class="has-text-weight-medium user-display">
					{user.display_name}
				</span>
				<button class="button is-light is-small ml-3" on:click={logout}>Log out</button>
			</div>
		{:else}
			<a href="/login" class="button is-primary">Login</a>
		{/if}
	</div>
</nav>

<section class="section" style="padding-top: 5rem;">
	<div class="container">
		<slot />
	</div>
</section>

<style>

</style>

<script context="module" lang="ts">
	// Disable SSR since layout uses browser APIs
	export const ssr = false;
</script>