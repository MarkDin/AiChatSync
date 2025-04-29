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
      // 定义默认可用工具，不再尝试连接到MCP服务器
      this.tools = [
        {
          name: "get_weather",
          description: "获取指定地点的天气信息",
          inputSchema: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "城市名称（如：北京，上海）"
              },
              date: {
                type: "string",
                description: "日期（可选，格式：YYYY-MM-DD）"
              }
            },
            required: ["location"]
          }
        },
        {
          name: "get_city_info",
          description: "获取城市的基本信息",
          inputSchema: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "城市名称（如：北京，上海，广州）"
              }
            },
            required: ["city"]
          }
        }
      ];
      
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
    try {
      // 确保工具已初始化
      if (!this.isConnected) {
        await this.initialize();
      }
      
      // 从已定义的工具中准备OpenAI工具格式
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
            
            // 模拟工具调用
            let result: any;
            
            if (toolName === 'get_weather') {
              const location = toolArgs.location || '北京';
              const date = toolArgs.date || new Date().toLocaleDateString();
              
              // 简单模拟，返回随机天气信息
              const conditions = ["晴朗", "多云", "小雨", "大雨", "雷雨", "大雪", "有雾"];
              const temperatures = Math.floor(Math.random() * 35) + 5; // 5-40°C
              const humidity = Math.floor(Math.random() * 60) + 40; // 40-100%
              const windSpeed = Math.floor(Math.random() * 30) + 1; // 1-30km/h
              
              const condition = conditions[Math.floor(Math.random() * conditions.length)];
              
              result = {
                location,
                date,
                weather: {
                  condition,
                  temperature: `${temperatures}°C`,
                  humidity: `${humidity}%`,
                  windSpeed: `${windSpeed} km/h`
                }
              };
            } else if (toolName === 'get_city_info') {
              const city = toolArgs.city || '北京';
              
              // 城市信息库（模拟）
              const cityInfo: Record<string, any> = {
                "北京": {
                  country: "中国",
                  population: "21.54 million",
                  area: "16,410 km²",
                  timezone: "UTC+8",
                  famousFor: "故宫，长城，天坛"
                },
                "上海": {
                  country: "中国",
                  population: "26.32 million",
                  area: "6,340 km²",
                  timezone: "UTC+8",
                  famousFor: "外滩，东方明珠，豫园"
                },
                "广州": {
                  country: "中国",
                  population: "15.31 million",
                  area: "7,434 km²",
                  timezone: "UTC+8",
                  famousFor: "广州塔，沙面，陈家祠"
                }
              };
              
              const info = cityInfo[city] || {
                country: "未知",
                population: "数据不可用",
                area: "数据不可用",
                timezone: "未知",
                famousFor: "未知"
              };
              
              result = {
                city,
                ...info
              };
            } else {
              result = {
                message: `工具 "${toolName}" 不可用或无法识别`
              };
            }
            
            // 保存工具调用结果
            toolCalls.push({
              name: toolName,
              arguments: toolArgs,
              result
            });
            
            // 将工具结果添加为新消息
            const toolResultMessage = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
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