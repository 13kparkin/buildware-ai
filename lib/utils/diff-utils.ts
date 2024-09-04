import { ParsedDiff } from '@/types/github';

export function parseDiff(diff: string): ParsedDiff {
  const files: ParsedDiff['files'] = [];
  const lines = diff.split('\n');
  let currentFile: ParsedDiff['files'][0] | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
      }
      const filePath = line.split(' b/')[1];
      currentFile = { path: filePath, changes: [] };
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    } else if (line.startsWith('+')) {
      currentFile?.changes.push({ type: 'addition', content: line.slice(1) });
    } else if (line.startsWith('-')) {
      currentFile?.changes.push({ type: 'deletion', content: line.slice(1) });
    } else if (line.startsWith('@@ ')) {
      currentFile?.changes.push({ type: 'hunk', content: line });
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return { files };
}