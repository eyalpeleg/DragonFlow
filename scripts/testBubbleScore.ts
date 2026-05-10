// Self-contained test — mirrors computeBubbleScore from src/store/taskStore.ts

type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
type Status = 'Ready' | 'In Progress' | 'Paused' | 'Done';

interface Task {
    dueDate: string;
    status: Status;
    priority: Priority;
    archivedAt?: number;
}

function computeBubbleScore(tasks: Task[], todayStr: string, tomorrowStr: string): number {
    return tasks.filter((t) => {
        if (t.archivedAt) return false;
        if (t.status === 'Done') return false;
        if (t.dueDate < todayStr) return true;
        if (t.dueDate === todayStr) return true;
        if (t.dueDate === tomorrowStr && (t.priority === 'Critical' || t.priority === 'High')) return true;
        return false;
    }).length;
}

const TODAY    = '2026-05-10';
const TOMORROW = '2026-05-11';
const YESTERDAY = '2026-05-09';
const FUTURE   = '2026-05-15';

function t(overrides: Partial<Task>): Task {
    return { dueDate: TODAY, status: 'Ready', priority: 'Medium', ...overrides };
}

let passed = 0, failed = 0;
function assert(label: string, actual: number, expected: number) {
    if (actual === expected) {
        console.log(`  ✓  ${label}`);
        passed++;
    } else {
        console.log(`  ✗  ${label}: expected ${expected}, got ${actual}`);
        failed++;
    }
}

console.log('\n── Overdue tasks ──');
assert('any priority counts',    computeBubbleScore([t({ dueDate: YESTERDAY })], TODAY, TOMORROW), 1);
assert('Done skipped',           computeBubbleScore([t({ dueDate: YESTERDAY, status: 'Done' })], TODAY, TOMORROW), 0);
assert('archived skipped',       computeBubbleScore([t({ dueDate: YESTERDAY, archivedAt: 1 })], TODAY, TOMORROW), 0);
assert('Low priority counts',    computeBubbleScore([t({ dueDate: YESTERDAY, priority: 'Low' })], TODAY, TOMORROW), 1);

console.log('\n── Today tasks ──');
assert('any priority counts',    computeBubbleScore([t({ dueDate: TODAY })], TODAY, TOMORROW), 1);
assert('Done skipped',           computeBubbleScore([t({ dueDate: TODAY, status: 'Done' })], TODAY, TOMORROW), 0);
assert('Low priority counts',    computeBubbleScore([t({ dueDate: TODAY, priority: 'Low' })], TODAY, TOMORROW), 1);
assert('In Progress counts',     computeBubbleScore([t({ dueDate: TODAY, status: 'In Progress' })], TODAY, TOMORROW), 1);

console.log('\n── Tomorrow tasks ──');
assert('Critical counts',        computeBubbleScore([t({ dueDate: TOMORROW, priority: 'Critical' })], TODAY, TOMORROW), 1);
assert('High counts',            computeBubbleScore([t({ dueDate: TOMORROW, priority: 'High' })], TODAY, TOMORROW), 1);
assert('Medium skipped',         computeBubbleScore([t({ dueDate: TOMORROW, priority: 'Medium' })], TODAY, TOMORROW), 0);
assert('Low skipped',            computeBubbleScore([t({ dueDate: TOMORROW, priority: 'Low' })], TODAY, TOMORROW), 0);
assert('Critical Done skipped',  computeBubbleScore([t({ dueDate: TOMORROW, priority: 'Critical', status: 'Done' })], TODAY, TOMORROW), 0);

console.log('\n── Future tasks ──');
assert('Critical skipped',       computeBubbleScore([t({ dueDate: FUTURE, priority: 'Critical' })], TODAY, TOMORROW), 0);

console.log('\n── Combined score ──');
assert('score = 3',
    computeBubbleScore([
        t({ dueDate: YESTERDAY }),                               // +1 overdue
        t({ dueDate: TODAY }),                                   // +1 today
        t({ dueDate: TOMORROW, priority: 'Critical' }),          // +1 tomorrow critical
        t({ dueDate: TOMORROW, priority: 'Medium' }),            // 0  tomorrow medium
        t({ dueDate: TODAY, status: 'Done' }),                   // 0  done
        t({ dueDate: FUTURE, priority: 'Critical' }),            // 0  future
    ], TODAY, TOMORROW),
    3
);

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
