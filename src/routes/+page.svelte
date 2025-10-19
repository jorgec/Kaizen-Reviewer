<script lang="ts">
	// pure front page – no imports needed
</script>

<div class="fullscreen">
	<div class="overlay"></div>

	<div class="content">
		<h1 class="title mb-4">Welcome to <span>Kaizen</span></h1>
		<p class="subtitle">
			Kaizen is a philosophy of continuous improvement — making small, meaningful changes every day
			to enhance learning, performance, and mastery.
		</p>
		<a href="/login" class="cta">Get Started</a>
	</div>
</div>

<style>
    /* ============================================================
			 Fullscreen Landing Page (No Layout, No Bulma)
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
        background: linear-gradient(to bottom right, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.35));
        backdrop-filter: blur(3px);
        z-index: 1;
    }

    .content {
        position: relative;
        z-index: 2;
        color: #fff;
        max-width: 700px;
        padding: 2rem;
        text-shadow: 0 2px 15px rgba(0, 0, 0, 0.5);
    }

    .title {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        font-size: 3rem;
        line-height: 1.2;
        margin-bottom: 1rem;
				color: white;
    }

    .title span {
        background: linear-gradient(90deg, #a855f7, #6366f1, #3b82f6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 2rem;
    }

    .cta {
        display: inline-block;
        background: linear-gradient(90deg, #a855f7, #6366f1);
        color: #fff;
        padding: 0.9rem 2.2rem;
        border-radius: 999px;
        font-weight: 600;
        text-decoration: none;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 6px 25px rgba(99, 102, 241, 0.35);
        transition: all 0.25s ease;
    }

    .cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5);
        background: linear-gradient(90deg, #8b5cf6, #4338ca);
    }

    /* --- Mobile Scaling --- */
    @media (max-width: 768px) {
        .title { font-size: 2.1rem; }
        .subtitle { font-size: 1.1rem; padding: 0 0.5rem; }
        .cta { font-size: 1rem; padding: 0.8rem 1.8rem; }
    }
</style>

<script context="module" lang="ts">
	export const ssr = false;
</script>