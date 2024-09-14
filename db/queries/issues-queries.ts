"use server"

import { getUserId } from "@/actions/auth/auth"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "../db"
import { InsertIssue, SelectIssue, issuesTable } from "../schema/issues-schema"

// ... (existing functions)

export async function updateIssue(
  id: string,
  data: Partial<InsertIssue>
): Promise<SelectIssue> {
  const [updatedIssue] = await db
    .update(issuesTable)
    .set({
      ...data,
      iterationCount: data.prLink
        ? db.sql`${issuesTable.iterationCount}::integer + 1`
        : undefined,
    })
    .where(eq(issuesTable.id, id))
    .returning()
  revalidatePath("/")
  return updatedIssue
}

export async function getPRHistory(issueId: string) {
  const issue = await getIssueById(issueId)
  if (!issue) {
    throw new Error("Issue not found")
  }

  const messages = await db.query.issueMessages.findMany({
    where: and(
      eq(issueMessagesTable.issueId, issueId),
      eq(issueMessagesTable.type, "pr_update")
    ),
    orderBy: desc(issueMessagesTable.createdAt)
  })

  return messages.map(message => ({
    id: message.id,
    prLink: message.content,
    createdAt: message.createdAt.toISOString(),
    type: message.sequence === 1 ? 'initial' : 'update'
  }))
}

// ... (other existing functions)