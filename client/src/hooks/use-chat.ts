import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Message, chatCompletionSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

// Mock user ID for demo purposes
// In a real app, this would come from authentication
const MOCK_USER_ID = 1;

export function useChat() {
  const [inputValue, setInputValue] = useState("");
  const { toast } = useToast();

  // Query to fetch messages from the database
  const { data, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/messages', MOCK_USER_ID],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/messages?userId=${MOCK_USER_ID}`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      return data.messages as Message[];
    }
  });

  // Local messages state management
  const [messages, setMessages] = useState<Message[]>([]);

  // Update messages when data is fetched
  useEffect(() => {
    if (data && data.length > 0) {
      setMessages(data);
    } else {
      // Default welcome message if no messages exist
      setMessages([{
        id: 1,
        role: "assistant",
        content: "Hello! I'm your AI assistant. How can I help you today?",
        timestamp: new Date(),
        userId: MOCK_USER_ID
      } as Message]);
    }
  }, [data]);

  // Mutation for sending messages to the API
  const { mutate, isPending } = useMutation({
    mutationFn: async (content: string) => {
      const userMessage: Message = {
        id: messages.length + 1,
        role: "user",
        content,
        timestamp: new Date(),
        userId: MOCK_USER_ID
      } as Message;

      // Add user message to state immediately
      setMessages((prevMessages) => [...prevMessages, userMessage]);

      // Validate the message
      const validatedData = chatCompletionSchema.parse({ 
        message: content,
        userId: MOCK_USER_ID
      });

      // Send request to API
      const response = await apiRequest("POST", "/api/chat", validatedData);
      
      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      return await response.json() as { content: string };
    },
    onSuccess: (data) => {
      // Add AI response to state
      const aiMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
        userId: MOCK_USER_ID
      } as Message;

      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setInputValue("");
      
      // Invalidate messages query to refresh from database
      queryClient.invalidateQueries({ queryKey: ['/api/messages', MOCK_USER_ID] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || isPending) return;
    mutate(inputValue.trim());
  };

  return {
    messages,
    isLoading: isPending || isLoadingMessages,
    inputValue,
    setInputValue,
    handleSendMessage,
  };
}
