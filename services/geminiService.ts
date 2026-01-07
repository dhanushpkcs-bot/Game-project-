
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function generateCommentary(
  shot: number,
  aiChoice: number,
  isWicket: boolean,
  outcome: string,
  runs: number,
  isFreeHit: boolean
): Promise<string> {
  const prompt = `
    Act as a live cricket commentator. Generate a short (max 15 words) exciting commentary for a specific ball.
    Context:
    - Shot chosen by batsman: ${shot}
    - AI logic value: ${aiChoice}
    - Is it a wicket? ${isWicket ? 'Yes' : 'No'}
    - Outcome: ${outcome}
    - Runs scored: ${runs}
    - Is it a free hit? ${isFreeHit ? 'Yes' : 'No'}
    Make it sound authentic like Richie Benaud or Harsha Bhogle.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 50,
      }
    });
    return response.text?.trim() || "What a delivery!";
  } catch (error) {
    console.error("Commentary generation failed", error);
    return "The crowd is roaring!";
  }
}

export async function generateResultSummary(
  p1Score: number,
  p1Wickets: number,
  p2Score: number,
  p2Wickets: number,
  winner: string
): Promise<string> {
  const prompt = `
    Summarize a cricket match result in 20 words.
    Final Scores:
    Player 1: ${p1Score}/${p1Wickets}
    Player 2: ${p2Score}/${p2Wickets}
    Winner: ${winner}
    Make it punchy.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "What a match!";
  } catch (error) {
    return `Final Result: ${winner} wins.`;
  }
}
