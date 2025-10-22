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
		currentDiscipline: null as null | { discipline_id: number; discipline_code?: string; discipline_name?: string; is_primary?: boolean },
		currentOrg: null as null | { org_id: number; org_name?: string; role_in_org?: string }
	};

	// Helper to select initial currentDiscipline and currentOrg
	function withInitialSelections(user: any) {
		if (!user) return user;
		let currentDiscipline = null;
		if (Array.isArray(user.disciplines) && user.disciplines.length > 0) {
			const primary = user.disciplines.find((d: any) => d.is_primary);
			currentDiscipline = primary ?? user.disciplines[0];
		}
		let currentOrg = null;
		if (Array.isArray(user.orgs) && user.orgs.length > 0) {
			currentOrg = user.orgs[0];
		}
		return {
			...user,
			currentDiscipline,
			currentOrg
		};
	}
	const store = writable(
		withInitialSelections(storedUser || defaultValue)
	);


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

	return {
		...store,
		setCurrentDisciplineById(discipline_id: number) {
			let next: any;
			store.update((u: any) => {
				if (!u) return u;
				const found = Array.isArray(u.disciplines) ? u.disciplines.find((d: any) => Number(d.discipline_id) === Number(discipline_id)) : null;
				next = { ...u, currentDiscipline: found ?? null };
				return next;
			});
			return next?.currentDiscipline ?? null;
		},
		ensureCurrentDiscipline() {
			store.update((u: any) => {
				if (!u) return u;
				if (u.currentDiscipline && u.disciplines?.some((d: any) => d.discipline_id === u.currentDiscipline.discipline_id)) return u;
				const first = Array.isArray(u.disciplines) && u.disciplines.length > 0 ? u.disciplines[0] : null;
				return { ...u, currentDiscipline: first };
			});
		},
		setCurrentOrgById(org_id: string) {
			let next: any;
			store.update((u: any) => {
				if (!u) return u;
				const found = Array.isArray(u.orgs) ? u.orgs.find((d: any) => d.org_id === org_id) : null;
				next = { ...u, currentOrg: found ?? null };
				return next;
			});
			return next?.currentOrg ?? null;
		},
		ensureCurrentOrg() {
			store.update((u: any) => {
				if (!u) return u;
				if (u.currentOrg && u.orgs?.some((d: any) => d.org_id === u.currentOrg.org_id)) return u;
				const first = Array.isArray(u.orgs) && u.orgs.length > 0 ? u.orgs[0] : null;
				return { ...u, currentOrg: first };
			});
		}
	};
}

export const userStore = createUserStore();