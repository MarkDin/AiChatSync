import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import path from "path";
import OpenAI from "openai";

// 创建OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.deepseek.com/v1", // 使用Deepseek的API端点
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

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

export class MCPService {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private tools: MCPToolDefinition[] = [];
  private isConnected: boolean = false;
  private serverProcess: any = null;
  private mcpServers: Record<string, McpServerConfig> = {};

  constructor() {
    this.client = new Client({
      name: "ai-chat-mcp-client",
      version: "1.0.0",
    });

    // 配置MCP服务器
    this.mcpServers = {
      // 默认的内置MCP服务器
      "built-in-mcp": {
        command: "node",
        args: [path.join(process.cwd(), "server/mcp-server.ts")],
        disabled: false,
        autoApprove: ["get_weather", "get_city_info"]
      },
      // Tavily搜索API服务器 (需要TAVILY_API_KEY)
      "tavily-mcp": {
        command: "npx",
        args: ["-y", "tavily-mcp"],
        env: {
          TAVILY_API_KEY: process.env.TAVILY_API_KEY || ""
        },
        disabled: !process.env.TAVILY_API_KEY,
        autoApprove: []
      }
    };
  }

  public async initialize(): Promise<void> {
    try {
      const activeServers = Object.entries(this.mcpServers)
        .filter(([_, config]) => !config.disabled);
      
      if (activeServers.length === 0) {
        // 如果没有可用的MCP服务器，使用默认工具
        this.initializeDefaultTools();
        return;
      }

      // 初始化默认工具
      this.initializeDefaultTools();
      
      // 如果有Tavily API密钥，尝试连接到Tavily MCP服务器
      if (process.env.TAVILY_API_KEY && this.mcpServers["tavily-mcp"]) {
        await this.connectToMcpServer("tavily-mcp");
      }

      this.isConnected = true;
      console.log(
        "MCP Client initialized successfully with tools:",
        this.tools.map((t) => t.name),
      );
    } catch (error) {
      console.error("Failed to initialize MCP client:", error);
      // 如果连接失败，仍然使用默认工具
      this.initializeDefaultTools();
    }
  }
  
