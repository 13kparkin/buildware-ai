import { generateAIResponse } from "@/actions/ai/generate-ai-response"
import { rateLimitedRequest } from "@/lib/rate-limit"

export async function analyzeFeedback(feedback: string): Promise<string> {
  const prompt = `Analyze the following feedback for an AI-generated code change:

${feedback}

Provide a concise summary of the key points and any specific actions that should be taken to address the feedback.`

  try {
    const analysis = await rateLimitedRequest(() =>
      generateAIResponse([
        { role: "user", content: prompt }
      ])
    )
    return analysis
  } catch (error) {
    console.error("Error analyzing feedback:", error)
    return "Failed to analyze feedback due to rate limiting. Please try again later."
  }
}



