import { useEffect, useRef, useState } from "react";
import { Message } from "@shared/schema";
import { MessageSquare, User, WrenchIcon, ArrowRight } from "lucide-react";
import LoadingDots from "@/components/ui/loading-dots";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MessageHistoryProps {
  messages: Message[];
  isLoading: boolean;
}

// 工具调用组件
function ToolCall({ toolCall }: { toolCall: any }) {
  const [mcpTool, setMcpTool] = useState<any>(null);
  
  // 获取工具信息
  const { data: tool } = useQuery({
    queryKey: ['/api/mcp-tools', toolCall?.toolId],
    queryFn: async () => {
      if (!toolCall?.toolId) return null;
      
      const response = await apiRequest('GET', `/api/mcp-tools/${toolCall.toolId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch MCP tool');
      }
      const data = await response.json();
      return data.tool;
    },
    enabled: !!toolCall?.toolId
  });

  useEffect(() => {
    if (tool) {
      setMcpTool(tool);
    }
  }, [tool]);

  if (!toolCall) return null;

  return (
    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-md p-3 mt-2 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center mb-2">
        <WrenchIcon className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
        <span className="font-medium text-sm">
          {mcpTool?.name || '工具调用'} 
          <Badge className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            使用工具
          </Badge>
        </span>
      </div>
      {toolCall.parameters && (
        <div className="mb-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">参数:</div>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono overflow-x-auto">
            {JSON.stringify(toolCall.parameters, null, 2)}
          </pre>
        </div>
      )}
      {toolCall.result && (
        <div>
          <div className="flex items-center mb-1 text-xs text-gray-500 dark:text-gray-400">
            <ArrowRight className="h-3 w-3 mr-1" />
            结果:
          </div>
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono overflow-x-auto">
            {JSON.stringify(toolCall.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function MessageHistory({ messages, isLoading }: MessageHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div 
      ref={containerRef}
      className="message-container flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6"
    >
      {messages.map((message, index) => (
        <div 
          key={index}
          className={`flex items-start mb-6 ${message.role === 'user' ? 'justify-end' : ''}`}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-accent dark:bg-dark-accent flex items-center justify-center text-white flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
          )}
          
          <div 
            className={`${
              message.role === 'user' 
                ? 'mr-3 bg-accent dark:bg-dark-accent text-white dark:text-white' 
                : 'ml-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            } rounded-lg p-4 max-w-[85%] shadow-sm`}
          >
            <div className="prose dark:prose-invert prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              
              {/* 如果是助手消息且有工具调用 */}
              {message.role === 'assistant' && message.toolCall && (
                // @ts-ignore -- 工具调用显示
                <ToolCall toolCall={message.toolCall} />
              )}
              
              {/* 如果是工具消息 */}
              {message.role === 'tool' && message.toolResult && (
                <div className="mt-2">
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono overflow-x-auto">
                    {/* @ts-ignore -- 工具结果显示 */}
                    {JSON.stringify(message.toolResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
          
          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
          )}
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start mb-6">
          <div className="w-8 h-8 rounded-full bg-accent dark:bg-dark-accent flex items-center justify-center text-white flex-shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="ml-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-[85%] shadow-sm flex items-center">
            <LoadingDots />
          </div>
        </div>
      )}
    </div>
  );
}
