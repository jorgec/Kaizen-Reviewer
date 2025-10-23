<script lang="ts">
	// pure front page – no imports needed
</script>

<div class="fullscreen">
	<div class="overlay"></div>

	<div class="content">
		<div class="badge">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
			</svg>
			<span>Continuous Improvement Platform</span>
		</div>

		<h1 class="title">
			Welcome to<br />
			<span class="gradient-text">Kaizen</span>
		</h1>

		<p class="subtitle">
			Transform your learning journey with the philosophy of continuous improvement.<br class="desktop-break" />
			Make small, meaningful changes every day to enhance performance and mastery.
		</p>

		<div class="cta-section">
			<a href="/login" class="cta-primary">
				<span>Get Started</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
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
		</div>

		<div class="features">
			<div class="feature-item">
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
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
				</svg>
				<span>Track Progress</span>
			</div>
			<div class="feature-item">
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
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
					<polyline points="22 4 12 14.01 9 11.01"></polyline>
				</svg>
				<span>Set Goals</span>
			</div>
			<div class="feature-item">
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
					<path d="M18 20V10"></path>
					<path d="M12 20V4"></path>
					<path d="M6 20v-6"></path>
				</svg>
				<span>Improve Daily</span>
			</div>
		</div>
	</div>
</div>

<style>
	/* ============================================================
		 Modern SaaS Landing Page
		 ============================================================ */

	html, body {
		margin: 0;
		padding: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

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
		text-align: center;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom right, rgba(0, 0, 0, 0.60), rgba(0, 0, 0, 0.40));
		backdrop-filter: blur(4px);
		z-index: 1;
	}

	.content {
		position: relative;
		z-index: 2;
		color: #fff;
		max-width: 800px;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	/* Badge */
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1.25rem;
		background: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 999px;
		font-family: 'Inter', sans-serif;
		font-size: 0.875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.95);
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		animation: fadeInDown 0.6s ease-out;
	}

	.badge svg {
		color: #a855f7;
		filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.5));
	}

	@keyframes fadeInDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Title */
	.title {
		font-family: 'Inter', sans-serif;
		font-weight: 800;
		font-size: 4.5rem;
		line-height: 1.1;
		margin: 0;
		color: white;
		text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
		animation: fadeInUp 0.8s ease-out 0.2s both;
		letter-spacing: -0.02em;
	}

	.gradient-text {
		background: linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #3b82f6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		filter: drop-shadow(0 0 32px rgba(168, 85, 247, 0.4));
		display: inline-block;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Subtitle */
	.subtitle {
		font-family: 'Inter', sans-serif;
		font-size: 1.35rem;
		line-height: 1.7;
		color: rgba(255, 255, 255, 0.92);
		margin: 0;
		max-width: 680px;
		text-shadow: 0 2px 16px rgba(0, 0, 0, 0.4);
		animation: fadeInUp 0.8s ease-out 0.4s both;
		font-weight: 400;
	}

	/* CTA Section */
	.cta-section {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: center;
		margin-top: 0.5rem;
		animation: fadeInUp 0.8s ease-out 0.6s both;
	}

	.cta-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		background: linear-gradient(135deg, #a855f7, #6366f1);
		color: #fff;
		padding: 1.125rem 2.5rem;
		border-radius: 999px;
		font-weight: 600;
		font-size: 1.125rem;
		text-decoration: none;
		font-family: 'Inter', sans-serif;
		box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4),
					0 0 0 1px rgba(255, 255, 255, 0.1) inset;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		position: relative;
		overflow: hidden;
	}

	.cta-primary::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s ease;
	}

	.cta-primary:hover::before {
		left: 100%;
	}

	.cta-primary:hover {
		transform: translateY(-3px);
		box-shadow: 0 12px 40px rgba(99, 102, 241, 0.5),
					0 0 0 1px rgba(255, 255, 255, 0.2) inset;
		background: linear-gradient(135deg, #9333ea, #4f46e5);
	}

	.cta-primary:active {
		transform: translateY(-1px);
	}

	.cta-primary svg {
		transition: transform 0.3s ease;
	}

	.cta-primary:hover svg {
		transform: translateX(4px);
	}

	/* Features */
	.features {
		display: flex;
		gap: 2.5rem;
		margin-top: 1.5rem;
		animation: fadeInUp 0.8s ease-out 0.8s both;
	}

	.feature-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-family: 'Inter', sans-serif;
		font-size: 0.95rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.88);
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.feature-item svg {
		color: #a855f7;
		filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.4));
	}

	/* --- Mobile & Tablet Scaling --- */
	@media (max-width: 768px) {
		.content {
			gap: 1.5rem;
			padding: 1.5rem;
		}

		.badge {
			font-size: 0.8rem;
			padding: 0.4rem 1rem;
		}

		.badge svg {
			width: 12px;
			height: 12px;
		}

		.title {
			font-size: 2.75rem;
		}

		.subtitle {
			font-size: 1.1rem;
			padding: 0 0.5rem;
		}

		.desktop-break {
			display: none;
		}

		.cta-primary {
			font-size: 1rem;
			padding: 1rem 2rem;
		}

		.features {
			flex-direction: column;
			gap: 1rem;
			margin-top: 1rem;
		}

		.feature-item {
			font-size: 0.9rem;
		}
	}

	@media (max-width: 480px) {
		.title {
			font-size: 2.25rem;
		}

		.subtitle {
			font-size: 1rem;
		}

		.cta-primary {
			padding: 0.875rem 1.75rem;
		}

		.features {
			gap: 0.875rem;
		}
	}

	/* Reduce motion for accessibility */
	@media (prefers-reduced-motion: reduce) {
		.badge,
		.title,
		.subtitle,
		.cta-section,
		.features {
			animation: none;
		}

		.cta-primary::before {
			display: none;
		}
	}
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>
