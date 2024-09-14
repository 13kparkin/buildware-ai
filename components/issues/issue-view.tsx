"use client"

import { generateAIResponse } from "@/actions/ai/generate-ai-response"
import { deleteGitHubPR } from "@/actions/github/delete-pr"
import { embedTargetBranch } from "@/actions/github/embed-target-branch"
import { generatePR } from "@/actions/github/generate-pr"
import { updatePR } from "@/actions/github/update-pr"
import { getMostSimilarEmbeddedFiles } from "@/actions/retrieval/get-similar-files"
import { MessageMarkdown } from "@/components/instructions/message-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createIssueMessageRecord, deleteIssue, deleteIssueMessagesByIssueId, getIssueMessagesByIssueId, updateIssue, updateIssueMessage } from "@/db/queries"
import { SelectIssue, SelectIssueMessage, SelectProject } from "@/db/schema"
import { buildCodeGenPrompt } from "@/lib/ai/build-codegen-prompt"
import { buildCodePlanPrompt } from "@/lib/ai/build-plan-prompt"
import { parseAIResponse } from "@/lib/ai/parse-ai-response"
import { generateBranchName } from "@/lib/utils/branch-utils"
import { Loader2, Pencil, Play, RefreshCw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import React, { useEffect, useRef, useState } from "react"
import { CRUDPage } from "../dashboard/reusable/crud-page"
import { IterativeImprovement } from "./iterative-improvement"
import { PRHistory } from "./pr-history"

// ... (existing imports and component setup)

export const IssueView: React.FC<IssueViewProps> = ({
  item,
  project,
  attachedInstructions,
  workspaceId
}) => {
  // ... (existing state and refs)
  const [updateMode, setUpdateMode] = useState<"partial" | "full">("partial")
  const [feedback, setFeedback] = useState("")

  // ... (existing useEffect and functions)

  const handleRun = async (issue: SelectIssue) => {
    setIsRunning(true)
    try {
      // ... (existing code for initial setup)

      if (issue.prLink && updateMode === "partial") {
        // Partial update
        const prNumber = parseInt(issue.prLink.split("/").pop() || "", 10)
        const { prLink: updatedPrLink, branchName } = await updatePR(project, prNumber, parsedAIResponse)
        
        await updateIssue(issue.id, {
          status: "completed",
          prLink: updatedPrLink || undefined,
          prBranch: branchName
        })

        if (updatedPrLink) {
          await updateMessage(prMessage.id, `GitHub PR (Updated): ${updatedPrLink}`)
        } else {
          await updateMessage(prMessage.id, "Failed to update PR")
        }
      } else {
        // Full regeneration or initial PR creation
        if (issue.prLink && issue.prBranch) {
          await deleteGitHubPR(project, issue.prLink, issue.prBranch)
        }
        
        const { prLink, branchName } = await generatePR(
          generateBranchName(project.name, issue.name),
          project,
          parsedAIResponse
        )

        await updateIssue(issue.id, {
          status: "completed",
          prLink: prLink || undefined,
          prBranch: branchName
        })

        if (prLink) {
          await updateMessage(prMessage.id, `GitHub PR: ${prLink}`)
        } else {
          await updateMessage(prMessage.id, "Failed to create PR")
        }
      }
    } catch (error) {
      console.error("Failed to run issue:", error)
      await addMessage(`Error: Failed to run issue: ${error}`)
      await updateIssue(issue.id, { status: "failed" })
    } finally {
      setIsRunning(false)
    }
  }

  // ... (existing JSX)

  return (
    <CRUDPage
      pageTitle={item.name}
      backText="Back to Issues"
      backLink={`../issues`}
    >
      {/* ... (existing buttons) */}
      
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setUpdateMode("partial")}
          disabled={isRunning || updateMode === "partial"}
        >
          Partial Update
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setUpdateMode("full")}
          disabled={isRunning || updateMode === "full"}
        >
          Full Regeneration
        </Button>
      </div>

      {/* ... (existing content) */}

      <Separator className="my-6" />

      <IterativeImprovement
        issue={item}
        onFeedbackSubmit={(feedbackText) => {
          setFeedback(feedbackText)
          handleRun(item)
        }}
      />

      <Separator className="my-6" />

      <PRHistory issueId={item.id} />

      {/* ... (existing dialogs) */}
    </CRUDPage>
  )
}