import React, { useState } from 'react';
import { WrenchIcon, Trash, Edit, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { McpToolRequest } from '@shared/schema';

const MOCK_USER_ID = 1; // 演示用，真实应用中应从认证获取

interface McpToolFormProps {
  tool?: any;
  onClose: () => void;
}

function McpToolForm({ tool, onClose }: McpToolFormProps) {
  const [name, setName] = useState(tool?.name || '');
  const [description, setDescription] = useState(tool?.description || '');
  const [icon, setIcon] = useState(tool?.icon || 'tool');
  const [configStr, setConfigStr] = useState(
    tool?.configuration ? JSON.stringify(tool.configuration, null, 2) : '{}'
  );
  const [isEnabled, setIsEnabled] = useState(tool?.isEnabled !== false);
  const [configError, setConfigError] = useState('');

  const { mutate: createTool, isPending: isCreating } = useMutation({
    mutationFn: async (data: McpToolRequest) => {
      const response = await apiRequest('POST', '/api/mcp-tools', data);
      if (!response.ok) {
        throw new Error('Failed to create MCP tool');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mcp-tools'] });
      toast({
        title: '工具已创建',
        description: 'MCP工具已成功创建',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建MCP工具时出错',
        variant: 'destructive',
      });
    },
  });

  const { mutate: updateTool, isPending: isUpdating } = useMutation({
    mutationFn: async (data: McpToolRequest & { id: number }) => {
      const { id, ...rest } = data;
      const response = await apiRequest('PATCH', `/api/mcp-tools/${id}`, rest);
      if (!response.ok) {
        throw new Error('Failed to update MCP tool');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mcp-tools'] });
      toast({
        title: '工具已更新',
        description: 'MCP工具已成功更新',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新MCP工具时出错',
        variant: 'destructive',
      });
    },
  });

  const validateConfig = () => {
    try {
      JSON.parse(configStr);
      setConfigError('');
      return true;
    } catch (error) {
      setConfigError('配置必须是有效的JSON');
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !description.trim()) {
      toast({
        title: '验证错误',
        description: '名称和描述不能为空',
        variant: 'destructive',
      });
      return;
    }

    if (!validateConfig()) {
      return;
    }

    let configuration;
    try {
      configuration = JSON.parse(configStr);
    } catch (e) {
      return; // 验证已经处理过这个错误
    }

    const data = {
      name: name.trim(),
      description: description.trim(),
      icon,
      configuration,
      isEnabled,
      userId: MOCK_USER_ID,
    };

    if (tool?.id) {
      updateTool({ ...data, id: tool.id });
    } else {
      createTool(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          名称
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入工具名称"
          required
        />
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          描述
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="输入工具描述..."
          className="min-h-[80px]"
          required
        />
      </div>
      
      <div>
        <label htmlFor="icon" className="block text-sm font-medium mb-1">
          图标
        </label>
        <div className="flex items-center space-x-2">
          <Input
            id="icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="输入图标名称"
          />
          <div className="w-8 h-8 flex items-center justify-center border rounded">
            <WrenchIcon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          目前仅支持默认图标
        </p>
      </div>
      
      <div>
        <label htmlFor="configuration" className="block text-sm font-medium mb-1">
          配置 (JSON)
        </label>
        <Textarea
          id="configuration"
          value={configStr}
          onChange={(e) => setConfigStr(e.target.value)}
          placeholder='{"param1": "value1", "param2": "value2"}'
          className="min-h-[150px] font-mono text-sm"
          required
          onBlur={validateConfig}
        />
        {configError && (
          <p className="text-sm text-red-500 mt-1">{configError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          必须是有效的JSON格式
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
        />
        <label htmlFor="enabled" className="text-sm">
          启用此工具
        </label>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" disabled={isCreating || isUpdating}>
          {tool ? '更新' : '创建'}
        </Button>
      </div>
    </form>
  );
}

export default function McpToolsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any | undefined>(undefined);

  // 获取MCP工具列表
  const { data, isLoading } = useQuery({
    queryKey: ['/api/mcp-tools'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/mcp-tools?userId=${MOCK_USER_ID}`);
      if (!response.ok) {
        throw new Error('Failed to fetch MCP tools');
      }
      const data = await response.json();
      return data.tools || [];
    }
  });

  // 删除MCP工具
  const { mutate: deleteTool } = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/mcp-tools/${id}`);
      if (!response.ok) {
        throw new Error('Failed to delete MCP tool');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mcp-tools'] });
      toast({
        title: '工具已删除',
        description: 'MCP工具已成功删除',
      });
    },
    onError: (error) => {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除MCP工具时出错',
        variant: 'destructive',
      });
    },
  });

  // 切换工具状态
  const { mutate: toggleToolStatus } = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      const response = await apiRequest('POST', `/api/mcp-tools/${id}/toggle`, { isEnabled });
      if (!response.ok) {
        throw new Error('Failed to toggle MCP tool status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mcp-tools'] });
      toast({
        title: '状态已更新',
        description: 'MCP工具状态已更新',
      });
    },
    onError: (error) => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新MCP工具状态时出错',
        variant: 'destructive',
      });
    },
  });

  const handleToggleStatus = (id: number, currentStatus: boolean) => {
    toggleToolStatus({ id, isEnabled: !currentStatus });
  };

  const handleEdit = (tool: any) => {
    setSelectedTool(tool);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTool(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">MCP 工具</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => setSelectedTool(undefined)}>
              <Plus className="h-4 w-4 mr-1" /> 新增
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{selectedTool ? '编辑MCP工具' : '创建MCP工具'}</DialogTitle>
            </DialogHeader>
            <McpToolForm tool={selectedTool} onClose={handleCloseDialog} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4">加载中...</div>
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((tool: any) => (
            <div
              key={tool.id}
              className={`border rounded-md p-3 ${
                tool.isEnabled ? 'border-green-400 dark:border-green-600' : 'border-gray-300 dark:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center">
                  <WrenchIcon className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-300" />
                  <h3 className="font-medium">
                    {tool.name}
                    {tool.isEnabled ? (
                      <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        已启用
                      </Badge>
                    ) : (
                      <Badge className="ml-2 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                        已禁用
                      </Badge>
                    )}
                  </h3>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleToggleStatus(tool.id, tool.isEnabled)}
                    title={tool.isEnabled ? "禁用工具" : "启用工具"}
                  >
                    {tool.isEnabled ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(tool)}
                    title="编辑"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500"
                    onClick={() => deleteTool(tool.id)}
                    title="删除"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{tool.description}</p>
              <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono overflow-x-auto">
                {JSON.stringify(tool.configuration, null, 2)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>没有MCP工具</p>
          <p className="text-sm">点击"新增"按钮创建一个</p>
        </div>
      )}
    </div>
  );
}