/* eslint-disable import/first */
jest.mock('expo-file-system', () => ({
    File: jest.fn(),
    Paths: { cache: '/tmp' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
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

import { validateExportData } from '../dataTransfer';
import type { Category, Task } from '../../types';

const validTask: Task = {
    id: 't1',
    title: 'task',
    description: '',
    priority: 'Medium',
    categoryId: 'default',
    dueDate: '2026-05-15',
    dueTime: '08:00',
    status: 'Ready',
    createdAt: 0,
    subTasks: [],
};

const validCategory: Category = {
    id: 'default',
    name: 'Default',
    color: '#000000',
};

function payload(overrides: Record<string, unknown> = {}) {
    return {
        version: 1,
        exportedAt: '2026-05-15T00:00:00.000Z',
        tasks: [validTask],
        categories: [validCategory],
        ...overrides,
    };
}

describe('validateExportData', () => {
    it('accepts a valid payload', () => {
        expect(validateExportData(payload())).toBe(true);
    });

    it('accepts empty tasks and categories arrays', () => {
        expect(validateExportData(payload({ tasks: [], categories: [] }))).toBe(true);
    });

    it('rejects non-object inputs', () => {
        expect(validateExportData(null)).toBe(false);
        expect(validateExportData(undefined)).toBe(false);
        expect(validateExportData('json')).toBe(false);
        expect(validateExportData(123)).toBe(false);
        expect(validateExportData([])).toBe(false);
    });

    it('rejects payloads missing required top-level fields', () => {
        expect(validateExportData({ tasks: [], categories: [] })).toBe(false);
        expect(validateExportData({ version: 1, categories: [] })).toBe(false);
        expect(validateExportData({ version: 1, tasks: [] })).toBe(false);
    });

    it('rejects payloads with wrong top-level types', () => {
        expect(validateExportData(payload({ version: '1' }))).toBe(false);
        expect(validateExportData(payload({ tasks: 'not array' }))).toBe(false);
        expect(validateExportData(payload({ categories: {} }))).toBe(false);
    });

    it('enforces the 50 000-task array-size limit', () => {
        const bigTasks = new Array(50001).fill(validTask);
        expect(validateExportData(payload({ tasks: bigTasks }))).toBe(false);
    });

    it('enforces the 1 000-category array-size limit', () => {
        const bigCategories = new Array(1001).fill(validCategory);
        expect(validateExportData(payload({ categories: bigCategories }))).toBe(false);
    });

    describe('per-task validation', () => {
        it('rejects tasks with an invalid priority value', () => {
            expect(
                validateExportData(payload({ tasks: [{ ...validTask, priority: 'Urgent' }] })),
            ).toBe(false);
        });

        it('rejects tasks with an invalid status value', () => {
            expect(
                validateExportData(payload({ tasks: [{ ...validTask, status: 'Wat' }] })),
            ).toBe(false);
        });

        it('rejects tasks missing the subTasks array', () => {
            const { subTasks: _subTasks, ...rest } = validTask;
            void _subTasks;
            expect(validateExportData(payload({ tasks: [rest] }))).toBe(false);
        });

        it('rejects tasks where subTasks is not an array', () => {
            expect(
                validateExportData(payload({ tasks: [{ ...validTask, subTasks: 'no' }] })),
            ).toBe(false);
        });

        it('rejects tasks with non-string scalar fields', () => {
            expect(validateExportData(payload({ tasks: [{ ...validTask, id: 1 }] }))).toBe(false);
            expect(validateExportData(payload({ tasks: [{ ...validTask, title: null }] }))).toBe(false);
            expect(validateExportData(payload({ tasks: [{ ...validTask, description: 7 }] }))).toBe(false);
            expect(validateExportData(payload({ tasks: [{ ...validTask, categoryId: false }] }))).toBe(false);
            expect(validateExportData(payload({ tasks: [{ ...validTask, dueDate: 20260515 }] }))).toBe(false);
            expect(validateExportData(payload({ tasks: [{ ...validTask, dueTime: null }] }))).toBe(false);
        });

        it('rejects null / non-object task entries', () => {
            expect(validateExportData(payload({ tasks: [null] }))).toBe(false);
            expect(validateExportData(payload({ tasks: ['not a task'] }))).toBe(false);
        });

        it('rejects when any task in the array is invalid (one bad apple)', () => {
            expect(
                validateExportData(
                    payload({ tasks: [validTask, { ...validTask, priority: 'Nope' }] }),
                ),
            ).toBe(false);
        });
    });

    describe('per-category validation', () => {
        it('rejects categories with empty or whitespace-only names', () => {
            expect(
                validateExportData(payload({ categories: [{ ...validCategory, name: '' }] })),
            ).toBe(false);
            expect(
                validateExportData(payload({ categories: [{ ...validCategory, name: '   ' }] })),
            ).toBe(false);
        });

        it('rejects categories missing required fields', () => {
            expect(validateExportData(payload({ categories: [{ id: 'x', name: 'Y' }] }))).toBe(false);
            expect(validateExportData(payload({ categories: [{ id: 'x', color: '#fff' }] }))).toBe(false);
            expect(validateExportData(payload({ categories: [{ name: 'Y', color: '#fff' }] }))).toBe(false);
        });

        it('rejects null / non-object category entries', () => {
            expect(validateExportData(payload({ categories: [null] }))).toBe(false);
        });
    });
});
