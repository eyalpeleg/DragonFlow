import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTaskStore } from '../store/taskStore';
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

export function validateExportData(data: unknown): data is ExportPayload {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    return (
        typeof d.version === 'number' &&
        Array.isArray(d.tasks) &&
        Array.isArray(d.categories)
    );
}

export async function exportToFile(): Promise<void> {
    const payload = useTaskStore.getState().exportData();
    const json = JSON.stringify(payload, null, 2);
    const file = new File(Paths.cache, 'dragonflow-backup.json');
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
