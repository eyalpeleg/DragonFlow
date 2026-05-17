/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('../../utils/notifications', () => ({
    scheduleTaskReminders: jest.fn().mockResolvedValue(undefined),
    cancelTaskReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../modules/FloatingBubble', () => ({
    __esModule: true,
    default: {
        show: jest.fn(),
        hide: jest.fn(),
        scheduleSound: jest.fn(),
        cancelSound: jest.fn(),
        canDrawOverlays: jest.fn().mockResolvedValue(true),
        requestOverlayPermission: jest.fn(),
        onDismissed: jest.fn(() => () => {}),
        onOpenFocus: jest.fn(() => () => {}),
        startPomodoroTimer: jest.fn(),
        stopPomodoroTimer: jest.fn(),
    },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore } from '../appStore';

const mockGetItem = AsyncStorage.getItem as jest.Mock;

interface ZustandPersistedShape {
    state: Record<string, unknown>;
    version: number;
}

function persistedBlob(state: Record<string, unknown>): string {
    return JSON.stringify({ state, version: 0 } as ZustandPersistedShape);
}

async function hydrateWith(state: Record<string, unknown>): Promise<void> {
    mockGetItem.mockResolvedValueOnce(persistedBlob(state));
    // zustand v5 attaches `.persist` to the store; rehydrate re-runs the merge.
    await (useTaskStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate();
}

beforeEach(() => {
    // Reset state between tests so merge doesn't inherit residue from the previous case.
    useTaskStore.setState({
        tasks: [],
        categories: [],
        deletedBuiltinCategoryIds: [],
        firstDayOfWeek: 'sunday',
        statusFilters: new Set(),
        categoryFilters: new Set(),
        priorityFilters: new Set(),
        dueDateFilters: new Set(),
        pomodoroSoundType: 'AppSound',
        tasksSoundType: 'AppSound',
    });
});

describe('appStore persist.merge — v0 → v1 migration', () => {
    it('converts task.category (name) to task.categoryId (canonical built-in id)', async () => {
        await hydrateWith({
            tasks: [
                {
                    id: 't1', title: 'A', description: '', priority: 'Medium',
                    category: 'Friends', dueDate: '2026-05-15', dueTime: '08:00',
                    status: 'Ready', createdAt: 0, subTasks: [],
                },
                {
                    id: 't2', title: 'B', description: '', priority: 'High',
                    category: 'Personal', dueDate: '', dueTime: '08:00',
                    status: 'Done', createdAt: 0, subTasks: [],
                },
            ],
            categories: [
                { name: 'Default', color: '#607D8B' },
                { name: 'Friends', color: '#4A90E2' },
                { name: 'Personal', color: 'rgba(155, 39, 176, 0.75)' },
            ],
        });

        const state = useTaskStore.getState();
        const idByName = Object.fromEntries(state.categories.map((c) => [c.name, c.id]));
        expect(idByName.Default).toBe('default');
        expect(idByName.Friends).toBe('friends');
        expect(idByName.Personal).toBe('personal');

        const byId = Object.fromEntries(state.tasks.map((t) => [t.id, t]));
        expect(byId.t1.categoryId).toBe('friends');
        expect(byId.t2.categoryId).toBe('personal');
        // The legacy `category` field is dropped.
        expect((byId.t1 as unknown as { category?: string }).category).toBeUndefined();
    });

    it('gives custom categories generated IDs and falls back to default for orphan tasks', async () => {
        await hydrateWith({
            tasks: [
                {
                    id: 't-orphan', title: 'no cat', description: '',
                    priority: 'Medium', dueDate: '', dueTime: '08:00',
                    status: 'Ready', createdAt: 0, subTasks: [],
                },
                {
                    id: 't-custom', title: 'custom', description: '',
                    priority: 'Low', category: 'Custom',
                    dueDate: '', dueTime: '08:00', status: 'Ready',
                    createdAt: 0, subTasks: [],
                },
            ],
            categories: [{ name: 'Custom', color: '#ABCDEF' }],
        });

        const state = useTaskStore.getState();
        const custom = state.categories.find((c) => c.name === 'Custom');
        expect(custom).toBeDefined();
        expect(custom!.id).not.toBe('default');

        const byId = Object.fromEntries(state.tasks.map((t) => [t.id, t]));
        expect(byId['t-orphan'].categoryId).toBe('default');
        expect(byId['t-custom'].categoryId).toBe(custom!.id);
    });

    it('prepends a Default category when v0 data is missing it', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ name: 'OnlyOne', color: '#000' }],
        });
        const def = useTaskStore.getState().categories.find((c) => c.id === 'default');
        expect(def).toBeDefined();
        expect(def!.name).toBe('Default');
    });
});

