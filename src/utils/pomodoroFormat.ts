export function formatCountdown(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
    const secs = String(safe % 60).padStart(2, '0');
    return hours > 0
        ? `${String(hours).padStart(2, '0')}:${mins}:${secs}`
        : `${mins}:${secs}`;
}

export function formatTabBadge(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    return hours > 0 ? `${hours}h` : `${mins}m`;
}
