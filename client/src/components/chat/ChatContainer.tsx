import MessageHistory from "./MessageHistory";
import MessageInput from "./MessageInput";
import { useChat } from "@/hooks/use-chat";

export default function ChatContainer() {
  const {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    handleSendMessage,
  } = useChat();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <MessageHistory 
        messages={messages} 
        isLoading={isLoading} 
      />
      <MessageInput 
        value={inputValue} 
        onChange={setInputValue} 
        onSend={handleSendMessage} 
        isLoading={isLoading}
      />
    </div>
  );
}
