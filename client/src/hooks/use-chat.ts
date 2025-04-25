import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Message, SystemPrompt, Conversation, chatCompletionSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

// Mock user ID for demo purposes
// In a real app, this would come from authentication
const MOCK_USER_ID = 1;

interface UseChatOptions {
  conversationId?: number;
  systemPromptId?: number;
}

export function useChat({ conversationId, systemPromptId }: UseChatOptions = {}) {
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>(conversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false);
  const { toast } = useToast();

  // Query to fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ['/api/conversations'],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/conversations?userId=${MOCK_USER_ID}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      const data = await response.json();
      return data.conversations as Conversation[];
    }
  });

  // Select first conversation if none is active and conversations exist
  useEffect(() => {
    if (!activeConversationId && conversations && conversations.length > 0 && !isCreatingNewConversation) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations, isCreatingNewConversation]);

  // Query to fetch messages for the active conversation
  const { 
    data: conversationMessages, 
    isLoading: isLoadingMessages,
    refetch: refetchMessages
  } = useQuery({
    queryKey: ['/api/messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      
      const response = await apiRequest("GET", `/api/messages?conversationId=${activeConversationId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      return data.messages as Message[];
    },
    enabled: !!activeConversationId, // Only run query if we have a conversation ID
  });

  // Update messages when conversation messages are fetched
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      setMessages(conversationMessages);
    } else if (activeConversationId) {
      // Empty welcome message if no messages exist in this conversation
      setMessages([{
        id: 0,
        role: "assistant",
        content: "您好！我是AI助手。请问有什么我可以帮助您的吗？",
        timestamp: new Date(),
        userId: MOCK_USER_ID,
        conversationId: activeConversationId
      } as Message]);
    } else {
      // Default state with no active conversation
      setMessages([{
        id: 0,
        role: "assistant",
        content: "您好！我是AI助手。请问有什么我可以帮助您的吗？",
        timestamp: new Date(),
        userId: MOCK_USER_ID
      } as Message]);
    }
  }, [conversationMessages, activeConversationId]);

  // Create a new conversation
  const { mutate: createConversation } = useMutation({
    mutationFn: async (title: string = "新对话") => {
      const response = await apiRequest("POST", "/api/conversations", {
        title,
        userId: MOCK_USER_ID,
        systemPromptId
      });
      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      const newConversationId = data.conversation.id;
      setActiveConversationId(newConversationId);
      setIsCreatingNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: "对话已创建",
        description: "新对话已创建，现在可以开始聊天了"
      });
    },
    onError: (error) => {
      toast({
        title: "创建对话失败",
        description: error instanceof Error ? error.message : "创建新对话时出错",
        variant: "destructive",
      });
    }
  });

  const startNewConversation = () => {
    setIsCreatingNewConversation(true);
    setActiveConversationId(undefined);
    setMessages([{
      id: 0,
      role: "assistant",
      content: "您好！我是AI助手。请问有什么我可以帮助您的吗？",
      timestamp: new Date(),
      userId: MOCK_USER_ID
    } as Message]);
    
    // First message will create a new conversation
  };

  // Mutation for sending messages to the API
  const { mutate, isPending } = useMutation({
    mutationFn: async (content: string) => {
      const userMessage: Message = {
        id: messages.length + 1,
        role: "user",
        content,
        timestamp: new Date(),
        userId: MOCK_USER_ID,
        conversationId: activeConversationId
      } as Message;

      // Add user message to state immediately
      setMessages((prevMessages) => [...prevMessages, userMessage]);

      // Validate the message
      const validatedData = chatCompletionSchema.parse({ 
        message: content,
        conversationId: activeConversationId,
        systemPromptId,
        userId: MOCK_USER_ID
      });

      // Send request to API
      const response = await apiRequest("POST", "/api/chat", validatedData);
      
      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      return await response.json() as { content: string, conversationId: number };
    },
    onSuccess: (data) => {
      // If this was the first message in a new conversation, update the active conversation ID
      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId);
        setIsCreatingNewConversation(false);
        
        // Refresh conversations list to include the new one
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      }
      
      // Add AI response to state
      const aiMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
        userId: MOCK_USER_ID,
        conversationId: data.conversationId || activeConversationId
      } as Message;

      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setInputValue("");
      
      // Invalidate messages query to refresh from database
      if (activeConversationId || data.conversationId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/messages', activeConversationId || data.conversationId] 
        });
      }
    },
    onError: (error) => {
      // Remove the last user message on error
      setMessages((prevMessages) => prevMessages.slice(0, -1));
      
      toast({
        title: "发送消息失败",
        description: error instanceof Error ? error.message : "发送消息时出错",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || isPending) return;
    
    // If we're creating a new conversation with the first message, use the message as the title
    if (!activeConversationId && isCreatingNewConversation) {
      // The API will create a conversation for us
    } 
    
    mutate(inputValue.trim());
  };

  const selectConversation = (id: number) => {
    if (id !== activeConversationId) {
      setActiveConversationId(id);
      setIsCreatingNewConversation(false);
      queryClient.invalidateQueries({ queryKey: ['/api/messages', id] });
    }
  };

  return {
    messages,
    conversations,
    activeConversationId,
    isLoading: isPending || isLoadingMessages,
    inputValue,
    setInputValue,
    handleSendMessage,
    selectConversation,
    startNewConversation
  };
}
