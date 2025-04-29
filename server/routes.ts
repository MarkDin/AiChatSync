import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  chatCompletionSchema, 
  systemPromptSchema,
  mcpToolSchema,
  mcpToolCallSchema,
  insertMessageSchema, 
  type Message 
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { generateChatCompletion, type ChatMessage } from "./openai";
import { DEFAULT_SYSTEM_PROMPTS } from "./systemPrompts";
import { mcpService } from "./mcp-client";

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

  // MCP Tools API endpoints
  app.get("/api/mcp-tools", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : MOCK_USER_ID;
      const tools = await storage.getUserMcpTools(userId);
      res.json({ tools });
    } catch (error) {
      handleError(error, res);
    }
  });
  
  app.get("/api/mcp-tools/enabled", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : MOCK_USER_ID;
      const tools = await storage.getEnabledMcpTools(userId);
      res.json({ tools });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post("/api/mcp-tools", async (req, res) => {
    try {
      const { name, description, icon, configuration, isEnabled } = mcpToolSchema.parse(req.body);
      const userId = req.body.userId || MOCK_USER_ID;
      
      const tool = await storage.createMcpTool({
        name,
        description,
        icon: icon || "tool",
        configuration,
        userId,
        isEnabled: isEnabled !== undefined ? isEnabled : true
      });
      
      res.json({ tool });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get("/api/mcp-tools/:id", async (req, res) => {
    try {
      const toolId = parseInt(req.params.id, 10);
      const tool = await storage.getMcpTool(toolId);
      
      if (!tool) {
        return res.status(404).json({ message: "Tool not found" });
      }
      
      res.json({ tool });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.patch("/api/mcp-tools/:id", async (req, res) => {
    try {
      const toolId = parseInt(req.params.id, 10);
      const { name, description, icon, configuration, isEnabled } = req.body;
      
      const updates: Record<string, any> = {};
      if (name) updates.name = name;
      if (description) updates.description = description;
      if (icon) updates.icon = icon;
      if (configuration) updates.configuration = configuration;
      if (isEnabled !== undefined) updates.isEnabled = isEnabled;
      
      const tool = await storage.updateMcpTool(toolId, updates);
      res.json({ tool });
    } catch (error) {
      handleError(error, res);
    }
  });

  app.delete("/api/mcp-tools/:id", async (req, res) => {
    try {
      const toolId = parseInt(req.params.id, 10);
      await storage.deleteMcpTool(toolId);
      res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  });
  
  app.post("/api/mcp-tools/:id/toggle", async (req, res) => {
    try {
      const toolId = parseInt(req.params.id, 10);
      const { isEnabled } = req.body;
      
      if (isEnabled === undefined) {
        return res.status(400).json({ message: "isEnabled is required" });
      }
      
      const tool = await storage.toggleMcpToolStatus(toolId, isEnabled);
      res.json({ tool });
    } catch (error) {
      handleError(error, res);
    }
  });
  
  app.patch("/api/conversations/:id/tools", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const { enabledTools } = req.body;
      
      if (!Array.isArray(enabledTools)) {
        return res.status(400).json({ message: "enabledTools must be an array of tool IDs" });
      }
      
      const conversation = await storage.updateConversationTools(conversationId, enabledTools);
      res.json({ conversation });
    } catch (error) {
      handleError(error, res);
    }
  });
  
  app.post("/api/mcp-tools/call", async (req, res) => {
    try {
      const { toolId, conversationId, parameters, userId } = mcpToolCallSchema.parse(req.body);
      const userIdToUse = userId || MOCK_USER_ID;
      
      // Get the tool
      const tool = await storage.getMcpTool(toolId);
      if (!tool) {
        return res.status(404).json({ message: "Tool not found" });
      }
      
      // Check if the tool is enabled
      if (!tool.isEnabled) {
        return res.status(400).json({ message: "Tool is disabled" });
      }
      
      try {
        // 初始化MCP服务（如果尚未初始化）
        if (!mcpService.getAvailableTools().length) {
          await mcpService.initialize();
        }
        
        // 找到匹配的MCP工具
        const availableTools = mcpService.getAvailableTools();
        const mcpTool = availableTools.find(t => t.name.toLowerCase().includes(tool.name.toLowerCase()) || 
                                             t.description.toLowerCase().includes(tool.description.toLowerCase()));
        
        let toolResult;
        
        if (mcpTool) {
          // 使用MCP客户端调用工具
          const result = await mcpService.processWithTools(`使用${tool.name}工具，参数：${JSON.stringify(parameters)}`);
          toolResult = result.toolCalls.length > 0 ? result.toolCalls[0].result : null;
        } else {
          // 如果找不到匹配的MCP工具，返回模拟结果
          toolResult = {
            success: true,
            data: {
              message: `Tool "${tool.name}" executed successfully with parameters: ${JSON.stringify(parameters)}`,
              timestamp: new Date().toISOString()
            }
          };
        }
      
        // 存储工具调用作为消息
        await storage.createMessage({
          role: 'tool',
          content: `Tool "${tool.name}" was called`,
          userId: userIdToUse,
          conversationId,
          toolCall: { toolId, parameters },
          toolResult
        });
        
        res.json({ result: toolResult });
      } catch (error) {
        console.error("Error calling MCP tool:", error);
        
        // 返回错误信息
        const toolResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        
        // 存储错误信息作为消息
        await storage.createMessage({
          role: 'tool',
          content: `Tool "${tool.name}" call failed`,
          userId: userIdToUse,
          conversationId,
          toolCall: { toolId, parameters },
          toolResult
        });
        
        res.json({ result: toolResult });
      }
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
      const { message, conversationId, systemPromptId, userId, useTool } = chatCompletionSchema.parse(req.body);
      const userIdToUse = userId || MOCK_USER_ID;
      
      // Handle conversation
      let conversationIdToUse = conversationId;
      if (!conversationIdToUse) {
        // Create a new conversation if one doesn't exist
        const defaultPrompt = await storage.getDefaultSystemPrompt(userIdToUse);
        const newConversation = await storage.createConversation({
          title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          userId: userIdToUse,
          systemPromptId: defaultPrompt?.id,
          enabledTools: [] as number[] // No tools by default
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
      
      // Get enabled tools for this conversation if useTool is true
      let availableTools: string[] = [];
      let toolsInfo: string = '';
      
      if (useTool) {
        const conversation = await storage.getConversation(conversationIdToUse);
        if (conversation && conversation.enabledTools && Array.isArray(conversation.enabledTools) && conversation.enabledTools.length > 0) {
          const enabledToolIds = conversation.enabledTools as number[];
          
          // Get tool information to include in system prompt
          const tools = [];
          for (const toolId of enabledToolIds) {
            const tool = await storage.getMcpTool(toolId);
            if (tool && tool.isEnabled) {
              tools.push({
                id: tool.id,
                name: tool.name,
                description: tool.description,
                configuration: tool.configuration
              });
            }
          }
          
          if (tools.length > 0) {
            availableTools = tools.map(t => t.name);
            toolsInfo = `
You have access to the following tools:
${tools.map((tool, index) => `
Tool ${index + 1}: ${tool.name}
Description: ${tool.description}
Usage: To use this tool, respond with: [USE_TOOL:${tool.id}:parameters]
Where parameters is a valid JSON object with the parameters for the tool.
`).join('\n')}

When you want to use a tool, respond with the [USE_TOOL] syntax mentioned above.
`;
          }
        }
      }
      
      // Append tool information to system prompt if available
      if (toolsInfo && systemPromptContent) {
        systemPromptContent = `${systemPromptContent}\n\n${toolsInfo}`;
      } else if (toolsInfo) {
        systemPromptContent = toolsInfo;
      }
      
      // Format messages for OpenAI
      const formattedMessages = formatMessagesForOpenAI(conversationMessages, systemPromptContent);
      
      let finalResponse = '';
      let toolCalls: { name: string; arguments: Record<string, any>; result: any }[] = [];
      
      // 检查是否启用了MCP工具
      if (useTool && availableTools.length > 0) {
        try {
          // 确保MCP服务初始化
          if (!mcpService.getAvailableTools().length) {
            await mcpService.initialize();
          }
          
          // 使用MCP客户端处理消息
          const mcpResponse = await mcpService.processWithTools(message);
          finalResponse = mcpResponse.content;
          toolCalls = mcpResponse.toolCalls;
          
          // 如果有工具调用，添加一个带有工具调用信息的消息
          if (toolCalls.length > 0) {
            // 找到工具ID
            let toolId = undefined;
            const conversation = await storage.getConversation(conversationIdToUse);
            if (conversation && conversation.enabledTools && Array.isArray(conversation.enabledTools)) {
              const enabledTools = await Promise.all((conversation.enabledTools as number[]).map(id => storage.getMcpTool(id)));
              const matchingTool = enabledTools.find(tool => 
                tool && toolCalls[0] && tool.name.toLowerCase().includes(toolCalls[0].name.toLowerCase()));
              
              if (matchingTool) {
                toolId = matchingTool.id;
              }
            }
            
            // 存储助手消息，包含工具调用
            await storage.createMessage({
              role: 'assistant',
              content: finalResponse,
              userId: userIdToUse,
              conversationId: conversationIdToUse,
              toolCall: {
                toolId,
                name: toolCalls[0].name,
                parameters: toolCalls[0].arguments
              }
            });
            
            // 存储工具结果消息
            await storage.createMessage({
              role: 'tool',
              content: `工具 "${toolCalls[0].name}" 返回: ${JSON.stringify(toolCalls[0].result)}`,
              userId: userIdToUse,
              conversationId: conversationIdToUse,
              toolCall: {
                toolId,
                name: toolCalls[0].name,
                parameters: toolCalls[0].arguments
              },
              toolResult: toolCalls[0].result
            });
            
            // 返回包含工具调用信息的响应
            return res.json({
              content: finalResponse,
              conversationId: conversationIdToUse,
              toolCall: {
                toolId,
                toolName: toolCalls[0].name,
                parameters: toolCalls[0].arguments
              },
              toolResult: toolCalls[0].result
            });
          }
        } catch (error) {
          console.error("Error processing with MCP tools:", error);
          // 如果MCP处理失败，回退到常规方式
          finalResponse = await generateChatCompletion(formattedMessages);
        }
      } else {
        // 如果没有启用工具或没有可用工具，使用常规聊天完成
        finalResponse = await generateChatCompletion(formattedMessages);
      }
      
      // 常规消息处理（无工具调用）
      await storage.createMessage({
        role: 'assistant',
        content: finalResponse,
        userId: userIdToUse,
        conversationId: conversationIdToUse
      });

      // 返回响应
      res.json({ 
        content: finalResponse,
        conversationId: conversationIdToUse,
        availableTools
      });
    } catch (error) {
      handleError(error, res);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
