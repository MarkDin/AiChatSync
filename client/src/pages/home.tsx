import ChatContainer from "@/components/chat/ChatContainer";
import { MessageSquare } from "lucide-react";
import ThemeToggle from "@/components/ui/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-8 h-8 text-accent dark:text-dark-accent" />
          <h1 className="text-xl font-semibold">AI Chat</h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Chat container */}
      <ChatContainer />
    </div>
  );
}
