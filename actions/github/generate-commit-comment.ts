import Anthropic from '@anthropic-ai/sdk';
import { GitDiff, ParsedDiff } from '@/types/github';
import { parseDiff } from '@/lib/utils/diff-utils';

const anthropic = new Anthropic();

export async function generateCommitComment(diff: string, anthropicApiKey: string): Promise<string> {
  try {
    const parsedDiff: ParsedDiff = parseDiff(diff);
    const prompt = constructPrompt(parsedDiff);

    const response = await anthropic.completions.create({
      model: "claude-3-5-sonnet-20240620",
      prompt: prompt,
      max_tokens_to_sample: 500,
      temperature: 0.7,
    });

    return formatCommitMessage(response.completion);
  } catch (error) {
    console.error('Error generating commit comment:', error);
    throw new Error('Failed to generate commit comment');
  }
}

function constructPrompt(parsedDiff: ParsedDiff): string {
  return `
Analyze the following git diff and generate a comprehensive commit message:

${JSON.stringify(parsedDiff, null, 2)}

Please provide:
1. A brief summary of the overall change
2. Detailed explanations of significant modifications
3. Reasoning behind important decisions or approaches taken
4. Any potential impacts on other parts of the codebase

Format the response as a well-structured git commit message.
`;
}

function formatCommitMessage(aiResponse: string): string {
  // Remove any extra whitespace and ensure proper formatting
  const lines = aiResponse.trim().split('\n');
  const formattedLines = lines.map(line => line.trim()).filter(line => line !== '');
  
  // Ensure the first line is a concise summary (50 chars or less)
  let summary = formattedLines[0].slice(0, 50);
  if (formattedLines[0].length > 50) {
    summary += '...';
  }

  // Join the rest of the lines with proper line breaks
  const body = formattedLines.slice(1).join('\n\n');

  return `${summary}\n\n${body}`;
}