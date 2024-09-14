"use client"

import { deleteIssue } from "@/db/queries/issues-queries"
import { SelectIssue } from "@/db/schema/issues-schema"
import { DataItem } from "../dashboard/reusable/data-item"
import { DataList } from "../dashboard/reusable/data-list"
import { Badge } from "@/components/ui/badge"

interface IssuesListProps {
  issues: SelectIssue[]
}

export function IssuesList({ issues }: IssuesListProps) {
  const handleIssueDelete = async (id: string) => {
    await deleteIssue(id)
  }

  const getStatusBadge = (status: string, iterationCount: string) => {
    let color = "default"
    let text = status

    if (status === "completed" && parseInt(iterationCount) > 1) {
      color = "blue"
      text = `Iteration ${iterationCount}`
    } else if (status === "in_progress") {
      color = "yellow"
    } else if (status === "completed") {
      color = "green"
    } else if (status === "failed") {
      color = "red"
    }

    return <Badge variant={color as any}>{text}</Badge>
  }

  return (
    <DataList
      title="Issues"
      subtitle="Manage issues"
      readMoreLink="https://docs.buildware.ai/core-components/issues"
      readMoreText="Read more"
      createLink={`./issues/create`}
      createText="Create issue"
      dataListTitle="Issues"
    >
      {issues.length > 0 ? (
        issues.map(issue => (
          <DataItem
            key={issue.id}
            data={{ id: issue.id, name: issue.name }}
            type="issues"
            onDelete={handleIssueDelete}
            extraContent={
              <div className="flex items-center space-x-2">
                {getStatusBadge(issue.status, issue.iterationCount)}
                {issue.prLink && (
                  <a
                    href={issue.prLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    View PR
                  </a>
                )}
              </div>
            }
          />
        ))
      ) : (
        <div>No issues found.</div>
      )}
    </DataList>
  )
}