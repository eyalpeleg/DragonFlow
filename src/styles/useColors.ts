import { useTaskStore } from '../store/appStore';
import { AppColors, darkColors, lightColors } from './theme';

export type ColorMode = 'light' | 'dark';

export function useColorMode(): ColorMode {
    return useTaskStore((s) => s.darkMode) ? 'dark' : 'light';
}

export function useColors(): AppColors {
    return useColorMode() === 'dark' ? darkColors : lightColors;
}
