import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    console.error("Error calling OpenAI API:", error);
    throw new Error("Failed to generate completion");
  }
}