import Anthropic from '@anthropic-ai/sdk';
import { AIParsedResponse } from "@/types/ai";
import { parseDiff } from '@/lib/utils/diff-utils';
import { BUILDWARE_MAX_OUTPUT_TOKENS } from "@/lib/constants/buildware-config"

const anthropic = new Anthropic();

export async function generateCommitComment(changes: AIParsedResponse, anthropicApiKey: string): Promise<string> {
  try {
    const prompt = constructPrompt(changes);

    console.log('changes:', JSON.stringify(changes, null, 2));
    console.log('prompt:', prompt);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: BUILDWARE_MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      messages: [
        { role: "user", content: prompt }
      ]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return formatCommitMessage(content.text);
    } else {
      throw new Error('Unexpected response content type');
    }
  } catch (error) {
    console.error('Error generating commit comment:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error('Failed to generate commit comment: ' + (error instanceof Error ? error.message : String(error)));
  }
}

function constructPrompt(changes: AIParsedResponse): string {
  return `
Analyze the following changes and generate a comprehensive commit message:

${JSON.stringify(changes, null, 2)}

Please provide:
1. A brief summary of the overall change
2. Detailed explanations of significant modifications
3. Reasoning behind important decisions or approaches taken
4. Any potential impacts on other parts of the codebase

Format the response as a well-structured git commit message. Do not include any other text outside of the commit message.
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