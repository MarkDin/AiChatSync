import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { SystemPrompt, SystemPromptRequest } from '@shared/schema';

const MOCK_USER_ID = 1; // 演示用，真实应用中应从认证获取

interface SystemPromptFormProps {
  prompt?: SystemPrompt;
  onClose: () => void;
}

function SystemPromptForm({ prompt, onClose }: SystemPromptFormProps) {
  const [title, setTitle] = useState(prompt?.title || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [isDefault, setIsDefault] = useState(prompt?.isDefault || false);

  const { mutate: createPrompt, isPending: isCreating } = useMutation({
    mutationFn: async (data: SystemPromptRequest) => {
      const response = await apiRequest('POST', '/api/system-prompts', data);
      if (!response.ok) {
        throw new Error('Failed to create system prompt');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
      toast({
        title: '提示已创建',
        description: '系统提示已成功创建',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建系统提示时出错',
        variant: 'destructive',
      });
    },
  });

  const { mutate: updatePrompt, isPending: isUpdating } = useMutation({
    mutationFn: async (data: SystemPromptRequest & { id: number }) => {
      const { id, ...rest } = data;
      const response = await apiRequest('PATCH', `/api/system-prompts/${id}`, rest);
      if (!response.ok) {
        throw new Error('Failed to update system prompt');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
      toast({
        title: '提示已更新',
        description: '系统提示已成功更新',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新系统提示时出错',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast({
        title: '验证错误',
        description: '标题和内容不能为空',
        variant: 'destructive',
      });
      return;
    }

    const data = {
      title: title.trim(),
      content: content.trim(),
      isDefault,
      userId: MOCK_USER_ID,
    };

    if (prompt?.id) {
      updatePrompt({ ...data, id: prompt.id });
    } else {
      createPrompt(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          标题
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入提示标题"
          required
        />
      </div>
      
      <div>
        <label htmlFor="content" className="block text-sm font-medium mb-1">
          内容
        </label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入系统提示内容..."
          className="min-h-[150px]"
          required
        />
      </div>
      
      <div className="flex items-center">
        <input
          id="default"
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        <label htmlFor="default" className="ml-2 block text-sm">
          设为默认
        </label>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" disabled={isCreating || isUpdating}>
          {prompt ? '更新' : '创建'}
        </Button>
      </div>
    </form>
  );
}

export default function SystemPrompts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | undefined>(undefined);

  // 获取系统提示
  const { data, isLoading } = useQuery({
    queryKey: ['/api/system-prompts'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/system-prompts?userId=${MOCK_USER_ID}`);
      if (!response.ok) {
        throw new Error('Failed to fetch system prompts');
      }
      const data = await response.json();
      return data.prompts as SystemPrompt[];
    }
  });

  // 删除系统提示
  const { mutate: deletePrompt } = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/system-prompts/${id}`);
      if (!response.ok) {
        throw new Error('Failed to delete system prompt');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
      toast({
        title: '提示已删除',
        description: '系统提示已成功删除',
      });
    },
    onError: (error) => {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除系统提示时出错',
        variant: 'destructive',
      });
    },
  });

  // 设置默认系统提示
  const { mutate: setDefaultPrompt } = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/system-prompts/${id}/set-default`, { userId: MOCK_USER_ID });
      if (!response.ok) {
        throw new Error('Failed to set default system prompt');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system-prompts'] });
      toast({
        title: '默认提示已设置',
        description: '默认系统提示已更新',
      });
    },
    onError: (error) => {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '设置默认系统提示时出错',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (prompt: SystemPrompt) => {
    setSelectedPrompt(prompt);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedPrompt(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">系统提示</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => setSelectedPrompt(undefined)}>
              <Plus className="h-4 w-4 mr-1" /> 新增
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{selectedPrompt ? '编辑系统提示' : '创建系统提示'}</DialogTitle>
            </DialogHeader>
            <SystemPromptForm prompt={selectedPrompt} onClose={handleCloseDialog} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4">加载中...</div>
      ) : (data && data.length > 0) ? (
        <div className="space-y-3">
          {data.map((prompt) => (
            <div
              key={prompt.id}
              className={`border rounded-md p-3 ${
                prompt.isDefault ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium">
                  {prompt.title}
                  {prompt.isDefault && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 px-2 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </h3>
                <div className="flex gap-1">
                  {!prompt.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setDefaultPrompt(prompt.id)}
                      title="设为默认"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(prompt)}
                    title="编辑"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500"
                    onClick={() => deletePrompt(prompt.id)}
                    title="删除"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">{prompt.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>没有系统提示</p>
          <p className="text-sm">点击"新增"按钮创建一个</p>
        </div>
      )}
    </div>
  );
}