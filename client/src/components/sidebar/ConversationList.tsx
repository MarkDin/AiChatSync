import React, { useState } from 'react';
import { MessageSquare, Edit, Trash, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Conversation } from '@shared/schema';
import { format } from 'date-fns';

// 演示用
const MOCK_USER_ID = 1;

interface ConversationListProps {
  activeConversationId?: number;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  activeConversationId,
  onSelectConversation,
  onNewConversation
}: ConversationListProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [title, setTitle] = useState('');

  // 获取对话列表
  const { data, isLoading } = useQuery({
    queryKey: ['/api/conversations'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/conversations?userId=${MOCK_USER_ID}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const data = await response.json();
      return data.conversations as Conversation[];
    }
  });

  // 更新对话标题
  const { mutate: updateConversation } = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const response = await apiRequest('PATCH', `/api/conversations/${id}`, { title });
      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: '已更新',
        description: '对话标题已更新',
      });
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新对话标题时出错',
        variant: 'destructive',
      });
    },
  });

  // 删除对话
  const { mutate: deleteConversation } = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/conversations/${id}`);
      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: '已删除',
        description: '对话已删除',
      });
      
      // 如果删除的是当前活动的对话，创建一个新对话
      if (selectedConversation?.id === activeConversationId) {
        onNewConversation();
      }
    },
    onError: (error) => {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除对话时出错',
        variant: 'destructive',
      });
    },
  });

  const handleEditClick = (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConversation(conversation);
    setTitle(conversation.title);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个对话吗？')) {
      deleteConversation(id);
    }
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedConversation && title.trim()) {
      updateConversation({ id: selectedConversation.id, title: title.trim() });
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, 'yyyy-MM-dd HH:mm');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold">对话列表</h2>
        <Button variant="outline" size="sm" onClick={onNewConversation}>
          <Plus className="h-4 w-4 mr-1" /> 新对话
        </Button>
      </div>

      {/* 编辑对话标题对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑对话标题</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入新标题"
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-4">加载中...</div>
      ) : data && data.length > 0 ? (
        <div className="space-y-2">
          {data.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center justify-between rounded-md px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                activeConversationId === conversation.id
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : ''
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-5 w-5 text-gray-500" />
                <div className="overflow-hidden">
                  <div className="font-medium truncate">{conversation.title}</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(conversation.timestamp)}
                  </div>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => handleEditClick(conversation, e)}
                  title="编辑"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500"
                  onClick={(e) => handleDeleteClick(conversation.id, e)}
                  title="删除"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p>没有对话记录</p>
          <p className="text-sm">点击"新对话"按钮开始</p>
        </div>
      )}
    </div>
  );
}