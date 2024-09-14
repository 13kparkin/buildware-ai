"use server"

import { Octokit } from "@octokit/rest"
import { AIParsedResponse } from "@/types/ai"
import { generateCommitComment } from "./generate-commit-comment"

export async function updatePR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  parsedResponse: AIParsedResponse
): Promise<{ prLink: string | null; branchName: string }> {
  try {
    // Get the current PR
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    })

    // Get the latest commit on the PR
    const { data: commits } = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber
    })
    const latestCommit = commits[commits.length - 1]

    // Create a new tree with the changes
    const { data: baseTree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: latestCommit.sha
    })

    const changes = parsedResponse.files.map(file => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      content: file.content
    }))

    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTree.sha,
      tree: changes
    })

    // Create a new commit
    const commitMessage = await generateCommitComment(parsedResponse, process.env.ANTHROPIC_API_KEY!)
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommit.sha]
    })

    // Update the reference of the PR's branch
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${pr.head.ref}`,
      sha: newCommit.sha
    })

    return { prLink: pr.html_url, branchName: pr.head.ref }
  } catch (error) {
    console.error("Error updating PR:", error)
    throw error
  }
}