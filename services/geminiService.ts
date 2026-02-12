import { GoogleGenAI } from "@google/genai";
import { CLINICAL_SYSTEM_INSTRUCTION } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const startChat = () => {
  return ai.chats.create({
    model: "gemini-3-pro-preview",
    config: {
      systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
  });
};

export const parseJsonFromText = (text: string) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse JSON from model output", e);
  }
  return null;
};
