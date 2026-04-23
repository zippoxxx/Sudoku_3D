/**
 * Sudoku Prism 3D Logic Utility
 * Uses a robust shuffling algorithm for guaranteed fast valid board generation.
 */

export type SudokuCell = {
  value: number | null;
  notes: number[];
};
export type SudokuGrid = SudokuCell[][];
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Checks if the board is completely and correctly filled.
 */
export function checkWin(grid: SudokuGrid, solution: (number | null)[][]): boolean {
  if (!grid.length || !solution.length) return false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c].value !== solution[r][c]) return false;
    }
  }
  return true;
}

/**
 * Generates a full completed board by shuffling a base valid board.
 * Shuffling preserves Sudoku validity.
 */
export function generateFullBoard(): (number | null)[][] {
  // Start with a valid base board (diagonal shift pattern)
  const grid: number[][] = Array(9).fill(0).map((_, r) => 
    Array(9).fill(0).map((_, c) => 
      ((r * 3 + Math.floor(r / 3) + c) % 9) + 1
    )
  );

  // Shuffle digits (1-9)
  const digitMap = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
  for(let r=0; r<9; r++) {
    for(let c=0; c<9; c++) {
      grid[r][c] = digitMap[grid[r][c] - 1];
    }
  }

  // Shuffle rows within blocks
  for (let i = 0; i < 9; i += 3) {
    const rows = [i, i + 1, i + 2].sort(() => Math.random() - 0.5);
    const original = [...grid.map(row => [...row])];
    grid[i] = original[rows[0]];
    grid[i+1] = original[rows[1]];
    grid[i+2] = original[rows[2]];
  }

  // Shuffle columns within blocks
  for (let i = 0; i < 9; i += 3) {
    const cols = [i, i + 1, i + 2].sort(() => Math.random() - 0.5);
    for(let r=0; r<9; r++) {
      const originalRow = [...grid[r]];
      grid[r][i] = originalRow[cols[0]];
      grid[r][i+1] = originalRow[cols[1]];
      grid[r][i+2] = originalRow[cols[2]];
    }
  }

  return grid;
}

/**
 * Creates a puzzle by removing numbers from a full board.
 */
export function generatePuzzle(difficulty: Difficulty): { puzzle: SudokuGrid, solution: (number | null)[][] } {
  const solution = generateFullBoard();
  const puzzle: SudokuGrid = solution.map(row => 
    row.map(val => ({ value: val, notes: [] }))
  );
  
  const counts = {
    easy: 35,
    medium: 45,
    hard: 55,
    expert: 64
  };
  
  const targetEmpties = counts[difficulty];
  let removed = 0;

  while (removed < targetEmpties) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c].value !== null) {
      puzzle[r][c].value = null;
      removed++;
    }
  }
  
  return { puzzle, solution };
}
