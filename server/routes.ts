import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { chatCompletionSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat completion API endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      // Validate request body
      const { message } = chatCompletionSchema.parse(req.body);
      
      // In a real app, we would call the Supabase Edge Function here
      // For this demo, we'll return a simulated AI response
      
      // Simulate API processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate response based on user's message
      let aiResponse = "";
      
      if (message.toLowerCase().includes("hello") || message.toLowerCase().includes("hi")) {
        aiResponse = "Hello! How can I assist you today?";
      } else if (message.toLowerCase().includes("machine learning")) {
        aiResponse = "Machine learning is a branch of artificial intelligence that focuses on building systems that learn from data. Instead of being explicitly programmed, these systems identify patterns and make decisions with minimal human intervention.\n\nThe basic process involves:\n1. Data collection and preparation\n2. Choosing a model (algorithm)\n3. Training the model with data\n4. Evaluating and improving performance\n5. Making predictions on new data\n\nWould you like me to explain any specific aspect of machine learning in more detail?";
      } else if (message.toLowerCase().includes("types of machine learning")) {
        aiResponse = "There are three main types of machine learning:\n\n1. **Supervised Learning**: The algorithm learns from labeled training data, making predictions or decisions based on that learning. Examples include classification and regression.\n\n2. **Unsupervised Learning**: The algorithm finds patterns and relationships in unlabeled data. Examples include clustering, association, and dimensionality reduction.\n\n3. **Reinforcement Learning**: The algorithm learns through trial and error, receiving rewards or penalties for actions it takes. It's commonly used in gaming, robotics, and navigation.\n\nThere's also semi-supervised learning (using both labeled and unlabeled data) and transfer learning (applying knowledge from one task to another).";
      } else {
        aiResponse = "I understand your message. In a production environment, this would connect to Supabase Edge Functions to generate a more specific and helpful response.";
      }

      // Return the AI response
      res.json({ content: aiResponse });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Chat API error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
