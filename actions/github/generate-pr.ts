"use server"

import { getAuthenticatedOctokit } from "@/actions/github/auth"
import { SelectProject } from "@/db/schema"
import { AIParsedResponse } from "@/types/ai"
import { generateBranchName } from "@/lib/utils/branch-utils"
import { generateCommitComment } from "./generate-commit-comment"

function generatePRTitle(parsedResponse: AIParsedResponse, branchName: string): string {
    if (parsedResponse.prTitle) {
      return parsedResponse.prTitle;
    }
  
    const isFeature = parsedResponse.files.some(file => 
      file.content.toLowerCase().includes('new feature') || 
      file.content.toLowerCase().includes('enhancement')
    );
    const isBugFix = parsedResponse.files.some(file => 
      file.content.toLowerCase().includes('bug fix') || 
      file.content.toLowerCase().includes('fixes issue')
    );
  
    let prefix = 'update:';
  
    if (isFeature) {
      prefix = 'feature:';
    } else if (isBugFix) {
      prefix = 'bug:';
    } else if (parsedResponse.files.some(file => file.path.toLowerCase().includes('docs'))) {
      prefix = 'docs:';
    } else if (parsedResponse.files.some(file => file.content.toLowerCase().includes('refactor'))) {
      prefix = 'refactor:';
    } else if (parsedResponse.files.some(file => file.path.toLowerCase().includes('test'))) {
      prefix = 'test:';
    }
  
    return `${prefix} Update for ${branchName}`;
}

export async function generatePR(
  branchName: string,
  project: SelectProject,
  parsedResponse: AIParsedResponse,
  updateMode: "full" | "partial",
  existingPRLink: string | null,
  existingBranchName: string | null
): Promise<{ prLink: string | null; branchName: string }> {
  const octokit = await getAuthenticatedOctokit(project.githubInstallationId!)
  const [owner, repo] = project.githubRepoFullName!.split("/")

  const baseBranch = project.githubTargetBranch || "main"
  const timestamp = Date.now()
  let newBranch = existingBranchName || generateBranchName(project.name, branchName, timestamp)
  let baseRef: any

  try {
    baseRef = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })

    if (!existingBranchName) {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranch}`,
        sha: baseRef.data.object.sha
      })
    }
  } catch (error: any) {
    if (error.status === 422) {
      const retryBranch = generateBranchName(project.name, branchName, `${timestamp}-retry`)
      try {
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${retryBranch}`,
          sha: baseRef.data.object.sha
        })
        newBranch = retryBranch
      } catch (retryError: any) {
        console.error("Retry failed:", retryError)
        throw new Error(
          `Failed to create new branch after retry: ${retryError.message}`
        )
      }
    } else {
      throw new Error(`Failed to create new branch: ${error.message}`)
    }
  }

  const changes = []
  for (const file of parsedResponse.files) {
    if (file.status === "new" || file.status === "modified") {
      if (file.status === "modified") {
        try {
          const { data: existingFile } = await octokit.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: newBranch
          })

          if (Array.isArray(existingFile)) {
            throw new Error(`Expected file, got directory: ${file.path}`)
          }
        } catch (error: any) {
          if (error.status === 404) {
            console.warn(`File not found: ${file.path}. Treating as new file.`)
            file.status = "new"
          } else {
            throw error
          }
        }
      }

      changes.push({
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        content: file.content
      })
    } else if (file.status === "deleted") {
      changes.push({
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: null
      })
    }
  }

  if (changes.length === 0) {
    console.warn("No changes to commit. Skipping PR creation.")
    return { prLink: null, branchName: newBranch }
  }

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseRef.data.object.sha,
    tree: changes
  })

  const commitMessage = await generateCommitComment(parsedResponse, process.env.ANTHROPIC_API_KEY!);

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: tree.sha,
    parents: [baseRef.data.object.sha]
  })

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${newBranch}`,
    sha: commit.sha
  })

  try {
    if (!commit) {
      console.warn("No commit created. Skipping PR creation.")
      return { prLink: null, branchName: newBranch }
    }

    if (existingPRLink && updateMode === "partial") {
      const prNumber = parseInt(existingPRLink.split("/").pop() || "", 10)
      if (!isNaN(prNumber)) {
        await octokit.pulls.update({
          owner,
          repo,
          pull_number: prNumber,
          title: generatePRTitle(parsedResponse, branchName),
          body: commitMessage
        })
        return { prLink: existingPRLink, branchName: newBranch }
      }
    }

    const pr = await octokit.pulls.create({
      owner,
      repo,
      title: generatePRTitle(parsedResponse, branchName),
      head: newBranch,
      base: baseBranch,
      body: commitMessage
    })

    return { prLink: pr.data.html_url, branchName: newBranch }
  } catch (error: any) {
    console.error("Failed to create or update PR:", error)
    return { prLink: null, branchName: newBranch }
  }
}