export const COLORS = {
    primary: '#6200EE',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    white: '#FFFFFF',
    black: '#000000',
    shadow: '#000000',
    notification: '#6200EE',

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

    themeDefaults: {
        primary: '#6200EE',
        secondary: '#88d295',
        action: '#a2d9a1',
    },
};

export const PRESET_PALETTE = [
    '#4A90E2', 'rgba(155,39,176,0.75)', 'rgba(239,119,13,0.95)', 'rgba(34,218,166,0.69)',
    '#E53935', '#F06292', '#FFB300', '#43A047',
    '#00ACC1', '#5C6BC0', '#8D6E63', '#78909C',
];

export type PriorityLevel = keyof typeof COLORS.priority;
export type StatusType = keyof typeof COLORS.status;
