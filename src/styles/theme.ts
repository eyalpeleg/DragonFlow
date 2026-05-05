export const COLORS = {
    primary: '#6200EE',
    background: '#F8F9FA',
    white: '#FFFFFF',
    priority: {
        Critical: '#B71C1C',
        High: '#FF5252',
        Medium: '#FFC107',
        Low: '#4CAF50',
    },
    categories: {
        Friends: '#4A90E2',
        Personal: 'rgba(155, 39, 176, 0.75)',
        Fitness: 'rgba(239, 119, 13, 0.95)',
        Study: 'rgba(34, 218, 166, 0.69)',
    },
    status: {
        'Ready': '#78909C',
        'In Progress': '#2196F3',
        'Done': '#4CAF50',
    },
};

export const PRESET_PALETTE = [
    '#4A90E2', 'rgba(155,39,176,0.75)', 'rgba(239,119,13,0.95)', 'rgba(34,218,166,0.69)',
    '#E53935', '#F06292', '#FFB300', '#43A047',
    '#00ACC1', '#5C6BC0', '#8D6E63', '#78909C',
];

export type PriorityLevel = keyof typeof COLORS.priority;
export type CategoryType = string;
export type StatusType = keyof typeof COLORS.status;
