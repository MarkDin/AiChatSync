
import OpenAI from "openai";

// Using Deepseek's chat model
const MODEL = "deepseek-chat";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.deepseek.com/v1"  // Use Deepseek's API endpoint
});

export async function generateChatCompletion(
  messages: ChatMessage[],
  temperature = 0.7
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error calling Deepseek API:", error);
    throw new Error("Failed to generate completion");
  }
}
