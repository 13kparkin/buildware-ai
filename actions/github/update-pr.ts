"use server"

import { getAuthenticatedOctokit } from "@/actions/github/auth"
import { SelectProject } from "@/db/schema"
import { AIParsedResponse } from "@/types/ai"
import { generatePR } from "./generate-pr"

export async function updatePR(
  project: SelectProject,
  prNumber: number,
  parsedResponse: AIParsedResponse
): Promise<{ prLink: string | null; branchName: string }> {
  const octokit = await getAuthenticatedOctokit(project.githubInstallationId!)
  const [owner, repo] = project.githubRepoFullName!.split("/")

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

    // Use generatePR to create a new commit on the existing PR
    return await generatePR(pr.head.ref, project, parsedResponse, {
      number: prNumber,
      sha: latestCommit.sha
    })
  } catch (error: any) {
    console.error("Failed to update PR:", error)
    return { prLink: null, branchName: "" }
  }
}