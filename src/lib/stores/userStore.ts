import { writable } from 'svelte/store';

function createUserStore() {
	// Only read localStorage in browser (avoids SSR errors)
	let storedUser = null;
	if (typeof window !== 'undefined') {
		try {
			const raw = localStorage.getItem('user');
			if (raw) storedUser = JSON.parse(raw);
		} catch {
			storedUser = null;
		}
	}

	const defaultValue = {
		user_id: null,
		email: null,
		display_name: null,
		orgs: [],
		roles: [],
		disciplines: [],
	};

	const store = writable(storedUser || defaultValue);

	// Persist changes in browser
	if (typeof window !== 'undefined') {
		store.subscribe((value) => {
			try {
				// treat defaultValue as "logged out" → clear storage
				const isDefault =
					!value ||
					(!value.user_id &&
						!value.email &&
						Array.isArray(value.orgs) &&
						value.orgs.length === 0 &&
						Array.isArray(value.roles) &&
						value.roles.length === 0);

				if (isDefault) localStorage.removeItem('user');
				else localStorage.setItem('user', JSON.stringify(value));
			} catch {
				/* ignore storage errors */
			}
		});
	}

	return store;
}

export const userStore = createUserStore();