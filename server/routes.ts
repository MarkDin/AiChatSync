import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  chatCompletionSchema, 
  systemPromptSchema,
  insertMessageSchema, 
  type Message 
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { generateChatCompletion, type ChatMessage } from "./openai";
import { DEFAULT_SYSTEM_PROMPTS } from "./systemPrompts";

// Mock user ID for demo purposes
const MOCK_USER_ID = 1;

// Error handling middleware
function handleError(error: any, res: Response) {
  if (error instanceof ZodError) {
    const validationError = fromZodError(error);
    res.status(400).json({ message: validationError.message });
  } else {
    console.error("API error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Initialize default system prompts for a user
async function initializeSystemPrompts(userId: number) {
  try {
    // Check if user already has system prompts
    const existingPrompts = await storage.getUserSystemPrompts(userId);
    if (existingPrompts.length > 0) return;
    
    // Add default system prompts
    for (const prompt of DEFAULT_SYSTEM_PROMPTS) {
      await storage.createSystemPrompt({
        ...prompt,
        userId
      });
    }
  } catch (error) {
    console.error("Failed to initialize system prompts:", error);
  }
}

// Format messages for OpenAI API
function formatMessagesForOpenAI(messages: Message[], systemPrompt?: string): ChatMessage[] {
  const formattedMessages: ChatMessage[] = [];
  
  // Add system prompt if provided
  if (systemPrompt) {
    formattedMessages.push({
      role: "system",
      content: systemPrompt
    });
  }
  
  // Add conversation messages
  for (const message of messages) {
    formattedMessages.push({
      role: message.role as "system" | "user" | "assistant",
      content: message.content
    });
  }
  
  return formattedMessages;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize demo user if needed
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if demo user exists
      let user = await storage.getUser(MOCK_USER_ID);
      if (!user) {
        // Create demo user
        user = await storage.createUser({
          username: "demo_user",
          password: "password123" // In a real app, this would be properly hashed
        });
        
        // Initialize default system prompts
        await initializeSystemPrompts(user.id);
      }
      next();
    } catch (error) {
      console.error("Middleware error:", error);
      next();
    }
  });

  // Conversations API endpoints
  app.get("/api/conversations", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : MOCK_USER_ID;
      const conversations = await storage.getUserConversations(userId);
      res.json({ conversations });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const userId = req.body.userId || MOCK_USER_ID;
      
      // Get default system prompt
      const systemPrompt = await storage.getDefaultSystemPrompt(userId);
      const systemPromptId = systemPrompt?.id;
      
      // Create new conversation
      const title = req.body.title || "New Conversation";
      const conversation = await storage.createConversation({
        title,
        userId,
        systemPromptId
      });
      
      res.json({ conversation });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const { title } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }
      
      const conversation = await storage.updateConversationTitle(conversationId, title);
      res.json({ conversation });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      await storage.deleteConversation(conversationId);
      res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  });

  // System prompts API endpoints
  app.get("/api/system-prompts", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : MOCK_USER_ID;
      const prompts = await storage.getUserSystemPrompts(userId);
      res.json({ prompts });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post("/api/system-prompts", async (req, res) => {
    try {
      const { title, content, isDefault } = systemPromptSchema.parse(req.body);
      const userId = req.body.userId || MOCK_USER_ID;
      
      const prompt = await storage.createSystemPrompt({
        title,
        content,
        userId,
        isDefault: isDefault || false
      });
      
      res.json({ prompt });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.patch("/api/system-prompts/:id", async (req, res) => {
    try {
      const promptId = parseInt(req.params.id, 10);
      const { title, content, isDefault } = req.body;
      
      const updates: Record<string, any> = {};
      if (title) updates.title = title;
      if (content) updates.content = content;
      if (isDefault !== undefined) updates.isDefault = isDefault;
      
      const prompt = await storage.updateSystemPrompt(promptId, updates);
      res.json({ prompt });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.delete("/api/system-prompts/:id", async (req, res) => {
    try {
      const promptId = parseInt(req.params.id, 10);
      await storage.deleteSystemPrompt(promptId);
      res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post("/api/system-prompts/:id/set-default", async (req, res) => {
    try {
      const promptId = parseInt(req.params.id, 10);
      const userId = req.body.userId || MOCK_USER_ID;
      
      const prompt = await storage.setDefaultSystemPrompt(promptId, userId);
      res.json({ prompt });
    } catch (error) {
      handleError(error, res);
    }
  });

  // Messages API endpoints
  app.get("/api/messages", async (req, res) => {
    try {
      const conversationId = req.query.conversationId 
        ? parseInt(req.query.conversationId as string, 10) 
        : undefined;
      
      if (!conversationId) {
        return res.status(400).json({ message: "Conversation ID is required" });
      }
      
      const messages = await storage.getConversationMessages(conversationId);
      res.json({ messages });
    } catch (error) {
      handleError(error, res);
    }
  });

  // Chat completion API endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      // Validate request body
      const { message, conversationId, systemPromptId, userId } = chatCompletionSchema.parse(req.body);
      const userIdToUse = userId || MOCK_USER_ID;
      
      // Handle conversation
      let conversationIdToUse = conversationId;
      if (!conversationIdToUse) {
        // Create a new conversation if one doesn't exist
        const defaultPrompt = await storage.getDefaultSystemPrompt(userIdToUse);
        const newConversation = await storage.createConversation({
          title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          userId: userIdToUse,
          systemPromptId: defaultPrompt?.id
        });
        conversationIdToUse = newConversation.id;
      }
      
      // Store user message
      await storage.createMessage({
        role: 'user',
        content: message,
        userId: userIdToUse,
        conversationId: conversationIdToUse
      });
      
      // Get all messages in this conversation
      const conversationMessages = await storage.getConversationMessages(conversationIdToUse);
      
      // Get system prompt if one is specified or from the conversation
      let systemPromptContent: string | undefined;
      if (systemPromptId) {
        const systemPrompt = await storage.getSystemPrompt(systemPromptId);
        systemPromptContent = systemPrompt?.content;
      } else {
        const conversation = await storage.getConversation(conversationIdToUse);
        if (conversation?.systemPromptId) {
          const systemPrompt = await storage.getSystemPrompt(conversation.systemPromptId);
          systemPromptContent = systemPrompt?.content;
        }
      }
      
      // Format messages for OpenAI
      const formattedMessages = formatMessagesForOpenAI(conversationMessages, systemPromptContent);
      
      // Generate AI response
      const aiResponse = await generateChatCompletion(formattedMessages);
      
      // Store AI response
      await storage.createMessage({
        role: 'assistant',
        content: aiResponse,
        userId: userIdToUse,
        conversationId: conversationIdToUse
      });

      // Return the response
      res.json({ 
        content: aiResponse,
        conversationId: conversationIdToUse
      });
    } catch (error) {
      handleError(error, res);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
