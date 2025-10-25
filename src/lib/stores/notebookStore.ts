import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

interface NotebookCounts {
	pending_flags: number;
	active_notes: number;
	due_today: number;
}

interface NotebookData {
	notebook_id: string | null;
	counts: NotebookCounts;
}

function createNotebookStore() {
	const { subscribe, set, update } = writable<NotebookData>({
		notebook_id: null,
		counts: {
			pending_flags: 0,
			active_notes: 0,
			due_today: 0
		}
	});

	return {
		subscribe,
		async refresh(userId: string, orgId: string) {
			try {
				const { data, error } = await supabase.rpc('rpc_notes_ensure_default_and_counts', {
					p_user_id: userId,
					p_org_id: orgId
				});

				if (error) throw error;

				if (data) {
					set({
						notebook_id: data.notebook_id,
						counts: data.counts || {
							pending_flags: 0,
							active_notes: 0,
							due_today: 0
						}
					});
				}
			} catch (err) {
				console.error('Error refreshing notebook counts:', err);
			}
		},
		reset() {
			set({
				notebook_id: null,
				counts: {
					pending_flags: 0,
					active_notes: 0,
					due_today: 0
				}
			});
		}
	};
}

export const notebookStore = createNotebookStore();
