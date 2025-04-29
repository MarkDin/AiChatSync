import { spawn, ChildProcess } from "child_process";
import path from "path";
import OpenAI from "openai";
import fetch from "node-fetch";

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

// 实现基于MCP协议的工具服务
export class MCPService {
  private serverProcesses: Map<string, ChildProcess> = new Map();
  private tools: MCPToolDefinition[] = [];
  private isConnected: boolean = false;
  private mcpServers: Record<string, McpServerConfig> = {};

  constructor() {
    // 配置MCP服务器
    this.mcpServers = {
      // 默认的内置MCP服务器（模拟天气和城市信息）
      "built-in-mcp": {
        command: "tsx",
        args: [path.join(process.cwd(), "server/mcp-server.ts")],
        disabled: false,
        autoApprove: ["get_weather", "get_city_info"]
      },
      // Tavily搜索API服务器 (需要TAVILY_API_KEY)
      "tavily-mcp": {
        command: "npx",
        args: ["tavily-mcp"],
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
      // 初始化默认工具
      this.initializeDefaultTools();
      
      // 获取活跃的MCP服务器
      const activeServers = Object.entries(this.mcpServers)
        .filter(([_, config]) => !config.disabled);
      
      // 连接到活跃的MCP服务器
      for (const [serverName, _] of activeServers) {
        try {
          // 使用Tavily API直接集成，而不是通过MCP服务器
          if (serverName === "tavily-mcp") {
            this.addTavilySearchTool();
            continue;
          }
          
          // 对于其他服务器，我们只需启动进程，但不实际连接到它们
          // 我们将通过直接实现来模拟与它们的交互
          await this.startMcpServerProcess(serverName);
        } catch (error) {
          console.error(`Failed to connect to MCP server ${serverName}:`, error);
        }
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
  
  private addTavilySearchTool(): void {
    // 手动添加Tavily搜索工具
    this.tools.push({
      name: "tavily_search",
      description: "使用Tavily搜索引擎搜索互联网上的最新信息",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "要搜索的查询字符串",
          },
          search_depth: {
            type: "string",
            enum: ["basic", "advanced"],
            description: "搜索深度，基本或高级",
            default: "basic"
          },
          include_domains: {
            type: "array",
            items: {
              type: "string"
            },
            description: "要包含的域名列表",
            default: []
          },
          exclude_domains: {
            type: "array",
            items: {
              type: "string"
            },
            description: "要排除的域名列表",
            default: []
          },
          max_results: {
            type: "integer",
            description: "最大返回结果数",
            default: 5
          }
        },
        required: ["query"],
      }
    });
    
    console.log("已添加Tavily搜索工具: tavily_search");
  }
  
  private async startMcpServerProcess(serverName: string): Promise<void> {
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
      const processEnv = { ...process.env, ...serverConfig.env };
      
      // 启动MCP服务器进程
      const childProcess = spawn(serverConfig.command, serverConfig.args, {
        env: processEnv,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      
      // 存储进程
      this.serverProcesses.set(serverName, childProcess);
      
      // 设置进程事件处理
      childProcess.stdout.on("data", (data: Buffer) => {
        console.log(`[${serverName}] stdout: ${data.toString().trim()}`);
      });
      
      childProcess.stderr.on("data", (data: Buffer) => {
        console.error(`[${serverName}] stderr: ${data.toString().trim()}`);
      });
      
      childProcess.on("error", (err: Error) => {
        console.error(`[${serverName}] Error: ${err.message}`);
      });
      
      childProcess.on("close", (code: number) => {
        console.log(`[${serverName}] Process exited with code ${code}`);
        this.serverProcesses.delete(serverName);
      });

      console.log(`MCP server ${serverName} started successfully`);
    } catch (error) {
      console.error(`Failed to start MCP server ${serverName}:`, error);
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
            
            // 为不同的工具调用执行不同的逻辑
            if (toolName === "get_weather") {
              // 模拟天气工具
              result = await this.executeWeatherTool(toolArgs);
            } else if (toolName === "get_city_info") {
              // 模拟城市信息工具
              result = await this.executeCityInfoTool(toolArgs);
            } else if (toolName === "tavily_search") {
              // 使用Tavily API
              result = await this.executeTavilySearchTool(toolArgs);
            } else {
              // 为未知工具提供一个默认回复
              result = {
                message: `工具 "${toolName}" 不可用或无法识别。请使用 tavily_search、get_weather 或 get_city_info。`
              };
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

  private async executeWeatherTool(args: any): Promise<any> {
    const location = args.location || "北京";
    const date = args.date || new Date().toLocaleDateString();

    // 简单模拟，返回随机天气信息
    const conditions = ["晴朗", "多云", "小雨", "大雨", "雷雨", "大雪", "有雾"];
    const temperatures = Math.floor(Math.random() * 35) + 5; // 5-40°C
    const humidity = Math.floor(Math.random() * 60) + 40; // 40-100%
    const windSpeed = Math.floor(Math.random() * 30) + 1; // 1-30km/h

    const condition = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      location,
      date,
      weather: {
        condition,
        temperature: `${temperatures}°C`,
        humidity: `${humidity}%`,
        windSpeed: `${windSpeed} km/h`,
      },
    };
  }

  private async executeCityInfoTool(args: any): Promise<any> {
    const city = args.city || "北京";

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

    return {
      city,
      ...info,
    };
  }

  private async executeTavilySearchTool(args: any): Promise<any> {
    console.log(`Calling Tavily search with query: "${args.query}"`);
    
    try {
      // 使用Tavily API
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`
        },
        body: JSON.stringify({
          query: args.query,
          search_depth: args.search_depth || "basic",
          include_domains: args.include_domains || [],
          exclude_domains: args.exclude_domains || [],
          max_results: args.max_results || 5
        })
      });
      
      if (!response.ok) {
        throw new Error(`Tavily API returned status ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Tavily search results:", data);
      
      return data;
    } catch (error) {
      console.error("Error calling Tavily API:", error);
      return {
        error: `Tavily搜索出错: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  public getAvailableTools(): MCPToolDefinition[] {
    return this.tools;
  }

  public async shutdown(): Promise<void> {
    try {
      // 杀死所有MCP服务器进程
      const processEntries = Array.from(this.serverProcesses.entries());
      for (const [serverName, childProcess] of processEntries) {
        try {
          childProcess.kill();
          console.log(`Killed MCP server process ${serverName}`);
        } catch (error) {
          console.error(`Error killing MCP server process ${serverName}:`, error);
        }
      }
      this.serverProcesses.clear();
      
      this.isConnected = false;
    } catch (error) {
      console.error("Error shutting down MCP service:", error);
    }
  }
}

// 创建单例实例
export const mcpService = new MCPService();