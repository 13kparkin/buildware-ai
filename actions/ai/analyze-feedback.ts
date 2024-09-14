"use server"

import { generateAIResponse } from "./generate-ai-response"

export async function analyzeFeedback(feedback: string): Promise<string> {
  const prompt = `
    Analyze the following feedback for a code change and generate actionable tasks:

    Feedback:
    ${feedback}

    Please provide a list of specific, actionable tasks based on this feedback.
    Each task should be clear and directly address an aspect of the feedback.
  `

  const analysis = await generateAIResponse([
    { role: "user", content: prompt }
  ])

  return analysis
}