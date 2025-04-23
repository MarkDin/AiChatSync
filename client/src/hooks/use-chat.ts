import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Message, chatCompletionSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date(),
    } as Message,
  ]);
  const [inputValue, setInputValue] = useState("");
  const { toast } = useToast();

  // Mutation for sending messages to the API
  const { mutate, isPending } = useMutation({
    mutationFn: async (content: string) => {
      const userMessage: Message = {
        id: messages.length + 1,
        role: "user",
        content,
        timestamp: new Date(),
      } as Message;

      // Add user message to state immediately
      setMessages((prevMessages) => [...prevMessages, userMessage]);

      // Validate the message
      const validatedData = chatCompletionSchema.parse({ message: content });

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
      } as Message;

      setMessages((prevMessages) => [...prevMessages, aiMessage]);
      setInputValue("");
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
    isLoading: isPending,
    inputValue,
    setInputValue,
    handleSendMessage,
  };
}