describe('appStore persist.merge — sound-type coercion', () => {
    it('coerces removed sound-type values to AppSound', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            _schemaVersion: 1,
            pomodoroSoundType: 'SystemSound',
            tasksSoundType: 'Custom',
        });
        const state = useTaskStore.getState();
        expect(state.pomodoroSoundType).toBe('AppSound');
        expect(state.tasksSoundType).toBe('AppSound');
    });

    it('preserves "Disabled" and "AppSound"', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            _schemaVersion: 1,
            pomodoroSoundType: 'Disabled',
            tasksSoundType: 'AppSound',
        });
        const state = useTaskStore.getState();
        expect(state.pomodoroSoundType).toBe('Disabled');
        expect(state.tasksSoundType).toBe('AppSound');
    });
});

describe('appStore persist.merge — built-in category re-add', () => {
    it('re-adds built-in categories that are missing AND not in deletedBuiltinCategoryIds', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            deletedBuiltinCategoryIds: ['friends'],
            _schemaVersion: 1,
        });
        const ids = useTaskStore.getState().categories.map((c) => c.id);
        expect(ids).toContain('default');
        // Explicitly deleted by user → not re-added.
        expect(ids).not.toContain('friends');
        // Not in the deletion list → re-added.
        expect(ids).toEqual(expect.arrayContaining(['personal', 'fitness', 'study']));
    });

    it('always re-adds Default even when listed in deletedBuiltinCategoryIds (orphan-task fallback)', async () => {
        await hydrateWith({
            tasks: [],
            categories: [],
            deletedBuiltinCategoryIds: ['default'],
            _schemaVersion: 1,
        });
        const ids = useTaskStore.getState().categories.map((c) => c.id);
        expect(ids).toContain('default');
    });
});

describe('appStore persist.merge — filter Set rehydration & stripped keys', () => {
    it('rehydrates status/priority/dueDate filters from persisted arrays into Sets', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            _schemaVersion: 1,
            statusFilters: ['Ready', 'Done'],
            priorityFilters: ['High'],
            dueDateFilters: ['today', 'overdue'],
            categoryFilters: ['friends'], // intentionally ignored
        });
        const state = useTaskStore.getState();

        expect(state.statusFilters).toBeInstanceOf(Set);
        expect(state.statusFilters.has('Ready')).toBe(true);
        expect(state.statusFilters.has('Done')).toBe(true);

        expect(state.priorityFilters.has('High')).toBe(true);

        expect(state.dueDateFilters.has('today')).toBe(true);
        expect(state.dueDateFilters.has('overdue')).toBe(true);

        // categoryFilters is intentionally reset on rehydrate.
        expect(state.categoryFilters.size).toBe(0);
    });

    it('drops the legacy `activeCategory` key from rehydrated state', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            _schemaVersion: 1,
            activeCategory: 'stale-value',
        });
        const state = useTaskStore.getState() as unknown as { activeCategory?: string };
        expect(state.activeCategory).toBeUndefined();
    });
});

describe('appStore persist.merge — defaults', () => {
    it('defaults firstDayOfWeek to "sunday" when not persisted', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            _schemaVersion: 1,
        });
        expect(useTaskStore.getState().firstDayOfWeek).toBe('sunday');
    });

    it('preserves persisted firstDayOfWeek="monday"', async () => {
        await hydrateWith({
            tasks: [],
            categories: [{ id: 'default', name: 'Default', color: '#607D8B' }],
            _schemaVersion: 1,
            firstDayOfWeek: 'monday',
        });
        expect(useTaskStore.getState().firstDayOfWeek).toBe('monday');
    });

    it('returns the current (default) state when storage has no persisted data', async () => {
        mockGetItem.mockResolvedValueOnce(null);
        await (useTaskStore as unknown as { persist: { rehydrate: () => Promise<void> } }).persist.rehydrate();
        const state = useTaskStore.getState();
        expect(Array.isArray(state.tasks)).toBe(true);
        expect(state.categories).toBeDefined();
    });
});
