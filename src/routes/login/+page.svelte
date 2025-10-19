<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	async function login() {
		try {
			loading = true;
			error = '';

			const { data, error: rpcError } = await supabase.rpc('rpc_learner_login', {
				p_email: email,
				p_password: password
			});

			if (rpcError) throw rpcError;
			if (!data || data.length === 0) {
				throw new Error('Invalid email or password.');
			}

			const userData = data[0];
			userStore.set(userData);

			goto('/dashboard');
		} catch (err: any) {
			error = err.message || 'Login failed.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="full-height centered">
	<div class="column is-11-mobile is-5-tablet is-4-desktop">
		<div class="card p-5">
			<h2 class="title is-4 has-text-centered mb-5">Sign in</h2>

			<form on:submit|preventDefault={login}>
				<div class="field mb-4">
					<label class="label">Email</label>
					<div class="control">
						<input
							class="input"
							type="email"
							bind:value={email}
							placeholder="name@example.com"
							required
						/>
					</div>
				</div>

				<div class="field mb-5">
					<label class="label">Password</label>
					<div class="control">
						<input
							class="input"
							type="password"
							bind:value={password}
							placeholder="••••••••"
							required
						/>
					</div>
				</div>

				{#if error}
					<p class="has-text-danger has-text-centered mb-4">{error}</p>
				{/if}

				<button class="button is-primary is-fullwidth" disabled={loading}>
					{loading ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	</div>
</div>

<style>
    .full-height {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .card {
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
    }
</style>

<script context="module" lang="ts">
	// disable SSR for browser-only page
	export const ssr = false;
</script>