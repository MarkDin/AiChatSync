import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaAutosizeProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxRows?: number;
}

const TextareaAutosize = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
  ({ className, maxRows = 5, onChange, value, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const combinedRef = (node: HTMLTextAreaElement) => {
      textareaRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    // Function to resize textarea
    const resizeTextarea = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = 'auto';
      
      // Calculate maxHeight based on maxRows
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
      const maxHeight = lineHeight * maxRows;
      
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    };

    // Resize when value changes
    useEffect(() => {
      resizeTextarea();
    }, [value]);

    // Handle changes and resize
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) onChange(e);
      resizeTextarea();
    };

    return (
      <textarea
        ref={combinedRef}
        className={cn(
          "resize-none overflow-y-auto", 
          className
        )}
        onChange={handleChange}
        value={value}
        {...props}
      />
    );
  }
);

TextareaAutosize.displayName = "TextareaAutosize";

export default TextareaAutosize;
