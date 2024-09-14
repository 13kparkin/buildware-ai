"use server"

import { Octokit } from "@octokit/rest"

export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string
): Promise<string | null> {
  try {
    const { data: pullRequest } = await octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body
    })
    return pullRequest.html_url
  } catch (error) {
    console.error("Failed to create PR:", error)
    return null
  }
}

export async function updatePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  head: string,
  base: string,
  title: string,
  body: string
): Promise<string | null> {
  try {
    const { data: updatedPullRequest } = await octokit.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      title,
      body,
      head,
      base
    })
    return updatedPullRequest.html_url
  } catch (error) {
    console.error("Failed to update PR:", error)
    return null
  }
}