import { AppColors } from '../styles/theme';

export type PomodoroMode = { label: string; minutes: number; color: string };

export type PomodoroModeIdx = 0 | 1 | 2 | 3;

export function makePomodoroModes(c: AppColors): readonly PomodoroMode[] {
    return [
        { label: 'Focus', minutes: 25, color: c.secondary },
        { label: 'Short Break', minutes: 5, color: c.secondary },
        { label: 'Long Break', minutes: 15, color: c.secondary },
    ] as const;
}
