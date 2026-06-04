import { useTaskStore } from '../store/appStore';
import { AppColors, darkColors, lightColors } from './theme';

export type ColorMode = 'light' | 'dark';

export function useColorMode(): ColorMode {
    const darkMode = useTaskStore((s) => s.darkMode);
    return darkMode ? 'dark' : 'light';
}

export function useColors(): AppColors {
    const mode = useColorMode();
    return mode === 'dark' ? darkColors : lightColors;
}
