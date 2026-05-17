export const lightColors = {
    primary: '#76578c',
    secondary: '#aa7dc9',
    action: '#88d295',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    white: '#FFFFFF',
    black: '#000000',
    shadow: '#000000',
    notification: '#76578c',

    text: {
        primary: '#222222',
        secondary: '#333333',
        body: '#444444',
        muted: '#555555',
        subtle: '#666666',
        weak: '#888888',
        placeholder: '#999999',
        light: '#AAAAAA',
        veryLight: '#BBBBBB',
        disabled: '#CCCCCC',
        error: '#E53935',
        errorStrong: '#D32F2F',
    },

    border: {
        subtle: '#F0F0F0',
        light: '#EEEEEE',
        medium: '#DDDDDD',
        muted: '#E0E0E0',
    },

    surfaceAlt: {
        light: '#FAFAFA',
        muted: '#F5F5F5',
        soft: '#F0F0F0',
        offWhite: '#F9F9F9',
    },

    overlay: {
        scrim: 'rgba(0,0,0,0.3)',
        scrimSoft: 'rgba(0,0,0,0.4)',
        scrimDeep: 'rgba(0,0,0,0.45)',
        scrimStrong: 'rgba(0,0,0,0.5)',
        whiteSoft: 'rgba(255,255,255,0.2)',
        whiteSubtle: 'rgba(255,255,255,0.8)',
        whiteStrong: 'rgba(255,255,255,0.9)',
        accentSoft: 'rgba(79,55,139,0.06)',
        accentMedium: 'rgba(79,55,139,0.08)',
        accentStrong: 'rgba(79,55,139,0.1)',
    },

    accent: {
        warning: '#FF9800',
        warningStrong: '#FF5252',
        success: '#15803D',
        successBg: '#F0FDF4',
        errorBg: '#FEF2F2',
        errorText: '#B91C1C',
    },

    priority: {
        Critical: '#B71C1C',
        High: '#FF5252',
        Medium: '#FFC107',
        Low: '#4CAF50',
    },

    status: {
        'Ready': '#78909C',
        'In Progress': '#2196F3',
        'Paused': '#FF9800',
        'Done': '#4CAF50',
    },

    statusSoft: {
        'Ready': '#B0BEC5',
        'In Progress': '#64B5F6',
        'Paused': '#FFB74D',
        'Done': '#81C784',
    },

};

export type AppColors = typeof lightColors;

export const darkColors: AppColors = {
    primary: '#76578c',
    secondary: '#aa7dc9',
    action: '#88d295',
    background: '#121212',
    surface: '#1E1E1E',
    white: '#FFFFFF',
    black: '#000000',
    shadow: '#000000',
    notification: '#76578c',

    text: {
        primary: '#ECECEC',
        secondary: '#D6D6D6',
        body: '#C8C8C8',
        muted: '#A8A8A8',
        subtle: '#8E8E8E',
        weak: '#6E6E6E',
        placeholder: '#5E5E5E',
        light: '#4E4E4E',
        veryLight: '#3E3E3E',
        disabled: '#333333',
        error: '#EF5350',
        errorStrong: '#E57373',
    },

    border: {
        subtle: '#2A2A2A',
        light: '#333333',
        medium: '#3D3D3D',
        muted: '#2F2F2F',
    },

    surfaceAlt: {
        light: '#1E1E1E',
        muted: '#222222',
        soft: '#262626',
        offWhite: '#1A1A1A',
    },

    overlay: {
        scrim: 'rgba(0,0,0,0.5)',
        scrimSoft: 'rgba(0,0,0,0.6)',
        scrimDeep: 'rgba(0,0,0,0.7)',
        scrimStrong: 'rgba(0,0,0,0.75)',
        whiteSoft: 'rgba(255,255,255,0.08)',
        whiteSubtle: 'rgba(255,255,255,0.12)',
        whiteStrong: 'rgba(255,255,255,0.18)',
        accentSoft: 'rgba(170,125,201,0.10)',
        accentMedium: 'rgba(170,125,201,0.14)',
        accentStrong: 'rgba(170,125,201,0.20)',
    },

    accent: {
        warning: '#FFA726',
        warningStrong: '#FF7043',
        success: '#66BB6A',
        successBg: '#1B3A20',
        errorBg: '#3A1B1B',
        errorText: '#EF9A9A',
    },

    priority: {
        Critical: '#B71C1C',
        High: '#FF5252',
        Medium: '#FFC107',
        Low: '#4CAF50',
    },

    status: {
        'Ready': '#78909C',
        'In Progress': '#2196F3',
        'Paused': '#FF9800',
        'Done': '#4CAF50',
    },

    statusSoft: {
        'Ready': '#546E7A',
        'In Progress': '#1976D2',
        'Paused': '#EF6C00',
        'Done': '#388E3C',
    },

};

// Back-compat alias for code that hasn't migrated to useColors() yet
// (notifications, store defaults, modules that don't render UI).
export const COLORS = lightColors;

export const PRESET_PALETTE = [
    '#4A90E2', 'rgba(155,39,176,0.75)', 'rgba(239,119,13,0.95)', 'rgba(34,218,166,0.69)',
    '#E53935', '#F06292', '#FFB300', '#43A047',
    '#00ACC1', '#5C6BC0', '#8D6E63', '#78909C',
];

export type PriorityLevel = keyof typeof lightColors.priority;
export type StatusType = keyof typeof lightColors.status;
