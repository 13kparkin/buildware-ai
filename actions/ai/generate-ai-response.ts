"use server"

import { calculateLLMCost } from "@/lib/ai/calculate-llm-cost"
import { BUILDWARE_MAX_OUTPUT_TOKENS } from "@/lib/constants/buildware-config"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export const generateAIResponse = async (
  messages: Anthropic.Messages.MessageParam[],
  updateType: 'partial' | 'full' = 'full'
) => {
  const systemMessage = updateType === 'partial'
    ? "You are a helpful assistant that can answer questions and help with tasks. Focus on making targeted changes based on the given feedback."
    : "You are a helpful assistant that can answer questions and help with tasks."

  const message = await anthropic.messages.create(
    {
      model: "claude-3-5-sonnet-20240620",
      system: systemMessage,
      messages,
      max_tokens: BUILDWARE_MAX_OUTPUT_TOKENS
    },
    {
      headers: {
        "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"
      }
    }
  )

  console.warn("usage", message.usage)
  const cost = calculateLLMCost({
    llmId: "claude-3-5-sonnet-20240620",
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens
  })
  console.warn("cost", cost)

  return message.content[0].type === "text" ? message.content[0].text : ""
}