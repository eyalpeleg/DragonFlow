// Pads "H:M" or similar to "HH:MM" so lex comparison is safe.
function normalizeTime(time: string): string {
    const [h, m] = time.split(':');
    return `${(h ?? '0').padStart(2, '0')}:${(m ?? '0').padStart(2, '0')}`;
}

export function suggestDueTime(
    selectedDate: Date,
    defaultTaskTime: string,
    now: Date = new Date(),
): string {
    const isToday = selectedDate.getFullYear() === now.getFullYear()
        && selectedDate.getMonth() === now.getMonth()
        && selectedDate.getDate() === now.getDate();
    const normalizedDefault = normalizeTime(defaultTaskTime);
    if (!isToday) return normalizedDefault;
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return nowTime > normalizedDefault ? nowTime : normalizedDefault;
}
