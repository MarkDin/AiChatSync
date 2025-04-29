import { Server, ServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

interface WeatherParams {
  location: string;
  date?: string;
}

// 天气工具 - 这是一个模拟实现
async function getWeather(params: WeatherParams): Promise<string> {
  const { location, date } = params;
  const currentDate = date || new Date().toLocaleDateString();
  
  // 简单模拟，返回随机天气信息
  const conditions = ["晴朗", "多云", "小雨", "大雨", "雷雨", "大雪", "有雾"];
  const temperatures = Math.floor(Math.random() * 35) + 5; // 5-40°C
  const humidity = Math.floor(Math.random() * 60) + 40; // 40-100%
  const windSpeed = Math.floor(Math.random() * 30) + 1; // 1-30km/h
  
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  
  return JSON.stringify({
    location,
    date: currentDate,
    weather: {
      condition,
      temperature: `${temperatures}°C`,
      humidity: `${humidity}%`,
      windSpeed: `${windSpeed} km/h`
    }
  });
}

// 城市信息工具 - 模拟实现
async function getCityInfo(params: { city: string }): Promise<string> {
  const { city } = params;
  
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
  
  return JSON.stringify({
    city,
    ...info
  });
}

async function main() {
  // 创建和配置MCP服务器
  const transport: ServerTransport = new StdioServerTransport();
  const server = new Server({ 
    name: "weather-and-city-info-server", 
    version: "1.0.0" 
  });
  
  // 注册工具
  server.registerTool({
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
    },
    handler: async (params: unknown) => {
      try {
        const result = await getWeather(params as WeatherParams);
        return {
          status: "success",
          content: result
        };
      } catch (error) {
        return {
          status: "error",
          error: `获取天气信息失败: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
  
  server.registerTool({
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
    },
    handler: async (params: unknown) => {
      try {
        const result = await getCityInfo(params as { city: string });
        return {
          status: "success",
          content: result
        };
      } catch (error) {
        return {
          status: "error",
          error: `获取城市信息失败: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
  
  // 启动服务器
  server.serve(transport);
  console.log("MCP Server started and ready to handle requests");
}

main();