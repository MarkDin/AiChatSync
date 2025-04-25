import { useEffect, useRef } from "react";
import { Message } from "@shared/schema";
import { MessageSquare, User } from "lucide-react";
import LoadingDots from "@/components/ui/loading-dots";
import ReactMarkdown from "react-markdown";

interface MessageHistoryProps {
  messages: Message[];
  isLoading: boolean;
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
