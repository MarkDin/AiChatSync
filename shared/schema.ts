import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// System prompts schema
export const systemPrompts = pgTable("system_prompts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id),
  isDefault: boolean("is_default").default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertSystemPromptSchema = createInsertSchema(systemPrompts).pick({
  title: true,
  content: true,
  userId: true,
  isDefault: true,
});

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = z.infer<typeof insertSystemPromptSchema>;

// Conversations schema
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: integer("user_id").references(() => users.id),
  systemPromptId: integer("system_prompt_id").references(() => systemPrompts.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  title: true,
  userId: true,
  systemPromptId: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// Chat messages schema
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'system', 'user' or 'assistant'
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id),
  conversationId: integer("conversation_id").references(() => conversations.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  role: true,
  content: true,
  userId: true,
  conversationId: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Schema for chat completion requests
export const chatCompletionSchema = z.object({
  message: z.string().nonempty("Message cannot be empty"),
  conversationId: z.number().optional(),
  systemPromptId: z.number().optional(),
  userId: z.number().optional(),
});

export type ChatCompletionRequest = z.infer<typeof chatCompletionSchema>;

// Schema for system prompt requests
export const systemPromptSchema = z.object({
  title: z.string().nonempty("Title cannot be empty"),
  content: z.string().nonempty("Content cannot be empty"),
  isDefault: z.boolean().optional(),
  userId: z.number().optional(),
});

export type SystemPromptRequest = z.infer<typeof systemPromptSchema>;
