"use server"

import { getAuthenticatedOctokit } from "@/actions/github/auth"
import { SelectProject } from "@/db/schema"
import { AIParsedResponse } from "@/types/ai"
import { generateBranchName } from "@/lib/utils/branch-utils"
import { generateCommitComment } from "./generate-commit-comment"
import { createPullRequest, updatePullRequest } from "./update-pr"
import { handleVersionControlConflicts } from "./version-control"
import { trackChanges } from "./track-changes"

function generatePRTitle(parsedResponse: AIParsedResponse, branchName: string): string {
  // ... (existing code)
}

export async function generatePR(
  branchName: string,
  project: SelectProject,
  parsedResponse: AIParsedResponse,
  existingPRNumber?: number
): Promise<{ prLink: string | null; branchName: string }> {
  const octokit = await getAuthenticatedOctokit(project.githubInstallationId!)
  const [owner, repo] = project.githubRepoFullName!.split("/")

  // Create a new branch or use existing one
  const baseBranch = project.githubTargetBranch || "main"
  const timestamp = Date.now()
  let newBranch = existingPRNumber ? branchName : generateBranchName(project.name, branchName, timestamp)
  
  try {
    if (!existingPRNumber) {
      // Create new branch logic (existing code)
    }

    // Handle version control conflicts
    await handleVersionControlConflicts(octokit, owner, repo, baseBranch, newBranch)

    // Prepare changes
    const changes = []
    for (const file of parsedResponse.files) {
      // ... (existing code for preparing changes)
    }

    // Create a tree with all changes
    if (changes.length === 0) {
      console.warn("No changes to commit. Skipping PR creation/update.")
      return { prLink: null, branchName: newBranch }
    }

    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseRef.data.object.sha,
      tree: changes
    })

    // Generate AI-powered commit message
    const commitMessage = await generateCommitComment(parsedResponse, process.env.ANTHROPIC_API_KEY!);

    // Create a commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: tree.sha,
      parents: [baseRef.data.object.sha]
    })

    // Update the branch reference
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${newBranch}`,
      sha: commit.sha
    })

    // Create or update PR
    let prLink: string | null = null
    if (existingPRNumber) {
      prLink = await updatePullRequest(octokit, owner, repo, existingPRNumber, newBranch, baseBranch, generatePRTitle(parsedResponse, branchName), commitMessage)
    } else {
      prLink = await createPullRequest(octokit, owner, repo, newBranch, baseBranch, generatePRTitle(parsedResponse, branchName), commitMessage)
    }

    // Track changes
    await trackChanges(project.id, branchName, commit.sha, existingPRNumber ? 'update' : 'create')

    return { prLink, branchName: newBranch }
  } catch (error: any) {
    console.error("Failed to generate/update PR:", error)
    return { prLink: null, branchName: newBranch }
  }
}