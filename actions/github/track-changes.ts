"use server"

import { db } from "@/db/db"
import { issuesTable } from "@/db/schema/issues-schema"
import { eq } from "drizzle-orm"

export async function trackChanges(
  issueId: string,
  branchName: string,
  commitSha: string,
  changeType: 'create' | 'update'
): Promise<void> {
  try {
    const issue = await db.query.issues.findFirst({
      where: eq(issuesTable.id, issueId)
    })

    if (!issue) {
      throw new Error(`Issue with id ${issueId} not found`)
    }

    const newChangeHistory = [
      ...(issue.changeHistory || []),
      {
        timestamp: new Date().toISOString(),
        branchName,
        commitSha,
        changeType
      }
    ]

    await db
      .update(issuesTable)
      .set({
        changeHistory: newChangeHistory,
        iterationCount: (issue.iterationCount || 0) + 1
      })
      .where(eq(issuesTable.id, issueId))

  } catch (error) {
    console.error("Error tracking changes:", error)
    throw error
  }
}