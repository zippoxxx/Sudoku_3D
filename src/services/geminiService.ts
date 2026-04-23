import { GoogleGenAI, Type } from "@google/genai";
import { SudokuGrid } from "../lib/sudoku";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

export interface HintResponse {
  row: number;
  col: number;
  value: number;
  explanation: string;
}

export async function getAiHint(
  grid: SudokuGrid, 
  solution: (number | null)[][],
  selectedCoord: [number, number] | null
): Promise<HintResponse | null> {
  // If no cell selected, find a random empty one
  let r: number, c: number;
  if (selectedCoord && grid[selectedCoord[0]][selectedCoord[1]].value === null) {
    [r, c] = selectedCoord;
  } else {
    // Find all empty cells
    const emptyCells: [number, number][] = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (grid[i][j].value === null) {
          emptyCells.push([i, j]);
        }
      }
    }
    if (emptyCells.length === 0) return null;
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    [r, c] = randomCell;
  }

  const correctValue = solution[r][c];
  if (correctValue === null) return null;

  // Convert grid to a simple string representation for the AI
  const gridStr = grid.map(row => row.map(cell => cell.value || 0).join(" ")).join("\n");

  const prompt = `
    You are a Sudoku Master Assistant. 
    Current Grid State (0 is empty):
    ${gridStr}

    The player needs a hint for the cell at Row ${r + 1}, Column ${c + 1} (0-indexed as ${r}, ${c}).
    The correct value for this cell is ${correctValue}.

    INSTRUCTIONS:
    1. Respond STRICTLY in Brazilian Portuguese (Português do Brasil).
    2. Provide a VERY BRIEF, single-sentence tip or a tiny helpful clue for the cell. 
    3. Maximum 15 words.
    4. Do not over-explain. Just a quick nudge.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: "A short, helpful explanation of the hint."
            }
          },
          required: ["explanation"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    return {
      row: r,
      col: c,
      value: correctValue,
      explanation: result.explanation || `Dica: O número ${correctValue} é a escolha lógica para esta posição.`
    };
  } catch (error) {
    console.error("AI Hint Error:", error);
    return {
      row: r,
      col: c,
      value: correctValue,
      explanation: "O sistema de IA está processando... Mas aqui está o número correto para você continuar!"
    };
  }
}
