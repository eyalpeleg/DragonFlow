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
        startPomodoroTimer: jest.fn(),
        stopPomodoroTimer: jest.fn(),
    },
}));

import { useTaskStore } from '../appStore';
import type { SubTask, Task } from '../../types';

function makeTask(id: string, title: string, subTasks: SubTask[] = []): Task {
    return {
        id,
        title,
        description: '',
        priority: 'Medium',
        categoryId: 'default',
        dueDate: '',
        dueTime: '08:00',
        status: 'Ready',
        createdAt: Date.now(),
        subTasks,
    };
}

describe('store subtask actions', () => {
    beforeEach(() => {
        useTaskStore.setState({
            tasks: [
                makeTask('t1', 'Task one', [
                    { id: 'sa', title: 'sub a', completed: false },
                    { id: 'sb', title: 'sub b', completed: false },
                ]),
                makeTask('t2', 'Task two', [
                    { id: 'sc', title: 'sub c', completed: false },
                ]),
            ],
        });
    });

    it('toggle → remove on one task does not affect sibling task', () => {
        const { toggleSubTask, removeSubTask } = useTaskStore.getState();

        toggleSubTask('t1', 'sa');

        const afterToggle = useTaskStore.getState().tasks;
        const t1Toggled = afterToggle.find((t) => t.id === 't1')!.subTasks!;
        const t2Toggled = afterToggle.find((t) => t.id === 't2')!.subTasks!;
        expect(t1Toggled.find((s) => s.id === 'sa')!.completed).toBe(true);
        expect(t1Toggled.find((s) => s.id === 'sb')!.completed).toBe(false);
        expect(t2Toggled.find((s) => s.id === 'sc')!.completed).toBe(false);

        removeSubTask('t1', 'sa');

        const afterRemove = useTaskStore.getState().tasks;
        const t1Final = afterRemove.find((t) => t.id === 't1')!.subTasks!;
        const t2Final = afterRemove.find((t) => t.id === 't2')!.subTasks!;
        expect(t1Final.map((s) => s.id)).toEqual(['sb']);
        expect(t2Final.map((s) => s.id)).toEqual(['sc']);
    });
});
