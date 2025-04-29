import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import path from 'path';
import OpenAI from 'openai';

// 创建OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPToolResult {
  name: string;
  arguments: Record<string, any>;
  result: any;
}

export class MCPService {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private tools: MCPToolDefinition[] = [];
  private isConnected: boolean = false;
  private serverProcess: any = null;

  constructor() {
    this.client = new Client({ 
      name: "ai-chat-mcp-client", 
      version: "1.0.0" 
    });
  }

  public async initialize(): Promise<void> {
    try {
      // 直接运行MCP服务器脚本
      const serverScriptPath = path.resolve(process.cwd(), 'server', 'mcp-server.ts');
      
      this.transport = new StdioClientTransport({
        command: 'tsx',
        args: [serverScriptPath],
      });

      // 连接到MCP服务器
      this.client.connect(this.transport);
      
      // 获取可用的工具列表
      const toolsResult = await this.client.listTools();
      this.tools = toolsResult.tools.map(tool => ({
        name: tool.name,
        description: tool.description || "无描述",  // 确保description不为undefined
        inputSchema: tool.inputSchema
      }));
      
      this.isConnected = true;
      console.log("MCP Client initialized successfully with tools:", this.tools.map(t => t.name));
      
    } catch (error) {
      console.error("Failed to initialize MCP client:", error);
      this.isConnected = false;
      throw error;
    }
  }

  public async processWithTools(userMessage: string): Promise<{ 
    content: string; 
    toolCalls: MCPToolResult[] 
  }> {
    if (!this.isConnected) {
      try {
        await this.initialize();
      } catch (error) {
        return {
          content: "无法连接到MCP服务器，工具调用不可用。",
          toolCalls: []
        };
      }
    }
    
    try {
      // 准备发送给LLM的工具定义
      const openaiTools = this.tools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }));

      // 发送请求到LLM
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // 使用最新的GPT模型
        messages: [
          { role: "system", content: "你是一个有用的AI助手，你可以使用提供的工具来回答用户的问题。" },
          { role: "user", content: userMessage }
        ],
        tools: openaiTools,
        tool_choice: "auto",
      });

      // 提取助手的回复
      const assistantMessage = response.choices[0].message;
      const toolCalls: MCPToolResult[] = [];
      
      // 处理工具调用
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type === 'function') {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            // 通过MCP客户端调用工具
            const mcpResult = await this.client.callTool({
              name: toolName,
              arguments: toolArgs
            });
            
            let parsedResult;
            try {
              parsedResult = JSON.parse(mcpResult.content as string);
            } catch (e) {
              parsedResult = mcpResult.content;
            }
            
            // 保存工具调用结果
            toolCalls.push({
              name: toolName,
              arguments: toolArgs,
              result: parsedResult
            });
            
            // 将工具结果添加为新消息
            const toolResultMessage = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(parsedResult),
            };
            
            // 发送带有工具结果的请求到LLM
            const finalResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { role: "system", content: "你是一个有用的AI助手，你可以使用提供的工具来回答用户的问题。" },
                { role: "user", content: userMessage },
                assistantMessage,
                toolResultMessage
              ]
            });
            
            // 返回最终响应
            return {
              content: finalResponse.choices[0].message.content || "没有返回内容",
              toolCalls
            };
          }
        }
      }
      
      // 如果没有工具调用
      return {
        content: assistantMessage.content || "没有返回内容",
        toolCalls: []
      };
      
    } catch (error) {
      console.error("Error processing with MCP tools:", error);
      return {
        content: `处理消息时出错: ${error instanceof Error ? error.message : String(error)}`,
        toolCalls: []
      };
    }
  }

  public getAvailableTools(): MCPToolDefinition[] {
    return this.tools;
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.close();
        this.isConnected = false;
      }
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }
    } catch (error) {
      console.error("Error shutting down MCP client:", error);
    }
  }
}

// 创建单例实例
export const mcpService = new MCPService();