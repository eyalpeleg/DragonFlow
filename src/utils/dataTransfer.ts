import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTaskStore } from '../store/appStore';
import { Category, Task } from '../types';

export interface ExportPayload {
    version: number;
    exportedAt: string;
    tasks: Task[];
    categories: Category[];
    settings?: {
        defaultTaskTime?: string;
        showBubbleInBackground?: boolean;
    };
}

function isValidTask(obj: unknown): obj is Task {
    if (typeof obj !== 'object' || obj === null) return false;
    const t = obj as Record<string, unknown>;
    return (
        typeof t.id === 'string' &&
        typeof t.title === 'string' &&
        typeof t.description === 'string' &&
        ['Critical', 'High', 'Medium', 'Low'].includes(t.priority as string) &&
        typeof t.categoryId === 'string' &&
        typeof t.dueDate === 'string' &&
        typeof t.dueTime === 'string' &&
        ['Ready', 'In Progress', 'Paused', 'Done'].includes(t.status as string) &&
        Array.isArray(t.subTasks)
    );
}

function isValidCategory(obj: unknown): obj is Category {
    if (typeof obj !== 'object' || obj === null) return false;
    const c = obj as Record<string, unknown>;
    return (
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        typeof c.color === 'string' &&
        c.name.trim().length > 0
    );
}

export function validateExportData(data: unknown): data is ExportPayload {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;

    if (typeof d.version !== 'number') return false;
    if (!Array.isArray(d.tasks)) return false;
    if (!Array.isArray(d.categories)) return false;

    if (d.tasks.length > 50000) return false;
    if (d.categories.length > 1000) return false;

    return (
        d.tasks.every(isValidTask) &&
        d.categories.every(isValidCategory)
    );
}

export async function exportToFile(): Promise<void> {
    const payload = useTaskStore.getState().exportData();
    const json = JSON.stringify(payload, null, 2);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const hour = pad(now.getHours());
    const file = new File(Paths.cache, `dragonFlow-backup.${date}.${hour}.json`);
    file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export DragonFlow Data' });
}

export async function importFromFile(): Promise<{ tasksImported: number } | null> {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return null;

    const pickedFile = new File(result.assets[0].uri);
    const content = await pickedFile.text();

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('Invalid JSON file');
    }

    if (!validateExportData(parsed)) {
        throw new Error('Invalid backup file format');
    }

    return useTaskStore.getState().importData(parsed);
}
