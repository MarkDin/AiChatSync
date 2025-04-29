import React, { useState, useEffect } from 'react';
import { WrenchIcon, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const MOCK_USER_ID = 1; // 演示用，真实应用中应从认证获取

interface McpToolSelectorProps {
  conversationId?: number;
  onToolsEnabled: (enabled: boolean) => void;
}

export default function McpToolSelector({ conversationId, onToolsEnabled }: McpToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTools, setSelectedTools] = useState<number[]>([]);
  const [anyToolEnabled, setAnyToolEnabled] = useState(false);

  // 获取MCP工具列表
  const { data: tools, isLoading: isLoadingTools } = useQuery({
    queryKey: ['/api/mcp-tools/enabled'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/mcp-tools/enabled?userId=${MOCK_USER_ID}`);
      if (!response.ok) {
        throw new Error('Failed to fetch enabled MCP tools');
      }
      const data = await response.json();
      return data.tools || [];
    }
  });

  // 获取对话
  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['/api/conversations', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const response = await apiRequest('GET', `/api/conversations/${conversationId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch conversation');
      }
      const data = await response.json();
      return data.conversation;
    },
    enabled: !!conversationId
  });

  // 更新对话的工具设置
  const { mutate: updateConversationTools } = useMutation({
    mutationFn: async ({ id, enabledTools }: { id: number; enabledTools: number[] }) => {
      const response = await apiRequest('PATCH', `/api/conversations/${id}/tools`, { enabledTools });
      if (!response.ok) {
        throw new Error('Failed to update conversation tools');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId] });
      toast({
        title: '工具设置已更新',
        description: '对话的MCP工具设置已成功更新',
      });
    },
    onError: (error) => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新对话工具设置时出错',
        variant: 'destructive',
      });
    },
  });

  // 初始化已选工具
  useEffect(() => {
    if (conversation && conversation.enabledTools && Array.isArray(conversation.enabledTools)) {
      setSelectedTools(conversation.enabledTools);
      setAnyToolEnabled(conversation.enabledTools.length > 0);
      onToolsEnabled(conversation.enabledTools.length > 0);
    } else {
      setSelectedTools([]);
      setAnyToolEnabled(false);
      onToolsEnabled(false);
    }
  }, [conversation, onToolsEnabled]);

  const handleToolToggle = (toolId: number) => {
    const newSelectedTools = selectedTools.includes(toolId)
      ? selectedTools.filter(id => id !== toolId)
      : [...selectedTools, toolId];
    
    setSelectedTools(newSelectedTools);
    
    if (conversationId) {
      updateConversationTools({
        id: conversationId,
        enabledTools: newSelectedTools
      });
    }
    
    const hasEnabledTools = newSelectedTools.length > 0;
    setAnyToolEnabled(hasEnabledTools);
    onToolsEnabled(hasEnabledTools);
  };

  // 如果加载中或没有可用工具，则不显示选择器
  if (isLoadingTools) {
    return (
      <div className="flex items-center space-x-2 mb-4">
        <WrenchIcon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载工具...</span>
      </div>
    );
  }
  
  if (!tools || tools.length === 0) {
    return null; // 没有可用工具，不显示
  }

  return (
    <div className="mb-4">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="border rounded-md p-2"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex w-full justify-between items-center p-2"
          >
            <div className="flex items-center">
              <WrenchIcon className="h-5 w-5 mr-2" />
              <span>
                MCP工具 
                {anyToolEnabled && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2 py-0.5 rounded">
                    已启用
                  </span>
                )}
              </span>
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2 pb-1 px-1 space-y-2">
            {tools.map((tool: any) => (
              <div
                key={tool.id}
                className="flex items-start space-x-2 py-1"
              >
                <Checkbox
                  id={`tool-${tool.id}`}
                  checked={selectedTools.includes(tool.id)}
                  onCheckedChange={() => handleToolToggle(tool.id)}
                />
                <div className="grid gap-1">
                  <label
                    htmlFor={`tool-${tool.id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {tool.name}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}