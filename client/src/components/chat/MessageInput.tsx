import { FormEvent } from "react";
import { Send } from "lucide-react";
import TextareaAutosize from "@/components/ui/textarea-autosize";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export default function MessageInput({ 
  value, 
  onChange, 
  onSend, 
  isLoading 
}: MessageInputProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;
    onSend();
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="flex-1 relative">
            <TextareaAutosize
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-dark-accent bg-white dark:bg-gray-800 text-text-primary dark:text-white resize-none overflow-hidden min-h-[56px] max-h-[200px]"
              maxRows={5}
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit" 
            className="p-3 rounded-lg bg-accent hover:bg-blue-600 dark:bg-dark-accent dark:hover:bg-blue-600 text-white"
            disabled={isLoading || !value.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          AI responses are generated via Supabase Edge Functions.
        </p>
      </div>
    </div>
  );
}
