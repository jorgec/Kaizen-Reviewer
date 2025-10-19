// src/lib/datetime.ts

/**
 * Normalize an ISO-like string so JS Date can parse it reliably.
 * - Trims microseconds to milliseconds (6+ -> 3)
 * - Keeps as-is if no fractional seconds present
 * - Accepts 'Z' or ±HH:MM offsets
 */
export function normalizeIsoForDate(input: string): string {
	if (!input) return input;
	// Ensure there's a 'T' between date and time if user passed a space
	let s = input.replace(' ', 'T');

	// If fractional seconds exist, trim to 3 digits
	// e.g. 2025-10-19T20:46:43.326668+00:00 -> .326+00:00
	s = s.replace(/(\.\d{3})\d+/, '$1');

	return s;
}

/**
 * Parse to Date, returning `Invalid Date` if not parseable.
 */
export function toJSDate(input: string | Date): Date {
	if (input instanceof Date) return input;
	const norm = normalizeIsoForDate(input);
	return new Date(norm);
}

export type HumanFormatOpts = Intl.DateTimeFormatOptions & {
	/** Override locale; defaults to the user agent / environment */
	locale?: string;
};

/**
 * Human-friendly formatter using Intl.DateTimeFormat.
 * Example: "Oct 20, 2025, 4:46:43 PM"
 */
export function formatHuman(
	input: string | Date,
	opts: HumanFormatOpts = {}
): string {
	const d = toJSDate(input);
	if (isNaN(d.getTime())) return 'Invalid date';

	const { locale, ...intlOpts } = opts;
	const fmt = new Intl.DateTimeFormat(
		locale,
		{
			dateStyle: 'medium',
			timeStyle: 'medium',
			hour12: false,
			...intlOpts
		}
	);
	return fmt.format(d);
}

/**
 * Simple token-based formatter for custom patterns.
 * Supported tokens: YYYY MM DD HH mm ss SSS
 * Z (±HH:MM) and ZZ (±HHMM) for the *offset of the given instant in the chosen zone is not computed*;
 * this function formats the *local* offset of the runtime environment.
 * If you need specific timeZone formatting, prefer `formatHuman({ timeZone })`.
 */
export function formatPattern(input: string | Date, pattern = 'YYYY-MM-DD HH:mm:ss'): string {
	const d = toJSDate(input);
	if (isNaN(d.getTime())) return 'Invalid date';

	const pad = (n: number, w = 2) => String(n).padStart(w, '0');

	const year = d.getFullYear();
	const month = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	const hour = pad(d.getHours());
	const minute = pad(d.getMinutes());
	const second = pad(d.getSeconds());
	const millis = pad(d.getMilliseconds(), 3);

	// Local offset
	const tzMin = -d.getTimezoneOffset();
	const sign = tzMin >= 0 ? '+' : '-';
	const tzAbs = Math.abs(tzMin);
	const tzH = pad(Math.floor(tzAbs / 60));
	const tzM = pad(tzAbs % 60);
	const Z = `${sign}${tzH}:${tzM}`;
	const ZZ = `${sign}${tzH}${tzM}`;

	return pattern
		.replace(/YYYY/g, String(year))
		.replace(/MM/g, month)
		.replace(/DD/g, day)
		.replace(/HH/g, hour)
		.replace(/mm/g, minute)
		.replace(/ss/g, second)
		.replace(/SSS/g, millis)
		.replace(/ZZ/g, ZZ)
		.replace(/Z/g, Z);
}

/**
 * Relative time like "in 3 hours" / "2 days ago".
 */
export function formatRelative(from: string | Date, to: string | Date = new Date()): string {
	const start = toJSDate(from).getTime();
	const end = toJSDate(to).getTime();
	if (isNaN(start) || isNaN(end)) return 'Invalid date';

	const diffSec = Math.round((start - end) / 1000);
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

	const divisions: Array<[unit: Intl.RelativeTimeFormatUnit, secs: number]> = [
		['year', 31536000],
		['month', 2592000],
		['week', 604800],
		['day', 86400],
		['hour', 3600],
		['minute', 60],
		['second', 1],
	];

	for (const [unit, secs] of divisions) {
		if (Math.abs(diffSec) >= secs || unit === 'second') {
			const value = Math.round(diffSec / secs);
			return rtf.format(value, unit);
		}
	}
	return '';
}

/**
 * Convenience: format as UTC without changing the instant.
 */
export function formatUTC(input: string | Date, opts: Omit<HumanFormatOpts, 'timeZone'> = {}) {
	return formatHuman(input, { ...opts, timeZone: 'UTC' });
}
