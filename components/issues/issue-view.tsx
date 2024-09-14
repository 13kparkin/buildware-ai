"use client"

import { generateAIResponse } from "@/actions/ai/generate-ai-response"
import { deleteGitHubPR } from "@/actions/github/delete-pr"
import { embedTargetBranch } from "@/actions/github/embed-target-branch"
import { generatePR } from "@/actions/github/generate-pr"
import { getMostSimilarEmbeddedFiles } from "@/actions/retrieval/get-similar-files"
import { MessageMarkdown } from "@/components/instructions/message-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { analyzeFeedback } from "@/actions/ai/analyze-feedback"

// ... (existing imports and component setup)

export const IssueView: React.FC<IssueViewProps> = ({
  item,
  project,
  attachedInstructions,
  workspaceId
}) => {
  // ... (existing state and hooks)

  const [updateType, setUpdateType] = useState<'partial' | 'full'>('full')
  const [feedback, setFeedback] = useState('')

  const handleRun = async (issue: SelectIssue) => {
    // ... (existing setup code)

    try {
      if (updateType === 'partial' && issue.prLink) {
        // Analyze feedback and generate targeted changes
        const feedbackAnalysis = await analyzeFeedback(feedback)
        // Use feedbackAnalysis to guide the AI response generation
        // ... (code to incorporate feedback into AI prompts)
      }

      // ... (existing AI response generation code)

      const parsedAIResponse = parseAIResponse(aiCodeGenResponse)

      const { prLink, branchName } = await generatePR(
        generateBranchName(project.name, issue.name),
        project,
        parsedAIResponse,
        issue.prLink ? parseInt(issue.prLink.split('/').pop() || '') : undefined
      )

      await updateIssue(issue.id, {
        status: "completed",
        prLink: prLink || undefined,
        prBranch: branchName
      })

      if (prLink) {
        await updateMessage(prMessage.id, `GitHub PR: ${prLink}`)
      } else {
        await updateMessage(prMessage.id, "Failed to create/update PR")
      }
    } catch (error) {
      console.error("Failed to run issue:", error)
      await addMessage(`Error: Failed to run issue: ${error}`)
      await updateIssue(issue.id, { status: "failed" })
    } finally {
      setIsRunning(false)
    }
  }

  // ... (existing render code)

  return (
    <CRUDPage
      pageTitle={item.name}
      backText="Back to Issues"
      backLink={`../issues`}
    >
      {/* ... (existing buttons) */}
      
      <div className="mb-4 flex items-center gap-2">
        <label>Update Type:</label>
        <select
          value={updateType}
          onChange={(e) => setUpdateType(e.target.value as 'partial' | 'full')}
          className="border rounded p-1"
        >
          <option value="full">Full Regeneration</option>
          <option value="partial">Partial Update</option>
        </select>
      </div>

      {updateType === 'partial' && (
        <div className="mb-4">
          <label>Feedback for partial update:</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full h-24 border rounded p-2"
            placeholder="Enter feedback or review comments here..."
          />
        </div>
      )}

      {/* ... (existing content) */}
    </CRUDPage>
  )
}