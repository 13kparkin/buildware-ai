export interface ParsedDiff {
  files: {
    path: string;
    changes: Array<{
      type: 'addition' | 'deletion' | 'hunk';
      content: string;
    }>;
  }[];
}