<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';

	export let userId: string;
	export let assessmentItemId: bigint;
	export let initialFlagged: boolean = false;

	let isFlagged = initialFlagged;
	let isLoading = false;
	let showToast = false;
	let toastMessage = '';
	let toastTimeout: number;

	async function toggleFlag() {
		if (isLoading) return;

		isLoading = true;
		try {
			if (isFlagged) {
				// Unflag the item
				const { error } = await supabase.rpc('rpc_notes_unflag_item', {
					p_user_id: userId,
					p_assessment_item_id: assessmentItemId
				});

				if (error) throw error;
				isFlagged = false;
				showToastNotification('Removed from Review');
			} else {
				// Flag the item
				const { error } = await supabase.rpc('rpc_notes_flag_item', {
					p_user_id: userId,
					p_assessment_item_id: assessmentItemId
				});

				if (error) throw error;
				isFlagged = true;
				showToastNotification('Flagged for Review');
			}
		} catch (err) {
			console.error('Error toggling flag:', err);
		} finally {
			isLoading = false;
		}
	}

	function showToastNotification(message: string) {
		// Clear any existing timeout
		if (toastTimeout) {
			clearTimeout(toastTimeout);
		}

		toastMessage = message;
		showToast = true;

		// Auto-hide after 2.5 seconds
		toastTimeout = setTimeout(() => {
			showToast = false;
		}, 2500);
	}
</script>

<button
	class="flag-button"
	class:flagged={isFlagged}
	on:click={toggleFlag}
	disabled={isLoading}
	title={isFlagged ? 'Remove flag' : 'Flag for review'}
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
		<path d="M9 18h6" />
		<path d="M10 22h4" />
		<path
			d="M12 2a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z"
			fill={isFlagged ? 'currentColor' : 'none'}
		/>
	</svg>
</button>

{#if showToast}
	<div class="toast-notification" class:show={showToast}>
		{toastMessage}
	</div>
{/if}

<style>
	.flag-button {
		position: fixed;
		top: 20%;
		transform: translateY(-50%);
		right: 2rem;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		border: none;
		background-color: rgba(251, 191, 36, 0.3);
		color: rgb(251, 191, 36);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		z-index: 100;
	}

	.flag-button:hover {
		transform: translateY(-50%) scale(1.1);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
	}

	.flag-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: translateY(-50%);
	}

	.flag-button.flagged {
		background-color: rgba(239, 68, 68, 0.2);
		color: rgb(239, 68, 68);
	}

	.flag-button svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Toast Notification */
	.toast-notification {
		position: fixed;
		bottom: 6rem;
		right: 2rem;
		background: rgba(17, 24, 39, 0.85);
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: 8px;
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		z-index: 150;
		backdrop-filter: blur(8px);
		animation: slideIn 0.3s ease-out;
	}

	.toast-notification.show {
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.toast-notification {
			bottom: 5rem;
			right: 1rem;
			left: 1rem;
			text-align: center;
		}
		.flag-button {
			right: 1rem;
			width: 3rem;
			height: 3rem;
		}

		.flag-button svg {
			width: 1.25rem;
			height: 1.25rem;
		}
	}
</style>
