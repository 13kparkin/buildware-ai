"use server"

import { getAuthenticatedOctokit } from "@/actions/github/auth"
import { generateAIResponse } from "@/actions/ai/generate-ai-response"
import { SelectProject } from "@/db/schema"

interface CommitChange {
  filename: string
  status: "added" | "modified" | "removed"
  additions: number
  deletions: number
  patch?: string
}

export async function generateCommitComment(
  project: SelectProject,
  currentBranch: string,
  targetBranch: string
): Promise<string> {
  try {
    const octokit = await getAuthenticatedOctokit(project.githubInstallationId!)
    const [owner, repo] = project.githubRepoFullName!.split("/")

    // Get the diff between branches
    const { data: compareData } = await octokit.repos.compareCommits({
      owner,
      repo,
      base: targetBranch,
      head: currentBranch
    })

    const changes: CommitChange[] = compareData.files || []

    // Prepare the prompt for AI
    const prompt = buildAIPrompt(changes)

    // Generate commit comment using AI
    const aiResponse = await generateAIResponse([
      { role: "user", content: prompt }
    ])

    return formatCommitComment(aiResponse)
  } catch (error) {
    console.error("Error generating commit comment:", error)
    throw new Error("Failed to generate commit comment")
  }
}

function buildAIPrompt(changes: CommitChange[]): string {
  const changesDescription = changes
    .map(
      change =>
        `${change.filename} (${change.status}, +${change.additions}, -${change.deletions})`
    )
    .join("\n")

  return `Generate a comprehensive commit message for the following changes:

${changesDescription}

The commit message should include:
1. A brief summary of the overall change (50-72 characters)
2. A more detailed explanation of the significant modifications
3. Reasoning behind important decisions or approaches taken
4. Any potential impacts on other parts of the codebase

Format the commit message with a short summary line, followed by a blank line, and then the detailed description.`
}

function formatCommitComment(aiResponse: string): string {
  // Remove any extra whitespace and ensure proper formatting
  const lines = aiResponse.trim().split("\n")
  const summary = lines[0].trim()
  const details = lines.slice(2).join("\n").trim()

  return `${summary}

${details}`
}