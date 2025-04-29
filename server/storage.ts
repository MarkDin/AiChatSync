import { 
  users, type User, type InsertUser,
  messages, type Message, type InsertMessage,
  conversations, type Conversation, type InsertConversation,
  systemPrompts, type SystemPrompt, type InsertSystemPrompt,
  mcpTools, type McpTool, type InsertMcpTool
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Conversation methods
  getConversation(id: number): Promise<Conversation | undefined>;
  getUserConversations(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationTitle(id: number, title: string): Promise<Conversation>;
  updateConversationTools(id: number, enabledTools: number[]): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  
  // Message methods
  getConversationMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // System prompt methods
  getSystemPrompt(id: number): Promise<SystemPrompt | undefined>;
  getUserSystemPrompts(userId: number): Promise<SystemPrompt[]>;
  getDefaultSystemPrompt(userId: number): Promise<SystemPrompt | undefined>;
  createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt>;
  updateSystemPrompt(id: number, prompt: Partial<InsertSystemPrompt>): Promise<SystemPrompt>;
  deleteSystemPrompt(id: number): Promise<void>;
  setDefaultSystemPrompt(id: number, userId: number): Promise<SystemPrompt>;
  
  // MCP Tool methods
  getMcpTool(id: number): Promise<McpTool | undefined>;
  getUserMcpTools(userId: number): Promise<McpTool[]>;
  getEnabledMcpTools(userId: number): Promise<McpTool[]>;
  createMcpTool(tool: InsertMcpTool): Promise<McpTool>;
  updateMcpTool(id: number, tool: Partial<InsertMcpTool>): Promise<McpTool>;
  deleteMcpTool(id: number): Promise<void>;
  toggleMcpToolStatus(id: number, isEnabled: boolean): Promise<McpTool>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getUserConversations(userId: number): Promise<Conversation[]> {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.timestamp));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async updateConversationTitle(id: number, title: string): Promise<Conversation> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }
  
  async updateConversationTools(id: number, enabledTools: number[]): Promise<Conversation> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({ enabledTools })
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  async deleteConversation(id: number): Promise<void> {
    // First delete all messages in this conversation
    await db
      .delete(messages)
      .where(eq(messages.conversationId, id));
    
    // Then delete the conversation
    await db
      .delete(conversations)
      .where(eq(conversations.id, id));
  }

  // Message methods
  async getConversationMessages(conversationId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.id);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  }

  // System prompt methods
  async getSystemPrompt(id: number): Promise<SystemPrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.id, id));
    return prompt || undefined;
  }

  async getUserSystemPrompts(userId: number): Promise<SystemPrompt[]> {
    return db
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.userId, userId))
      .orderBy(desc(systemPrompts.timestamp));
  }

  async getDefaultSystemPrompt(userId: number): Promise<SystemPrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(systemPrompts)
      .where(and(
        eq(systemPrompts.userId, userId),
        eq(systemPrompts.isDefault, true)
      ));
    
    if (prompt) return prompt;
    
    // Return first prompt if no default is set
    const prompts = await this.getUserSystemPrompts(userId);
    return prompts.length > 0 ? prompts[0] : undefined;
  }

  async createSystemPrompt(prompt: InsertSystemPrompt): Promise<SystemPrompt> {
    // If this is set as default, unset any existing default
    if (prompt.isDefault && prompt.userId) {
      await db
        .update(systemPrompts)
        .set({ isDefault: false })
        .where(and(
          eq(systemPrompts.userId, prompt.userId),
          eq(systemPrompts.isDefault, true)
        ));
    }
    
    const [newPrompt] = await db
      .insert(systemPrompts)
      .values(prompt)
      .returning();
    return newPrompt;
  }

  async updateSystemPrompt(id: number, prompt: Partial<InsertSystemPrompt>): Promise<SystemPrompt> {
    // If this is set as default, unset any existing default
    if (prompt.isDefault && prompt.userId) {
      // First get all default prompts that are not this one
      const defaultPrompts = await db
        .select()
        .from(systemPrompts)
        .where(and(
          eq(systemPrompts.userId, prompt.userId),
          eq(systemPrompts.isDefault, true)
        ));
      
      // Then unset default on all except this one
      for (const p of defaultPrompts) {
        if (p.id !== id) {
          await db
            .update(systemPrompts)
            .set({ isDefault: false })
            .where(eq(systemPrompts.id, p.id));
        }
      }
    }
    
    const [updatedPrompt] = await db
      .update(systemPrompts)
      .set(prompt)
      .where(eq(systemPrompts.id, id))
      .returning();
    return updatedPrompt;
  }

  async deleteSystemPrompt(id: number): Promise<void> {
    await db
      .delete(systemPrompts)
      .where(eq(systemPrompts.id, id));
  }

  async setDefaultSystemPrompt(id: number, userId: number): Promise<SystemPrompt> {
    // Unset any existing default
    await db
      .update(systemPrompts)
      .set({ isDefault: false })
      .where(and(
        eq(systemPrompts.userId, userId),
        eq(systemPrompts.isDefault, true)
      ));
    
    // Set new default
    const [updatedPrompt] = await db
      .update(systemPrompts)
      .set({ isDefault: true })
      .where(eq(systemPrompts.id, id))
      .returning();
    return updatedPrompt;
  }
  
  // MCP Tool methods
  async getMcpTool(id: number): Promise<McpTool | undefined> {
    const [tool] = await db
      .select()
      .from(mcpTools)
      .where(eq(mcpTools.id, id));
    return tool || undefined;
  }

  async getUserMcpTools(userId: number): Promise<McpTool[]> {
    return db
      .select()
      .from(mcpTools)
      .where(eq(mcpTools.userId, userId))
      .orderBy(desc(mcpTools.timestamp));
  }
  
  async getEnabledMcpTools(userId: number): Promise<McpTool[]> {
    return db
      .select()
      .from(mcpTools)
      .where(and(
        eq(mcpTools.userId, userId),
        eq(mcpTools.isEnabled, true)
      ))
      .orderBy(desc(mcpTools.timestamp));
  }

  async createMcpTool(tool: InsertMcpTool): Promise<McpTool> {
    const [newTool] = await db
      .insert(mcpTools)
      .values(tool)
      .returning();
    return newTool;
  }

  async updateMcpTool(id: number, tool: Partial<InsertMcpTool>): Promise<McpTool> {
    const [updatedTool] = await db
      .update(mcpTools)
      .set(tool)
      .where(eq(mcpTools.id, id))
      .returning();
    return updatedTool;
  }

  async deleteMcpTool(id: number): Promise<void> {
    await db
      .delete(mcpTools)
      .where(eq(mcpTools.id, id));
  }
  
  async toggleMcpToolStatus(id: number, isEnabled: boolean): Promise<McpTool> {
    const [updatedTool] = await db
      .update(mcpTools)
      .set({ isEnabled })
      .where(eq(mcpTools.id, id))
      .returning();
    return updatedTool;
  }
}

export const storage = new DatabaseStorage();
