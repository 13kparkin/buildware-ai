import { generateCommitComment } from '@/actions/github/generate-commit-comment';
import { parseDiff } from '@/lib/utils/diff-utils';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');
jest.mock('@/lib/utils/diff-utils');

describe('generateCommitComment', () => {
  const mockAnthropicResponse = {
    completion: 'This is a mock AI-generated commit message.'
  };

  beforeEach(() => {
    (Anthropic as jest.Mock).mockImplementation(() => ({
      completions: {
        create: jest.fn().mockResolvedValue(mockAnthropicResponse)
      }
    }));
    (parseDiff as jest.Mock).mockReturnValue({
      filesChanged: 1,
      insertions: 10,
      deletions: 5,
      files: [
        {
          filename: 'test.ts',
          changes: [
            { type: 'add', content: '+ New line' },
            { type: 'remove', content: '- Removed line' }
          ]
        }
      ]
    });
  });

  it('should generate a commit comment successfully', async () => {
    const diff = 'mock diff content';
    const apiKey = 'mock-api-key';

    const result = await generateCommitComment(diff, apiKey);

    expect(result).toBe('This is a mock AI-generated commit message.');
    expect(Anthropic).toHaveBeenCalledWith();
    expect(parseDiff).toHaveBeenCalledWith(diff);
  });

  it('should throw an error when Anthropic API call fails', async () => {
    (Anthropic as jest.Mock).mockImplementation(() => ({
      completions: {
        create: jest.fn().mockRejectedValue(new Error('API Error'))
      }
    }));

    await expect(generateCommitComment('diff', 'api-key')).rejects.toThrow('Failed to generate commit comment');
  });

  it('should format the commit message correctly', async () => {
    const longMessage = 'This is a very long first line that exceeds fifty characters and should be truncated\n\nSecond paragraph\n\nThird paragraph';
    (Anthropic as jest.Mock).mockImplementation(() => ({
      completions: {
        create: jest.fn().mockResolvedValue({ completion: longMessage })
      }
    }));

    const result = await generateCommitComment('diff', 'api-key');

    expect(result).toBe('This is a very long first line that exceeds fifty...\n\nSecond paragraph\n\nThird paragraph');
  });
});