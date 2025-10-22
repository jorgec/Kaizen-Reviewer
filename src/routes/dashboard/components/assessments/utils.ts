import type { AssessmentCard, AssessmentsSortKey, SortDir, AssessmentType } from './types';

/** Mirrors your sorting logic */
export function sortAssessments(list: AssessmentCard[], key: AssessmentsSortKey, dir: SortDir) {
	const sorted = [...list].sort((a, b) => {
		let v1: any, v2: any;
		switch (key) {
			case 'date':
				v1 = a.assigned_at || a.completed_at;
				v2 = b.assigned_at || b.completed_at;
				return (new Date(v1).getTime() - new Date(v2).getTime()) * (dir === 'asc' ? 1 : -1);
			case 'title':
				v1 = (a.title || '').toLowerCase();
				v2 = (b.title || '').toLowerCase();
				return v1.localeCompare(v2) * (dir === 'asc' ? 1 : -1);
			case 'type':
				v1 = (a.type || '').toLowerCase();
				v2 = (b.type || '').toLowerCase();
				return v1.localeCompare(v2) * (dir === 'asc' ? 1 : -1);
			case 'score':
				v1 = a.score ?? -Infinity;
				v2 = b.score ?? -Infinity;
				return (v1 - v2) * (dir === 'asc' ? 1 : -1);
			default:
				return 0;
		}
	});
	return sorted;
}

export function filterByType(list: AssessmentCard[], typeFilters: Set<AssessmentType>) {
	return list.filter((item) => typeFilters.has(item.type as AssessmentType));
}

export function getMasteryColor(score: number | undefined | null): string {
	if (score === undefined || score === null) return 'var(--grey-light)';
	if (score >= 90) return 'var(--kaizen-mastery-excellent, #2ecc40)';
	if (score >= 75) return 'var(--kaizen-mastery-high, #00bfae)';
	if (score >= 60) return 'var(--kaizen-mastery-good, #ffd600)';
	if (score >= 40) return 'var(--kaizen-mastery-fair, #ff9800)';
	return 'var(--kaizen-mastery-low, #e74c3c)';
}