  private initializeDefaultTools(): void {
    // 定义默认可用工具
    this.tools = [
      {
        name: "get_weather",
        description: "获取指定地点的天气信息",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "城市名称（如：北京，上海）",
            },
            date: {
              type: "string",
              description: "日期（可选，格式：YYYY-MM-DD）",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "get_city_info",
        description: "获取城市的基本信息",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "城市名称（如：北京，上海，广州）",
            },
          },
          required: ["city"],
        },
      },
    ];
    
    this.isConnected = true;
  }
  
  private async connectToMcpServer(serverName: string): Promise<void> {
    try {
      const serverConfig = this.mcpServers[serverName];
      if (!serverConfig) {
        throw new Error(`MCP server configuration not found: ${serverName}`);
      }
      
      if (serverConfig.disabled) {
        throw new Error(`MCP server is disabled: ${serverName}`);
      }
      
      console.log(`Starting MCP server: ${serverName}`);
      
      // 准备环境变量
      const env = { ...process.env, ...serverConfig.env };
      
      // 启动MCP服务器进程
      this.serverProcess = spawn(serverConfig.command, serverConfig.args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      
      // 设置进程事件处理
      this.serverProcess.stdout.on("data", (data: Buffer) => {
        console.log(`[${serverName}] stdout: ${data.toString()}`);
      });
      
      this.serverProcess.stderr.on("data", (data: Buffer) => {
        console.error(`[${serverName}] stderr: ${data.toString()}`);
      });
      
      this.serverProcess.on("error", (err: Error) => {
        console.error(`[${serverName}] Error: ${err.message}`);
      });
      
      this.serverProcess.on("close", (code: number) => {
        console.log(`[${serverName}] Process exited with code ${code}`);
        this.serverProcess = null;
      });
      
      // 创建客户端传输
      this.transport = new StdioClientTransport(this.serverProcess);
      
      // 连接到MCP服务器
      await this.client.connect(this.transport);
      
      // 获取可用工具
      try {
        // 这里我们使用any绕过类型检查，因为MCP SDK的类型定义可能不完全匹配
        const client = this.client as any;
        const availableTools = await client.listTools();
        
        // 将MCP服务器的工具添加到工具列表
        if (Array.isArray(availableTools) && availableTools.length > 0) {
          for (const tool of availableTools) {
            if (tool && typeof tool === 'object' && 'name' in tool) {
              this.tools.push({
                name: tool.name as string,
                description: (tool.description as string) || `Provided by ${serverName}`,
                inputSchema: (tool.parameters as Record<string, any>) || {},
              });
            }
          }
          console.log(`Added ${availableTools.length} tools from ${serverName}`);
        }
      } catch (error) {
        console.error(`Error listing tools from ${serverName}:`, error);
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
      throw error;
    }
  }

  public async processWithTools(userMessage: string): Promise<{
    content: string;
    toolCalls: MCPToolResult[];
  }> {
    try {
      // 确保工具已初始化
      if (!this.isConnected) {
        await this.initialize();
      }

      // 从已定义的工具中准备OpenAI工具格式
      const openaiTools = this.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));

      // 发送请求到LLM
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "你是一个有用的AI助手，你可以使用提供的工具来回答用户的问题。",
          },
          { role: "user", content: userMessage },
        ],
        tools: openaiTools,
        tool_choice: "auto",
      });

      // 提取助手的回复
      const assistantMessage = response.choices[0].message;
      const toolCalls: MCPToolResult[] = [];

      // 处理工具调用
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type === "function") {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            // 工具调用结果
            let result: any;
            
            // 检查是否是MCP工具
            const isMcpTool = this.transport && 
                            !(toolName === "get_weather" || toolName === "get_city_info");
            
            if (isMcpTool) {
              try {
                // 使用MCP协议调用工具
                console.log(`Calling MCP tool: ${toolName} with args:`, toolArgs);
                // 由于类型问题，使用any来绕过类型检查
                const client = this.client as any;
                result = await client.call(toolName, toolArgs);
                console.log(`MCP tool ${toolName} result:`, result);
              } catch (toolError) {
                console.error(`Error calling MCP tool ${toolName}:`, toolError);
                result = {
                  error: `调用工具 "${toolName}" 时出错: ${toolError instanceof Error ? toolError.message : String(toolError)}`
                };
              }
            } else {
              // 使用内置工具模拟
              if (toolName === "get_weather") {
                const location = toolArgs.location || "北京";
                const date = toolArgs.date || new Date().toLocaleDateString();

                // 简单模拟，返回随机天气信息
                const conditions = [
                  "晴朗",
                  "多云",
                  "小雨",
                  "大雨",
                  "雷雨",
                  "大雪",
                  "有雾",
                ];
                const temperatures = Math.floor(Math.random() * 35) + 5; // 5-40°C
                const humidity = Math.floor(Math.random() * 60) + 40; // 40-100%
                const windSpeed = Math.floor(Math.random() * 30) + 1; // 1-30km/h

                const condition =
                  conditions[Math.floor(Math.random() * conditions.length)];

                result = {
                  location,
                  date,
                  weather: {
                    condition,
                    temperature: `${temperatures}°C`,
                    humidity: `${humidity}%`,
                    windSpeed: `${windSpeed} km/h`,
                  },
                };
              } else if (toolName === "get_city_info") {
                const city = toolArgs.city || "北京";

                // 城市信息库（模拟）
                const cityInfo: Record<string, any> = {
                  北京: {
                    country: "中国",
                    population: "21.54 million",
                    area: "16,410 km²",
                    timezone: "UTC+8",
                    famousFor: "故宫，长城，天坛",
                  },
                  上海: {
                    country: "中国",
                    population: "26.32 million",
                    area: "6,340 km²",
                    timezone: "UTC+8",
                    famousFor: "外滩，东方明珠，豫园",
                  },
                  广州: {
                    country: "中国",
                    population: "15.31 million",
                    area: "7,434 km²",
                    timezone: "UTC+8",
                    famousFor: "广州塔，沙面，陈家祠",
                  },
                };

                const info = cityInfo[city] || {
                  country: "未知",
                  population: "数据不可用",
                  area: "数据不可用",
                  timezone: "未知",
                  famousFor: "未知",
                };

                result = {
                  city,
                  ...info,
                };
              } else {
                result = {
                  message: `工具 "${toolName}" 不可用或无法识别`,
                };
              }
            }

            // 保存工具调用结果
            toolCalls.push({
              name: toolName,
              arguments: toolArgs,
              result,
            });

            // 将工具结果添加为新消息
            const toolResultMessage = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            };

            // 发送带有工具结果的请求到LLM
            const finalResponse = await openai.chat.completions.create({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content:
                    "你是一个有用的AI助手，你可以使用提供的工具来回答用户的问题。",
                },
                { role: "user", content: userMessage },
                assistantMessage,
                toolResultMessage,
              ],
            });

            // 返回最终响应
            return {
              content:
                finalResponse.choices[0].message.content || "没有返回内容",
              toolCalls,
            };
          }
        }
      }

      // 如果没有工具调用
      return {
        content: assistantMessage.content || "没有返回内容",
        toolCalls: [],
      };
    } catch (error) {
      console.error("Error processing with MCP tools:", error);
      return {
        content: `处理消息时出错: ${error instanceof Error ? error.message : String(error)}`,
        toolCalls: [],
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
