import { useEffect, useState } from "react";
import MessageHistory from "./MessageHistory";
import MessageInput from "./MessageInput";
import McpToolSelector from "./McpToolSelector";
import { useChat } from "@/hooks/use-chat";
import Sidebar from "@/components/sidebar/Sidebar";

interface ChatContainerProps {
  initialConversationId?: number;
  initialSystemPromptId?: number;
}

export default function ChatContainer({
  initialConversationId,
  initialSystemPromptId
}: ChatContainerProps) {
  const [selectedSystemPromptId, setSelectedSystemPromptId] = useState<number | undefined>(initialSystemPromptId);
  const [useMcpTools, setUseMcpTools] = useState(false);
  
  const {
    messages,
    conversations,
    activeConversationId,
    isLoading,
    inputValue,
    setInputValue,
    handleSendMessage,
    selectConversation,
    startNewConversation
  } = useChat({
    conversationId: initialConversationId,
    systemPromptId: selectedSystemPromptId,
    useMcpTools
  });

  // 获取当前会话的标题
  const getActiveConversationTitle = () => {
    if (!activeConversationId || !conversations) return "新对话";
    const activeConversation = conversations.find(conv => conv.id === activeConversationId);
    return activeConversation?.title || "新对话";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar 
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={startNewConversation}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center px-4">
          <h1 className="text-lg font-medium">{getActiveConversationTitle()}</h1>
        </header>
        
        <MessageHistory 
          messages={messages} 
          isLoading={isLoading} 
        />
        
        <div className="px-4">
          {activeConversationId && (
            <McpToolSelector
              conversationId={activeConversationId}
              onToolsEnabled={setUseMcpTools}
            />
          )}
        </div>
        
        <MessageInput 
          value={inputValue} 
          onChange={setInputValue} 
          onSend={handleSendMessage} 
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
