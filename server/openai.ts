
import OpenAI from "openai";

// Using Deepseek's chat model, but supporting the MCP protocol
const MODEL = "deepseek-chat";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: any;
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
    // Filter out tool messages or convert them to a format the model can understand
    const formattedMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        // Convert tool messages to system messages with appropriate prefixes
        return {
          role: 'system' as const,
          content: `Tool result: ${msg.content}`
        };
      }
      
      // Otherwise, keep the original message
      return {
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content
      };
    });
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error calling API:", error);
    throw new Error("Failed to generate completion");
  }
}
