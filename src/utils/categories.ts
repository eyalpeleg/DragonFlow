import { Category } from '../types';
import { COLORS } from '../styles/theme';

export function getCategoryColor(categories: Category[], id: string): string {
    return categories.find((c) => c.id === id)?.color ?? COLORS.primary;
}

export function getCategoryName(categories: Category[], id: string): string {
    return categories.find((c) => c.id === id)?.name ?? 'Unknown';
}
