"use server"

import { getAuthenticatedOctokit } from "@/actions/github/auth"
import { SelectProject } from "@/db/schema"
import { AIParsedResponse } from "@/types/ai"
import { generateBranchName } from "@/lib/utils/branch-utils"
import { generateCommitComment } from "./generate-commit-comment"

function generatePRTitle(parsedResponse: AIParsedResponse, branchName: string): string {
    // If a custom PR title is provided, return it without modification
    if (parsedResponse.prTitle) {
      return parsedResponse.prTitle;
    }
  
    // Check for indicators of change type in the parsed response
    const isFeature = parsedResponse.files.some(file => 
      file.content.toLowerCase().includes('new feature') || 
      file.content.toLowerCase().includes('enhancement')
    );
    const isBugFix = parsedResponse.files.some(file => 
      file.content.toLowerCase().includes('bug fix') || 
      file.content.toLowerCase().includes('fixes issue')
    );
  
    let prefix = 'update:'; // Default prefix
  
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
  
    // Generate a generic title if no custom title is provided
    return `${prefix} Update for ${branchName}`;
}

export async function generatePR(
  branchName: string,
  project: SelectProject,
  parsedResponse: AIParsedResponse
): Promise<{ prLink: string | null; branchName: string }> {
  const octokit = await getAuthenticatedOctokit(project.githubInstallationId!)
  const [owner, repo] = project.githubRepoFullName!.split("/")

  // Create a new branch
  const baseBranch = project.githubTargetBranch || "main"
  const timestamp = Date.now()
  let newBranch = generateBranchName(project.name, branchName, timestamp)
  let baseRef: any

  try {
    baseRef = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`
    })

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: baseRef.data.object.sha
    })
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

  // Prepare changes
  const changes = []
  for (const file of parsedResponse.files) {
    if (file.status === "new" || file.status === "modified") {
      if (file.status === "modified") {
        try {
          // Fetch the current file to get its SHA
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
            // Treat as a new file if it doesn't exist
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

  // Create a tree with all changes
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

  // Generate AI-powered commit message
  const diff = await octokit.repos.compareCommits({
    owner,
    repo,
    base: baseBranch,
    head: newBranch
  });
  const commitMessage = await generateCommitComment(JSON.stringify(diff.data), process.env.ANTHROPIC_API_KEY!);

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

  // Create PR
  try {
    if (!commit) {
      console.warn("No commit created. Skipping PR creation.")
      return { prLink: null, branchName: newBranch }
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
    console.error("Failed to create PR:", error)
    return { prLink: null, branchName: newBranch }
  }
}