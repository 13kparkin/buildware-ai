import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SelectIssue } from '@/db/schema'

interface IterativeImprovementProps {
  issue: SelectIssue
  onFeedbackSubmit: (feedback: string) => void
}

export const IterativeImprovement: React.FC<IterativeImprovementProps> = ({ issue, onFeedbackSubmit }) => {
  const [feedback, setFeedback] = useState('')

  const handleSubmit = () => {
    if (feedback.trim()) {
      onFeedbackSubmit(feedback)
      setFeedback('')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Iterative Improvement</h3>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Provide feedback or request specific changes..."
        rows={4}
      />
      <Button onClick={handleSubmit} disabled={!feedback.trim()}>
        Submit Feedback
      </Button>
    </div>
  )
}