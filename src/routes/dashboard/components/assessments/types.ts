export type AssessmentType = 'prompt' | 'short_quiz' | 'long_quiz' | 'mock_exam';

export type AssessmentCard = {
	instance_id: string;
	title: string;
	description?: string | null;
	type: AssessmentType;
	status: 'assigned' | 'in_progress' | 'completed';
	score?: number | null;
	raw_score?: number | null;
	total_items?: number | null;
	answered_items?: number | null;
	progress?: number | null; // 0..100 in your current UI
	assigned_at?: string | null;
	last_activity_at?: string | null;
	completed_at?: string | null;
	duration_seconds?: number | null;
	parent_id?: string | null;
	settings?: object | null;
};

export type SortDir = 'asc' | 'desc';
export type AssessmentsSortKey = 'date' | 'title' | 'type' | 'score';

export type TypeLabels = Record<AssessmentType, string>;