"use server"

import { getAuthenticatedOctokit } from "@/actions/github/auth"
import { SelectProject } from "@/db/schema"
import { AIParsedResponse } from "@/types/ai"
import { generateBranchName } from "@/lib/utils/branch-utils"
import { generateCommitComment } from "./generate-commit-comment"

function generatePRTitle(parsedResponse: AIParsedResponse, branchName: string): string {
  // ... (existing code)
}

export async function generatePR(
  branchName: string,
  project: SelectProject,
  parsedResponse: AIParsedResponse,
  existingPR?: { number: number; sha: string }
): Promise<{ prLink: string | null; branchName: string }> {
  const octokit = await getAuthenticatedOctokit(project.githubInstallationId!)
  const [owner, repo] = project.githubRepoFullName!.split("/")

  // Create a new branch or use existing one
  const baseBranch = project.githubTargetBranch || "main"
  const timestamp = Date.now()
  let newBranch = existingPR ? branchName : generateBranchName(project.name, branchName, timestamp)
  let baseRef: any

  try {
    baseRef = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })

    if (!existingPR) {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: baseRef.data.object.sha
      })
    }
  } catch (error: any) {
    // ... (existing error handling code)
  }

  // Prepare changes
  const changes = []
  for (const file of parsedResponse.files) {
    if (file.status === "new" || file.status === "modified") {
      // ... (existing code for new and modified files)
    } else if (file.status === "deleted") {
      // ... (existing code for deleted files)
    }
  }

  // Create a tree with all changes
  if (changes.length === 0) {
    console.warn("No changes to commit. Skipping PR creation.")
    return { prLink: null, branchName: newBranch }
  }

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: existingPR ? existingPR.sha : baseRef.data.object.sha,
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
    parents: [existingPR ? existingPR.sha : baseRef.data.object.sha]
  })

  // Update the branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${newBranch}`,
    sha: commit.sha
  })

  // Create or update PR
  try {
    if (!commit) {
      console.warn("No commit created. Skipping PR creation/update.")
      return { prLink: null, branchName: newBranch }
    }

    let pr;
    if (existingPR) {
      pr = await octokit.pulls.update({
        owner,
        repo,
        pull_number: existingPR.number,
        title: generatePRTitle(parsedResponse, branchName),
        body: commitMessage
      })
    } else {
      pr = await octokit.pulls.create({
        owner,
        repo,
        title: generatePRTitle(parsedResponse, branchName),
        head: newBranch,
        base: baseBranch,
        body: commitMessage
      })
    }

    return { prLink: pr.data.html_url, branchName: newBranch }
  } catch (error: any) {
    console.error("Failed to create/update PR:", error)
    return { prLink: null, branchName: newBranch }
  }
}