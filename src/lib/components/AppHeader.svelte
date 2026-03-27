<script lang="ts">
	import { page } from '$app/stores';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime.js';
</script>

<header>
	<div class="header-row">
		<div class="brand">
			<img src="/primavera-logo.png" alt="Primavera" class="logo" />
			<p class="subtitle">{m.app_subtitle()}</p>
		</div>

		<nav class="lang-switcher" aria-label="Language">
			{#each locales as locale}
				<a
					href={localizeHref($page.url.pathname, { locale })}
					class:active={getLocale() === locale}
					data-sveltekit-reload
					aria-current={getLocale() === locale ? 'page' : undefined}
				>
					{locale.toUpperCase()}
				</a>
			{/each}
		</nav>
	</div>
</header>

<style>
	header {
		margin-bottom: 1.25rem;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.logo {
		height: 40px;
		image-rendering: pixelated;
		flex-shrink: 0;
		display: block;
	}

	.subtitle {
		margin: 0;
		color: #9a8e82;
		font-size: 0.78rem;
		font-weight: 400;
		line-height: 1;
		letter-spacing: 0.01em;
		align-self: center;
	}

	.lang-switcher {
		display: flex;
		gap: 0.2rem;
		flex-shrink: 0;
	}

	.lang-switcher a {
		font-size: 0.65rem;
		padding: 0.2rem 0.45rem;
		border-radius: 5px;
		text-decoration: none;
		color: #b0a496;
		font-weight: 600;
		letter-spacing: 0.06em;
		transition: color 0.2s, background 0.2s;
	}

	.lang-switcher a:hover {
		color: #3a7a4c;
		background: rgba(58, 122, 76, 0.06);
	}

	.lang-switcher a.active {
		color: #3a7a4c;
		background: rgba(58, 122, 76, 0.08);
	}

	@media (max-width: 600px) {
		.header-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.lang-switcher {
			align-self: flex-start;
		}
	}
</style>
