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

<div class="fullscreen">
	<div class="overlay"></div>

	<div class="login-container">
		<div class="login-card">
			<div class="logo-section">
				<h1 class="brand-title">
					<span class="gradient-text">Kaizen</span>
				</h1>
				<p class="brand-subtitle">Continuous improvement, every day</p>
			</div>

			<h2 class="signin-title">Sign in to your account</h2>

			<form on:submit|preventDefault={login} class="login-form">
				<div class="form-group">
					<label class="form-label">Email address</label>
					<div class="input-wrapper">
						<svg
							class="input-icon"
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
							<polyline points="22,6 12,13 2,6"></polyline>
						</svg>
						<input
							class="modern-input"
							type="email"
							bind:value={email}
							placeholder="name@example.com"
							required
						/>
					</div>
				</div>

				<div class="form-group">
					<label class="form-label">Password</label>
					<div class="input-wrapper">
						<svg
							class="input-icon"
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
							<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
						</svg>
						<input
							class="modern-input"
							type="password"
							bind:value={password}
							placeholder="••••••••"
							required
						/>
					</div>
				</div>

				{#if error}
					<div class="error-message">
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
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="12" y1="8" x2="12" y2="12"></line>
							<line x1="12" y1="16" x2="12.01" y2="16"></line>
						</svg>
						<span>{error}</span>
					</div>
				{/if}

				<button class="modern-button" type="submit" disabled={loading}>
					{#if loading}
						<span class="spinner"></span>
						<span>Signing in...</span>
					{:else}
						<span>Sign in</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="5" y1="12" x2="19" y2="12"></line>
							<polyline points="12 5 19 12 12 19"></polyline>
						</svg>
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>

<style>
    /* Fullscreen background matching main page */
    .fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: url('/bg.jpg') center center / cover no-repeat;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
    }

    .overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom right, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.35));
        backdrop-filter: blur(3px);
        z-index: 1;
    }

    /* Login container */
    .login-container {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 480px;
        padding: 2rem;
    }

    /* Modern card styling */
    .login-card {
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        padding: 3rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Logo section */
    .logo-section {
        text-align: center;
        margin-bottom: 2.5rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .brand-title {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        font-size: 2.25rem;
        margin: 0 0 0.5rem 0;
        line-height: 1;
    }

    .gradient-text {
        background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .brand-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 0.95rem;
        color: #6b7280;
        margin: 0;
    }

    /* Sign in title */
    .signin-title {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: 1.5rem;
        color: #1f2937;
        margin: 0 0 2rem 0;
        text-align: center;
    }

    /* Form styling */
    .login-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        margin: 0;
    }

    /* Modern input with icon */
    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .input-icon {
        position: absolute;
        left: 1rem;
        color: #9ca3af;
        pointer-events: none;
        z-index: 1;
    }

    .modern-input {
        width: 100%;
        padding: 0.875rem 1rem 0.875rem 3rem;
        font-family: 'Inter', sans-serif;
        font-size: 0.95rem;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        background: #ffffff;
        color: #1f2937;
        transition: all 0.2s ease;
        outline: none;
    }

    .modern-input::placeholder {
        color: #9ca3af;
    }

    .modern-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .modern-input:hover:not(:focus) {
        border-color: #d1d5db;
    }

    /* Error message */
    .error-message {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 10px;
        color: #dc2626;
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        margin-top: -0.5rem;
    }

    .error-message svg {
        flex-shrink: 0;
    }

    /* Modern button */
    .modern-button {
        width: 100%;
        padding: 1rem 1.5rem;
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        color: #ffffff;
        background: linear-gradient(90deg, #a855f7, #6366f1);
        border: none;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: all 0.25s ease;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        margin-top: 0.5rem;
    }

    .modern-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        background: linear-gradient(90deg, #9333ea, #4f46e5);
    }

    .modern-button:active:not(:disabled) {
        transform: translateY(0);
    }

    .modern-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    /* Loading spinner */
    .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .login-container {
            padding: 1rem;
        }

        .login-card {
            padding: 2rem 1.5rem;
            border-radius: 20px;
        }

        .brand-title {
            font-size: 2rem;
        }

        .signin-title {
            font-size: 1.25rem;
        }

        .logo-section {
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
        }
    }

    @media (max-width: 480px) {
        .login-card {
            padding: 1.75rem 1.25rem;
        }

        .brand-title {
            font-size: 1.75rem;
        }
    }
</style>

<script context="module" lang="ts">
	// disable SSR for browser-only page
	export const ssr = false;
</script>