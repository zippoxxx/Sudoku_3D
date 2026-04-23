/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Stars } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Timer, 
  Settings,
  Brain,
  ChevronRight,
  Flame,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  Save,
  Menu,
  X,
  LayoutGrid,
  Lock,
  LockOpen,
  Pause,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as THREE from 'three';

import { 
  SudokuGrid, 
  SudokuCell,
  Difficulty, 
  generatePuzzle, 
  checkWin 
} from './lib/sudoku';
import { playSuccessSound, playErrorSound } from './lib/sounds';
import { ThreeSudokuGrid } from './components/ThreeSudokuGrid';
import { getAiHint, HintResponse } from './services/geminiService';

export default function App() {
  const [grid, setGrid] = useState<SudokuGrid>([]);
  const [initialGrid, setInitialGrid] = useState<SudokuGrid>([]);
  const [solution, setSolution] = useState<(number | null)[][]>([]);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [seconds, setSeconds] = useState(0);
  const [errors, setErrors] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [hasUsedExtraLife, setHasUsedExtraLife] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiHintData, setAiHintData] = useState<HintResponse | null>(null);
  const [winCountdown, setWinCountdown] = useState<number | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Constants
  const AUTOSAVE_KEY = 'sudoku_3d_autosave_v1';
  const ERROR_LIMITS: Record<Difficulty, number> = {
    easy: 3,
    medium: 3,
    hard: 4,
    expert: 5
  };
  const HINT_LIMITS: Record<Difficulty, number> = {
    easy: 2,
    medium: 2,
    hard: 2,
    expert: 3
  };

  // Initialize game
  const startNewGame = useCallback((diff: Difficulty = difficulty) => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      const { puzzle, solution: sol } = generatePuzzle(diff);
      setGrid(puzzle);
      setInitialGrid(puzzle.map(r => r.map(c => ({ ...c }))));
      setSolution(sol);
      setSelection(null);
      setGameStatus('playing');
      setSeconds(0);
      setErrors(0);
      setDifficulty(diff);
      setGameId(prev => prev + 1);
      setIsNoteMode(false);
      setHasUsedExtraLife(false);
      setAiHintData(null);
      setIsAiLoading(false);
      setWinCountdown(null);
      setHintsUsed(0);
      setIsMobileMenuOpen(false);
      setIsLocked(false);
      setIsPaused(false);
    } catch (err) {
      console.error("Sudoku Generation failed:", err);
    }
  }, [difficulty]);

  const continueWithExtraLife = () => {
    setErrors(ERROR_LIMITS[difficulty] - 1);
    setHasUsedExtraLife(true);
    setGameStatus('playing');
  };

  const handleRequestHint = async () => {
    if (gameStatus !== 'playing' || isAiLoading) return;
    if (hintsUsed >= HINT_LIMITS[difficulty]) return;

    setIsAiLoading(true);
    setAiHintData(null);

    const hint = await getAiHint(grid, solution, selection);
    
    if (hint) {
      setHintsUsed(prev => prev + 1);
      setSelection([hint.row, hint.col]);
      setAiHintData(hint);
      
      // Auto fill the hint value
      const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
      newGrid[hint.row][hint.col].value = hint.value;
      newGrid[hint.row][hint.col].notes = [];
      setGrid(newGrid);
      playSuccessSound();
      
      if (checkWin(newGrid, solution)) {
        setGameStatus('won');
        setWinCountdown(10);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00ffff', '#ffffff', '#00ffee']
        });
      }
    }
    
    setIsAiLoading(false);
  };

  useEffect(() => {
    const savedGame = localStorage.getItem(AUTOSAVE_KEY);
    if (savedGame) {
      try {
        const parsed = JSON.parse(savedGame);
        setGrid(parsed.grid);
        setInitialGrid(parsed.initialGrid);
        setSolution(parsed.solution);
        setDifficulty(parsed.difficulty);
        setErrors(parsed.errors);
        setSeconds(parsed.seconds);
        setHasUsedExtraLife(parsed.hasUsedExtraLife || false);
        setHintsUsed(parsed.hintsUsed || 0);
        setGameStatus('playing');
        setIsResuming(true);
        setTimeout(() => setIsResuming(false), 3000);
      } catch (e) {
        console.error("Failed to load saved game", e);
        startNewGame();
      }
    } else {
      startNewGame();
    }
  }, []);

  // Autosave Logic
  useEffect(() => {
    if (gameStatus === 'playing' && grid.length > 0) {
      const saveData = {
        grid,
        initialGrid,
        solution,
        difficulty,
        errors,
        seconds,
        hasUsedExtraLife,
        hintsUsed,
        timestamp: Date.now()
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saveData));
    }
  }, [grid, errors, seconds, gameStatus, difficulty, initialGrid, solution, hasUsedExtraLife]);

  // Win Countdown Logic
  useEffect(() => {
    if (gameStatus !== 'won' || winCountdown === null) return;
    if (winCountdown <= 0) {
      startNewGame();
      return;
    }
    const timer = setTimeout(() => setWinCountdown(winCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [gameStatus, winCountdown, startNewGame]);

  // Timer logic
  useEffect(() => {
    if (gameStatus !== 'playing' || isPaused) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [gameStatus, isPaused]);

  const handleInput = (num: number | null) => {
    if (!selection || gameStatus !== 'playing' || isPaused) return;
    const [r, c] = selection;
    if (initialGrid[r][c].value !== null) return; // Can't change initial numbers

    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
    const targetCell = newGrid[r][c];

    if (isNoteMode && num !== null) {
      // Clear value if present to allow notes to be visible
      targetCell.value = null;
      
      // Toggle note
      if (targetCell.notes.includes(num)) {
        targetCell.notes = targetCell.notes.filter(n => n !== num);
      } else {
        targetCell.notes = [...targetCell.notes, num].sort();
      }
    } else {
      // Direct value input
      if (num !== null) {
        if (num === solution[r][c]) {
          playSuccessSound();
        } else {
          playErrorSound();
          const newErrorCount = errors + 1;
          setErrors(newErrorCount);
          if (newErrorCount >= ERROR_LIMITS[difficulty]) {
            setGameStatus('lost');
          }
        }
      }
      targetCell.value = num;
      targetCell.notes = []; // Clear notes when setting definitive value
    }

    setGrid(newGrid);

    if (checkWin(newGrid, solution)) {
      setGameStatus('won');
      setWinCountdown(10);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffff', '#ffffff', '#00ffee']
      });
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') handleInput(parseInt(e.key));
      if (e.key === 'Backspace' || e.key === 'Delete') handleInput(null);
      if (e.key.toLowerCase() === 'n') setIsNoteMode(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, grid, initialGrid, solution, gameStatus, isNoteMode]);

  return (
    <div className="relative w-full h-screen bg-[#020617] text-white overflow-hidden font-sans select-none flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-[#1e293b] bg-[#0f172a]/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#38bdf8] flex items-center justify-center shadow-lg shadow-sky-500/20">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-[#F8FAFC]">SUDOKU 3D</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-[#1e293b] text-[#94a3b8]"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="relative flex-1 flex flex-col h-full min-h-0 order-2 md:order-1 overflow-hidden">
        <div className="flex-1 relative min-h-0">
          <div className={`flex-1 h-full transition-all duration-500 ${isPaused ? 'blur-2xl scale-95 opacity-50' : 'blur-0 scale-100 opacity-100'}`}>
            <Canvas shadows gl={{ antialias: true, stencil: false, depth: true }} dpr={[1, 2]}>
            <PerspectiveCamera makeDefault position={[5, 4, 11]} fov={50} />
            <ambientLight intensity={2.2} />
            <spotLight position={[10, 15, 10]} angle={0.25} penumbra={1} intensity={3.5} castShadow />
            <pointLight position={[-10, 5, -10]} intensity={1.5} />
            <Environment preset="city" />
            
            <AnimatePresence>
              {grid.length > 0 && (
                <ThreeSudokuGrid 
                  key={gameId}
                  grid={grid} 
                  initialGrid={initialGrid} 
                  selection={selection} 
                  solution={solution}
                  onCellClick={(r, c) => setSelection([r, c])}
                />
              )}
            </AnimatePresence>
            
            <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
            <ContactShadows position={[0, -6, 0]} opacity={0.3} scale={20} blur={2} far={4.5} />
            <OrbitControls 
              enabled={!isLocked}
              enablePan={false} 
              minDistance={8} 
              maxDistance={20} 
              autoRotate={gameStatus === 'won'} 
              autoRotateSpeed={4}
              makeDefault
            />
          </Canvas>
        </div>

          {/* Mobile Floating Stats */}
          <div className="md:hidden absolute top-4 left-4 right-4 flex justify-between gap-2 z-10 pointer-events-none">
            <div className="bg-[#0f172a]/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
              <Timer className="w-3 h-3 text-[#0ea5e9]" />
              <span className="text-[10px] font-mono text-white/80">{formatTime(seconds)}</span>
            </div>
            <div className="bg-[#0f172a]/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
              <Flame className={`w-3 h-3 ${errors > 0 ? 'text-red-500' : 'text-[#0ea5e9]'}`} />
              <span className={`text-[10px] font-mono ${errors > 0 ? 'text-red-500' : 'text-white/80'}`}>{errors}/{ERROR_LIMITS[difficulty]}</span>
            </div>
          </div>

          {/* Board Actions (Lock & Pause) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {/* Lock Button */}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsLocked(!isLocked)}
              className={`p-2.5 rounded-xl border transition-all shadow-xl flex items-center gap-2 ${
                isLocked 
                  ? 'bg-[#0ea5e9] border-[#0ea5e9] text-white shadow-sky-500/40' 
                  : 'bg-[#0f172a]/80 border-white/10 text-white/40 backdrop-blur-xl'
              }`}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:inline">
                {isLocked ? 'Fixo' : 'Livre'}
              </span>
            </motion.button>

            {/* Pause Button */}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsPaused(!isPaused)}
              className={`p-2.5 rounded-xl border transition-all shadow-xl flex items-center gap-2 ${
                isPaused 
                  ? 'bg-purple-500 border-purple-500 text-white shadow-purple-500/40' 
                  : 'bg-[#0f172a]/80 border-white/10 text-white/40 backdrop-blur-xl'
              }`}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:inline">
                {isPaused ? 'Resumir' : 'Pausar'}
              </span>
            </motion.button>
          </div>

          {grid.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/80 backdrop-blur-sm z-50">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-12 h-12 border-4 border-[#0ea5e9]/30 border-t-[#0ea5e9] rounded-full"
              />
            </div>
          )}
        </div>

        {/* Mobile Controls (Below Board) */}
        <div className="md:hidden bg-[#0f172a] border-t border-[#1e293b] p-4 pb-8 flex flex-col gap-4 z-20">
          <div className="grid grid-cols-5 gap-2 items-center">
            <div className="col-span-3 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleInput(num)}
                  className="aspect-square flex items-center justify-center text-sm font-bold bg-[#1e293b] border border-[#334155] rounded-lg active:bg-[#0ea5e9] transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleInput(null)}
                className="aspect-square flex items-center justify-center bg-[#1e293b] border border-red-500/30 text-red-500 rounded-lg active:bg-red-500 active:text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="col-span-2 flex flex-col gap-2">
              <button
                 onClick={() => setIsNoteMode(prev => !prev)}
                 className={`py-2 px-3 flex items-center justify-center gap-2 rounded-lg font-bold transition-all border text-[10px] ${
                   isNoteMode 
                     ? 'bg-[#0ea5e9] text-white border-[#0ea5e9]' 
                     : 'bg-[#1e293b] border-[#334155] text-[#94a3b8]'
                 }`}
              >
                <Brain className="w-3 h-3" />
                NOTAS
              </button>
              <button
                 onClick={handleRequestHint}
                 disabled={isAiLoading || hintsUsed >= HINT_LIMITS[difficulty]}
                 className="py-2 px-3 flex items-center justify-center gap-2 rounded-lg font-bold transition-all border border-purple-500/30 bg-purple-500/10 text-purple-400 disabled:opacity-30 text-[10px]"
              >
                <Sparkles className="w-3 h-3" />
                DICA ({HINT_LIMITS[difficulty] - hintsUsed})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* UI Overlays */}
      
      {/* Pause Overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]/80 backdrop-blur-md"
          >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="text-center"
             >
                <div className="w-24 h-24 bg-purple-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 relative">
                   <Pause className="w-10 h-10 text-purple-400" />
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-0 border-2 border-dashed border-purple-500/30 rounded-[2.5rem]" 
                   />
                </div>
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Sinal <span className="text-purple-400">Pausado</span></h2>
                <p className="text-[#64748b] mb-10 text-sm max-w-xs mx-auto">O tempo parou. O sistema está aguardando seu comando de retorno.</p>
                
                <button 
                  onClick={() => setIsPaused(false)}
                  className="px-10 py-4 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-500/30 active:scale-95 flex items-center gap-3 mx-auto"
                >
                  <Play className="w-5 h-5 fill-current" />
                  RETOMAR MISSÃO
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Left Sidebar (Stats & Nav) */}
      <AnimatePresence>
        {(isMobileMenuOpen || window.innerWidth >= 768) && (
          <motion.div 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`fixed inset-y-0 left-0 w-72 md:relative md:w-64 border-r border-[#1e293b] p-6 flex flex-col gap-4 md:gap-8 z-40 bg-[#0f172a]/95 backdrop-blur-xl md:bg-[#0f172a]/50 md:backdrop-blur-sm order-1 overflow-y-auto scrollbar-hide ${!isMobileMenuOpen ? 'hidden md:flex' : 'flex'}`}
          >
            {/* Mobile Sidebar Header */}
            <div className="md:hidden flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#0ea5e9]">Configurações</h2>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg bg-[#1e293b] text-[#94a3b8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="hidden md:block">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h1 className="text-3xl font-extrabold tracking-tight mb-1 bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] bg-clip-text text-transparent">
                  SUDOKU 3D
                </h1>
                <p className="text-xs text-[#64748b]">Voxel Engine v1.1.0</p>
              </motion.div>
            </div>

            <div className="flex flex-col gap-3 md:gap-5">
              <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5">
                <div className="stat-label mb-1">Dificuldade</div>
                <div className="stat-value capitalize text-lg text-white">{difficulty}</div>
              </div>
              
              <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5">
                <div className="stat-label mb-1 text-[#0ea5e9]">Tempo de Sessão</div>
                <div className="stat-value font-mono text-xl text-white">{formatTime(seconds)}</div>
              </div>

              <div className="bg-[#1e293b]/30 p-4 rounded-2xl border border-white/5">
                <div className="stat-label mb-1">Integridade do Sinal</div>
                <div className={`stat-value font-mono text-xl ${errors > 0 ? 'text-red-400' : 'text-[#38bdf8]'}`}>
                  {errors}/{ERROR_LIMITS[difficulty]}
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <div className="text-[10px] uppercase tracking-widest text-[#64748b] px-1">Seletor de Nível</div>
              <div className="flex flex-col gap-2">
                {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      startNewGame(d);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full py-2.5 px-4 text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all border text-left flex items-center justify-between group ${
                      difficulty === d 
                        ? 'bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-lg shadow-sky-500/20' 
                        : 'bg-[#1e293b] text-[#64748b] border-[#334155] hover:border-[#64748b] hover:text-[#94a3b8]'
                    }`}
                  >
                    <span>{d}</span>
                    {difficulty === d && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => {
                  startNewGame();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 mt-4 active:scale-95"
              >
                Resetar Partida
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Sidebar / Controls (Numeric Pad) - Desktop Only Overlay logic removed to prevent clash */}
      <div className="hidden md:flex flex-col w-64 border-l border-[#1e293b] p-6 gap-6 z-40 bg-[#0f172a]/50 backdrop-blur-sm order-3">
        <div>
          <div className="stat-label mb-4 text-[#64748b] flex items-center gap-2">
            <LayoutGrid className="w-3 h-3" />
            Painel Numérico
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <motion.button
                key={num}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleInput(num)}
                className="aspect-square flex items-center justify-center text-lg font-bold bg-[#1e293b] border border-[#334155] rounded-xl hover:border-[#0ea5e9] hover:text-[#0ea5e9] hover:bg-[#0ea5e9]/10 transition-all active:bg-[#0ea5e9] active:text-white"
              >
                {num}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="stat-label text-[#64748b]">Comandos Rápidos</div>
          <div className="flex flex-col gap-2.5">
            <button
               onClick={() => setIsNoteMode(prev => !prev)}
               className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl font-bold transition-all border ${
                 isNoteMode 
                   ? 'bg-[#0ea5e9] text-white border-[#0ea5e9] shadow-lg shadow-sky-500/30' 
                   : 'bg-[#1e293b] border-[#334155] text-[#94a3b8] hover:bg-[#1e293b]/60'
               }`}
            >
              <Brain className={`w-4 h-4 ${isNoteMode ? 'animate-pulse' : ''}`} />
              NOTAS (N)
            </button>

            <button
               onClick={() => handleInput(null)}
               className="w-full py-3 bg-[#1e293b] border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/5 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpar
            </button>

            <button
               onClick={handleRequestHint}
               disabled={isAiLoading || hintsUsed >= HINT_LIMITS[difficulty]}
               className="w-full py-4 flex flex-col items-center justify-center rounded-xl font-bold transition-all border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <div className="flex items-center gap-2 py-0.5">
                <Sparkles className={`w-4 h-4 ${isAiLoading ? 'animate-spin' : 'group-hover:animate-pulse'}`} />
                <span className="text-xs uppercase tracking-widest">{isAiLoading ? "Analisando..." : "Assistência IA"}</span>
                <span className="text-[10px] bg-purple-500/20 px-1.5 rounded-md border border-purple-500/20">{HINT_LIMITS[difficulty] - hintsUsed}</span>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-purple-500/40" style={{ width: `${((HINT_LIMITS[difficulty] - hintsUsed) / HINT_LIMITS[difficulty]) * 100}%` }} />
            </button>
          </div>
        </div>
        
        <div className="mt-auto">
          <div className="glass-panel p-4 rounded-xl border-white/5 text-[10px] text-[#475569] leading-relaxed">
             <p className="mb-2">DICA: Use o mouse para rotacionar o cubo. Clique nas células para selecionar.</p>
          </div>
        </div>
      </div>

      {/* Overlay for Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Win Modal Overlay */}
      <AnimatePresence>
        {gameStatus === 'won' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md px-6"
          >
             <motion.div 
               initial={{ scale: 0.8, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="glass-panel max-w-md w-full p-10 rounded-[3rem] text-center border-[#0ea5e9]/30 shadow-[0_0_50px_rgba(14,165,233,0.2)]"
             >
                <div className="w-20 h-20 bg-[#0ea5e9]/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                   <Trophy className="w-10 h-10 text-[#0ea5e9]" />
                </div>
                <h2 className="text-4xl font-bold mb-2 uppercase tracking-tighter">Missão <span className="text-[#0ea5e9]">Cumprida</span></h2>
                <p className="text-white/60 mb-8 text-sm">Puzzle decodificado em {formatTime(seconds)} com {errors} interrupções de sinal.</p>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="bg-white/5 p-4 rounded-3xl">
                      <p className="text-[10px] uppercase text-white/30 mb-1">Tempo</p>
                      <p className="text-xl font-mono">{formatTime(seconds)}</p>
                   </div>
                   <div className="bg-white/5 p-4 rounded-3xl">
                      <p className="text-[10px] uppercase text-white/30 mb-1">Erros</p>
                      <p className="text-xl font-mono">{errors}</p>
                   </div>
                </div>

                <button 
                  onClick={() => startNewGame()}
                  className="w-full py-4 bg-[#0ea5e9] hover:bg-[#38bdf8] text-white font-bold rounded-2xl transition-all flex flex-col items-center justify-center gap-1 group shadow-lg shadow-sky-500/20 active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    NOVA SESSÃO
                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </div>
                  {winCountdown !== null && (
                    <span className="text-[10px] text-white/50 font-medium">Iniciando automaticamente em {winCountdown}s</span>
                  )}
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiHintData && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-6"
          >
            <div className="glass-panel p-6 rounded-3xl border-purple-500/30 bg-purple-900/20 backdrop-blur-xl shadow-[0_0_40px_rgba(168,85,247,0.2)]">
              <div className="flex items-start gap-4">
                 <div className="bg-purple-500/20 p-2 rounded-xl">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                       <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Dica da IA Mestra</h3>
                       <button onClick={() => setAiHintData(null)} className="text-white/20 hover:text-white transition-colors">
                          <Plus className="w-4 h-4 rotate-45" />
                       </button>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed italic border-l-2 border-purple-500/30 pl-4 py-1">
                      "{aiHintData.explanation}"
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                       <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-mono">
                          CEL: [{aiHintData.row + 1},{aiHintData.col + 1}]
                       </span>
                       <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                          VAL: {aiHintData.value}
                       </span>
                    </div>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal Overlay */}
      <AnimatePresence>
        {gameStatus === 'lost' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-6"
          >
             {!hasUsedExtraLife ? (
               <motion.div 
                 initial={{ scale: 0.8, y: 30 }}
                 animate={{ scale: 1, y: 0 }}
                 className="glass-panel max-w-md w-full p-10 rounded-[3rem] text-center border-[#0ea5e9]/30 shadow-[0_0_60px_rgba(14,165,233,0.3)] bg-[#0f172a]/90"
               >
                  <div className="w-20 h-20 bg-[#0ea5e9]/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                     <Plus className="w-10 h-10 text-[#0ea5e9] animate-bounce" />
                  </div>
                  <h2 className="text-4xl font-bold mb-2 uppercase tracking-tighter text-white font-sans">Ops! <span className="text-[#0ea5e9]">{ERROR_LIMITS[difficulty]} Erros</span> cometidos</h2>
                  <p className="text-white/60 mb-8 text-sm">Você quer uma segunda chance para continuar este desafio?</p>
                  
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={continueWithExtraLife}
                      className="w-full py-4 bg-[#0ea5e9] hover:bg-[#38bdf8] text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-95"
                    >
                      <RotateCcw className="w-5 h-5" />
                      CONTINUAR
                    </button>
                  </div>
               </motion.div>
             ) : (
               <motion.div 
                 initial={{ scale: 0.8, y: 30 }}
                 animate={{ scale: 1, y: 0 }}
                 className="glass-panel max-w-md w-full p-10 rounded-[3rem] text-center border-red-500/30 shadow-[0_0_60px_rgba(239,68,68,0.2)] bg-[#0f172a]/90"
               >
                  <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                     <XCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <h2 className="text-4xl font-bold mb-2 uppercase tracking-tighter text-white font-sans">Sinal <span className="text-red-500 text-shadow-glow">Encerrado</span></h2>
                  <p className="text-white/60 mb-8 text-sm">Infelizmente você esgotou suas vidas, mais sorte na próxima vez!</p>
                  
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => startNewGame()}
                      className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                    >
                      <Plus className="w-5 h-5" />
                      NOVO JOGO
                    </button>
                  </div>
               </motion.div>
             )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* Autosave Toast */}
      <AnimatePresence>
        {isResuming && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-10 left-1/2 z-50 pointer-events-none"
          >
            <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-3 border-[#0ea5e9]/30 bg-sky-500/10 shadow-[0_0_20px_rgba(14,165,233,0.2)]">
              <Save className="w-4 h-4 text-[#0ea5e9]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#0ea5e9]">Jogo Restaurado</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[-1]">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-900/10 via-black to-blue-900/10" />
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-cyan-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
