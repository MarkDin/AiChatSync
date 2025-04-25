import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConversationList from './ConversationList';
import SystemPrompts from './SystemPrompts';
import ThemeToggle from '@/components/ui/theme-toggle';

interface SidebarProps {
  activeConversationId?: number;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
}

export default function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`relative h-full border-r transition-all duration-300 bg-gray-50 dark:bg-gray-900 ${
        isCollapsed ? 'w-16' : 'w-80'
      }`}
    >
      {/* 折叠按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-[-12px] top-5 h-6 w-6 rounded-full p-0 z-10 bg-white dark:bg-gray-800 shadow-md"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {isCollapsed ? (
        // 折叠状态
        <div className="flex flex-col items-center pt-14 pb-4 h-full">
          <Button
            variant="ghost"
            size="icon"
            className="mb-4"
            onClick={() => setIsCollapsed(false)}
            title="对话列表"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="mb-4"
            onClick={() => setIsCollapsed(false)}
            title="系统提示"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <div className="mt-auto">
            <ThemeToggle />
          </div>
        </div>
      ) : (
        // 展开状态
        <div className="flex flex-col h-full p-4">
          <Tabs defaultValue="conversations" className="flex-1">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="conversations">
                <MessageSquare className="h-4 w-4 mr-2" />
                对话
              </TabsTrigger>
              <TabsTrigger value="system-prompts">
                <Settings className="h-4 w-4 mr-2" />
                系统提示
              </TabsTrigger>
            </TabsList>
            <TabsContent value="conversations" className="overflow-y-auto h-[calc(100vh-160px)]">
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={onSelectConversation}
                onNewConversation={onNewConversation}
              />
            </TabsContent>
            <TabsContent value="system-prompts" className="overflow-y-auto h-[calc(100vh-160px)]">
              <SystemPrompts />
            </TabsContent>
          </Tabs>
          <div className="mt-auto pt-2 flex justify-between items-center border-t">
            <div className="text-sm text-muted-foreground">AI聊天应用</div>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}