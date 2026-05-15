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
import type { Task } from '../../types';

function makeTask(id: string, title: string): Task {
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
        subTasks: [],
    };
}

describe('store subtask actions', () => {
    beforeEach(() => {
        useTaskStore.setState({
            tasks: [makeTask('t1', 'Task one'), makeTask('t2', 'Task two')],
        });
    });

    it('add → toggle → remove roundtrip on one task does not affect sibling task', () => {
        const { addSubTask, toggleSubTask, removeSubTask } = useTaskStore.getState();

        addSubTask('t1', 'sub a');
        addSubTask('t1', 'sub b');

        const afterAdd = useTaskStore.getState().tasks;
        const t1Subs = afterAdd.find((t) => t.id === 't1')!.subTasks!;
        const t2Subs = afterAdd.find((t) => t.id === 't2')!.subTasks!;
        expect(t1Subs).toHaveLength(2);
        expect(t1Subs.map((s) => s.title)).toEqual(['sub a', 'sub b']);
        expect(t1Subs.every((s) => s.completed === false)).toBe(true);
        expect(t2Subs).toHaveLength(0);

        const subAId = t1Subs[0].id;
        const subBId = t1Subs[1].id;
        toggleSubTask('t1', subAId);

        const afterToggle = useTaskStore.getState().tasks;
        const t1Toggled = afterToggle.find((t) => t.id === 't1')!.subTasks!;
        expect(t1Toggled.find((s) => s.id === subAId)!.completed).toBe(true);
        expect(t1Toggled.find((s) => s.id === subBId)!.completed).toBe(false);

        removeSubTask('t1', subAId);

        const afterRemove = useTaskStore.getState().tasks;
        const t1Final = afterRemove.find((t) => t.id === 't1')!.subTasks!;
        const t2Final = afterRemove.find((t) => t.id === 't2')!.subTasks!;
        expect(t1Final).toHaveLength(1);
        expect(t1Final[0].id).toBe(subBId);
        expect(t2Final).toHaveLength(0);
    });
});
