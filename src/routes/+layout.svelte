<script lang="ts">
	import '$lib/styles/app.css';
	import { userStore } from '$lib/stores/userStore';
	import { onMount, onDestroy } from 'svelte';

	let user: any = null;
	let selectedDisciplineId: number | null = null;
	let selectedOrgId: string = '';
	let scrolled = false;
	let drawerOpen = false;
	let userMenuOpen = false;

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
			document.addEventListener('click', handleClickOutside);
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
			document.removeEventListener('click', handleClickOutside);
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

	function toggleUserMenu() {
		userMenuOpen = !userMenuOpen;
	}

	function closeUserMenu() {
		userMenuOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.user-menu-wrapper')) {
			closeUserMenu();
		}
	}

	$: selectedDisciplineId = user?.currentDiscipline?.discipline_id ?? null;
	$: selectedOrgId = user?.currentOrg?.org_id ?? null;
</script>

<nav
	class="navbar"
	class:shrink={scrolled}
>
	<div class="navbar-container">
		<!-- Brand on the left -->
		<a href="/dashboard" class="navbar-brand">
			<div class="brand-logo">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="logo-icon"
				>
					<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
				</svg>
				<h1 class="brand-title">Kaizen</h1>
			</div>
		</a>

		<!-- Navigation on the right -->
		<div class="navbar-right">
			{#if user?.display_name}
				<!-- Hamburger button visible on small screens -->
				<button
					class="hamburger-button"
					aria-label="Toggle menu"
					on:click={toggleDrawer}
					aria-expanded={drawerOpen}
					aria-controls="drawer-menu"
					type="button"
				>
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
					>
						<line x1="3" y1="12" x2="21" y2="12"></line>
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="18" x2="21" y2="18"></line>
					</svg>
				</button>

				<!-- Desktop menu visible on large screens -->
				<div class="desktop-menu">
					{#if user?.orgs && user.orgs.length > 1}
						<div class="nav-select-wrapper">
							<select
								class="nav-select"
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
						<div class="nav-select-wrapper">
							<select
								class="nav-select"
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

					<!-- User menu dropdown -->
					<div class="user-menu-wrapper">
						<button
							class="user-icon-button"
							on:click={toggleUserMenu}
							aria-label="User menu"
							aria-expanded={userMenuOpen}
							type="button"
						>
							<span class="icon">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
									<circle cx="12" cy="7" r="4"></circle>
								</svg>
							</span>
						</button>
						{#if userMenuOpen}
							<div class="user-dropdown">
								<div class="dropdown-header">
									<div class="user-name">{user.display_name}</div>
									{#if user.email}
										<div class="user-email">{user.email}</div>
									{/if}
									<div class="user-email">Org: {user.orgs[0].org_name}</div>
								</div>
								<hr class="dropdown-divider" />
								<a href="/about/question_bank_info" class="dropdown-item">
									Question Bank Info
								</a>
								<hr class="dropdown-divider" />
								<button class="dropdown-item logout-button" on:click={logout}>
									<span class="icon is-small">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
											<polyline points="16 17 21 12 16 7"></polyline>
											<line x1="21" y1="12" x2="9" y2="12"></line>
										</svg>
									</span>
									<span>Logout</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<a href="/login" class="login-button">
					<span>Login</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="5" y1="12" x2="19" y2="12"></line>
						<polyline points="12 5 19 12 12 19"></polyline>
					</svg>
				</a>
			{/if}
		</div>
	</div>
</nav>

<!-- Drawer and overlay for small screens -->
{#if drawerOpen}
	<div class="drawer-overlay" on:click={closeDrawer} aria-hidden="true"></div>
{/if}
<div
	id="drawer-menu"
	class:drawer-open={drawerOpen}
	class="drawer-menu has-background-dark"
	role="menu"
	aria-hidden={!drawerOpen}
>
	{#if user?.display_name}
		<nav class="menu-content">
			<!-- User info section -->
			<div class="drawer-user-info">
				<div class="user-avatar">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="40"
						height="40"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
						<circle cx="12" cy="7" r="4"></circle>
					</svg>
				</div>
				<div class="drawer-user-name">{user.display_name}</div>
				{#if user.email}
					<div class="drawer-user-email">{user.email}</div>
				{/if}
			</div>

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
					<span class="icon is-small">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
							<polyline points="16 17 21 12 16 7"></polyline>
							<line x1="21" y1="12" x2="9" y2="12"></line>
						</svg>
					</span>
					<span>Logout</span>
				</button>
			</div>
		</nav>
	{/if}
</div>

<main class="main-content">
	<slot />
</main>

<footer class="disclaimer-footer">
	<div class="disclaimer-content">
		<div class="disclaimer-icon">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
		</div>
		<div class="disclaimer-text">
			<strong>Closed Alpha:</strong> This site is currently in closed alpha testing. Some features may contain bugs or errors.
			If you encounter any issues with the system or find errors in questions/answers, please
			<a href="https://forms.gle/hX1NFUD6V5n75Ba59" target="_blank" rel="noopener noreferrer" class="report-link">submit a report</a>.
		</div>
	</div>
</footer>

<style>
	/* Modern Navbar */
	.navbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		width: 100%;
		z-index: 1000;
		background: rgba(17, 24, 39, 0.85);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
	}

	.navbar.shrink {
		background: rgba(17, 24, 39, 0.95);
		box-shadow: 0 4px 32px rgba(0, 0, 0, 0.2);
	}

	.navbar-container {
		padding: 0.875rem 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	/* Brand Logo */
	.navbar-brand {
		text-decoration: none;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.navbar-brand:hover {
		transform: translateY(-1px);
	}

	.brand-logo {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.logo-icon {
		color: #a855f7;
		filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.4));
	}

	.brand-title {
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: 1.5rem;
		margin: 0;
		background: linear-gradient(135deg, #a855f7, #6366f1);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	/* Navigation Right Container */
	.navbar-right {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;
		width: 70%;
		flex-shrink: 0;
	}

	/* Hamburger Button */
	.hamburger-button {
		display: none;
		padding: 0.5rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: #e5e7eb;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.hamburger-button:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(168, 85, 247, 0.4);
		color: #a855f7;
	}

	/* Desktop Menu */
	.desktop-menu {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	/* Nav Select Dropdowns */
	.nav-select-wrapper {
		position: relative;
	}

	.nav-select {
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		padding: 0.5rem 2.25rem 0.5rem 0.875rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: #e5e7eb;
		cursor: pointer;
		transition: all 0.2s ease;
		appearance: none;
		min-width: 160px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23e5e7eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.625rem center;
		background-size: 16px;
	}

	.nav-select:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(168, 85, 247, 0.3);
	}

	.nav-select:focus {
		outline: none;
		border-color: #a855f7;
		box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
	}

	.nav-select option {
		background: #1f2937;
		color: #e5e7eb;
	}

	/* Login Button */
	.login-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: linear-gradient(135deg, #a855f7, #6366f1);
		color: white;
		border: none;
		border-radius: 8px;
		font-family: 'Inter', sans-serif;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
	}

	.login-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);
		background: linear-gradient(135deg, #9333ea, #4f46e5);
	}

	.login-button svg {
		transition: transform 0.2s ease;
	}

	.login-button:hover svg {
		transform: translateX(2px);
	}

	/* Main Content */
	.main-content {
		padding-top: 70px;
		min-height: 100vh;
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
		.navbar-container {
			padding: 0.75rem 1.25rem;
		}

		.brand-title {
			font-size: 1.25rem;
		}

		.logo-icon {
			width: 20px;
			height: 20px;
		}

		.hamburger-button {
			display: flex;
		}

		.desktop-menu {
			display: none !important;
		}

		.main-content {
			padding-top: 60px;
		}
	}

	@media (min-width: 769px) {
		.drawer-menu,
		.drawer-overlay {
			display: none;
		}
	}

	/* User menu dropdown styles */
	.user-menu-wrapper {
		position: relative;
	}

	.user-icon-button {
		border-radius: 50%;
		width: 40px;
		height: 40px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e5e7eb;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.user-icon-button:hover {
		background: rgba(168, 85, 247, 0.15);
		border-color: rgba(168, 85, 247, 0.4);
		color: #a855f7;
		transform: translateY(-1px);
	}

	.user-icon-button .icon {
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.user-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background-color: white;
		border-radius: 6px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
		min-width: 240px;
		z-index: 40;
		overflow: hidden;
	}

	.dropdown-header {
		padding: 1rem;
		background-color: #f5f5f5;
	}

	.user-name {
		font-weight: 600;
		font-size: 0.95rem;
		color: #363636;
		margin-bottom: 0.25rem;
	}

	.user-email {
		font-size: 0.85rem;
		color: #7a7a7a;
	}

	.dropdown-divider {
		margin: 0;
		background-color: #e0e0e0;
		height: 1px;
		border: none;
	}

	.dropdown-item {
		width: 100%;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: #363636;
	}

	.dropdown-item:hover {
		background-color: #f5f5f5;
	}

	.logout-button {
		color: #f14668;
		font-weight: 500;
	}

	.logout-button:hover {
		background-color: #feecf0;
	}

	/* Mobile drawer user info styles */
	.drawer-user-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.5rem 1rem;
		border-bottom: 1px solid #3a3a3a;
		margin-bottom: 1rem;
	}

	.user-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: #363636;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
		border: 2px solid #4a4a4a;
	}

	.user-avatar svg {
		color: #ddd;
	}

	.drawer-user-name {
		font-weight: 600;
		font-size: 1.1rem;
		color: #eee;
		margin-bottom: 0.25rem;
		text-align: center;
	}

	.drawer-user-email {
		font-size: 0.85rem;
		color: #aaa;
		text-align: center;
	}

	/* Disclaimer Footer */
	.disclaimer-footer {
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1));
		border-top: 1px solid rgba(168, 85, 247, 0.2);
		padding: 1.25rem 2rem;
		margin-top: 3rem;
	}

	.disclaimer-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.disclaimer-icon {
		flex-shrink: 0;
		color: #a855f7;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 2px;
	}

	.disclaimer-text {
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		line-height: 1.6;
		color: #4b5563;
	}

	.disclaimer-text strong {
		color: #7c3aed;
		font-weight: 600;
	}

	.report-link {
		color: #6366f1;
		text-decoration: none;
		font-weight: 500;
		border-bottom: 1px solid transparent;
		transition: all 0.2s ease;
	}

	.report-link:hover {
		color: #a855f7;
		border-bottom-color: #a855f7;
	}

	@media (max-width: 768px) {
		.disclaimer-footer {
			padding: 1rem 1.25rem;
			margin-top: 2rem;
		}

		.disclaimer-content {
			flex-direction: column;
			gap: 0.75rem;
		}

		.disclaimer-icon {
			margin-top: 0;
		}

		.disclaimer-text {
			font-size: 0.8125rem;
		}
	}
</style>

<script context="module" lang="ts">
	// Disable SSR since layout uses browser APIs
	export const ssr = false;
</script>