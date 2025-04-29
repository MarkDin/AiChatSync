import { spawn } from "child_process";

interface WeatherParams {
  location: string;
  date?: string;
}

// 天气工具 - 这是一个模拟实现
async function getWeather(params: WeatherParams): Promise<any> {
  const { location, date } = params;
  const currentDate = date || new Date().toLocaleDateString();
  
  // 简单模拟，返回随机天气信息
  const conditions = ["晴朗", "多云", "小雨", "大雨", "雷雨", "大雪", "有雾"];
  const temperatures = Math.floor(Math.random() * 35) + 5; // 5-40°C
  const humidity = Math.floor(Math.random() * 60) + 40; // 40-100%
  const windSpeed = Math.floor(Math.random() * 30) + 1; // 1-30km/h
  
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  
  return {
    location,
    date: currentDate,
    weather: {
      condition,
      temperature: `${temperatures}°C`,
      humidity: `${humidity}%`,
      windSpeed: `${windSpeed} km/h`
    }
  };
}

// 城市信息工具 - 模拟实现
async function getCityInfo(params: { city: string }): Promise<any> {
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
  
  return {
    city,
    ...info
  };
}

async function main() {
  console.log("MCP Server started and ready to handle requests.");
  console.log("Available tools: get_weather, get_city_info");
  
  // 这只是一个模拟服务器，实际上不需要启动，
  // 因为mcp-client.ts会直接调用相应的函数而不是通过MCP协议
}

// 捕获任何未处理的错误
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 运行主函数
main().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});