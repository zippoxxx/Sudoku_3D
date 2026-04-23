import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox, Float, Center } from '@react-three/drei';
import * as THREE from 'three';
import { SudokuGrid } from '../lib/sudoku';

interface CellProps {
  position: [number, number, number];
  value: number | null;
  notes: number[];
  isInitial: boolean;
  isSelected: boolean;
  isSameNumber: boolean;
  isRelated: boolean;
  hasError: boolean;
  onClick: () => void;
}

const Cell: React.FC<CellProps> = ({ 
  position, 
  value, 
  notes,
  isInitial, 
  isSelected, 
  isSameNumber,
  isRelated,
  hasError,
  onClick 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const prevValue = useRef(value);
  const popScaleRef = useRef(1);
  const successFlashRef = useRef(0);
  
  // Animation state (target values for lerp)
  const targetZ = isSelected ? 0.3 : 0;
  const targetScale = isSelected ? 1.05 : 1;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Decay popScaleRef and successFlashRef
    if (popScaleRef.current > 1) {
      popScaleRef.current = Math.max(1, popScaleRef.current - delta * 2.5);
    }
    if (successFlashRef.current > 0) {
      successFlashRef.current = Math.max(0, successFlashRef.current - delta * 2);
    }

    // Smooth lerp for position and internal scale
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, 0.15);
    
    const currentS = groupRef.current.scale.x;
    const targetS = targetScale * popScaleRef.current;
    const s = THREE.MathUtils.lerp(currentS, targetS, 0.2);
    groupRef.current.scale.set(s, s, s);

    // Dynamic emissive intensity animation
    if (materialRef.current) {
      let targetEmissive = 0;
      if (isSelected) targetEmissive = 0.5;
      else if (hasError) targetEmissive = 0.7;
      else if (isRelated) targetEmissive = 0.15;
      else if (isSameNumber && value !== null) targetEmissive = 0.3;
      
      // Combine state emissive with success flash spike
      const finalEmissive = Math.max(targetEmissive, successFlashRef.current);
      
      materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        materialRef.current.emissiveIntensity,
        finalEmissive,
        0.1
      );
    }
  });

  // Trigger pop when value changes
  React.useEffect(() => {
    if (value !== prevValue.current && value !== null) {
      popScaleRef.current = 1.4;
      if (!hasError) {
        successFlashRef.current = 2.0; // Strong flash for success
      }
    }
    prevValue.current = value;
  }, [value, hasError]);

  // Dynamic color logic
  let color = '#1e293b'; // Normal cell
  if (isSelected) color = '#334155';
  else if (hasError) color = '#ef4444';
  else if (isSameNumber && value !== null) color = '#334155';
  else if (isRelated) color = '#1e3a8a66'; 

  return (
    <group 
      ref={groupRef}
      position={[position[0], position[1], position[2]]} 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Background Glow for Related Cells */}
      {isRelated && !isSelected && !hasError && (
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[1.05, 1.05]} />
          <meshBasicMaterial 
            color="#0ea5e9" 
            transparent 
            opacity={0.08} 
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      <RoundedBox 
        args={[0.9, 0.9, 0.2]} 
        radius={0.05} 
        smoothness={4}
      >
        <meshStandardMaterial 
          ref={materialRef}
          color={color} 
          metalness={0.5} 
          roughness={0.8}
          emissive={isSelected ? '#0ea5e9' : hasError ? '#ef4444' : isRelated ? '#0ea5e9' : '#000000'}
          emissiveIntensity={0} 
        />
      </RoundedBox>
      
      {value !== null ? (
        <Text
          position={[0, 0, 0.13]}
          fontSize={0.6}
          color={isSelected ? '#7dd3fc' : isInitial ? '#ffffff' : '#cbd5e1'}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {value}
        </Text>
      ) : (
        notes.map((n) => {
          // Calculate grid position (3x3) for notes 1-9
          const row = Math.floor((n - 1) / 3);
          const col = (n - 1) % 3;
          const x = (col - 1) * 0.25;
          const y = -(row - 1) * 0.25;
          return (
            <Text
              key={n}
              position={[x, y, 0.14]}
              fontSize={0.24}
              color="#cbd5e1"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {n}
            </Text>
          );
        })
      )}
    </group>
  );
};

interface GridProps {
  grid: SudokuGrid;
  initialGrid: SudokuGrid;
  selection: [number, number] | null;
  solution: (number | null)[][];
  onCellClick: (row: number, col: number) => void;
}

export const ThreeSudokuGrid: React.FC<GridProps> = ({ 
  grid, 
  initialGrid, 
  selection, 
  solution,
  onCellClick 
}) => {
  const groupRef = useRef<THREE.Group>(null);

  if (!grid || !grid.length) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {grid.map((row, rIdx) => 
        row.map((cell, cIdx) => {
          const isSelected = selection?.[0] === rIdx && selection?.[1] === cIdx;
          const isInitial = initialGrid[rIdx][cIdx].value !== null;
          const currentVal = cell.value;
          const selectedVal = selection ? grid[selection[0]][selection[1]].value : null;
          
          const isSameNumber = selectedVal !== null && currentVal === selectedVal;
          const isRelated = selection !== null && (
            selection[0] === rIdx || 
            selection[1] === cIdx || 
            (Math.floor(selection[0]/3) === Math.floor(rIdx/3) && Math.floor(selection[1]/3) === Math.floor(cIdx/3))
          );
          
          const hasError = currentVal !== null && solution[rIdx] && currentVal !== solution[rIdx][cIdx];

          return (
            <Cell 
              key={`${rIdx}-${cIdx}`}
              position={[cIdx - 4, -(rIdx - 4), 0]}
              value={cell.value}
              notes={cell.notes}
              isInitial={isInitial}
              isSelected={isSelected}
              isSameNumber={isSameNumber}
              isRelated={isRelated}
              hasError={hasError}
              onClick={() => onCellClick(rIdx, cIdx)}
            />
          );
        })
      )}
      
      {/* Grid Lines (Dividers for 3x3 blocks) */}
      {[1, 2].map(i => (
        <group key={`divider-h-${i}`}>
          {/* Horizontal dividers */}
          <mesh position={[0, (i * 3 - 4.5), 0.12]}>
            <boxGeometry args={[9.2, 0.08, 0.05]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.5} transparent opacity={0.6} />
          </mesh>
          {/* Vertical dividers */}
          <mesh position={[(i * 3 - 4.5), 0, 0.12]}>
            <boxGeometry args={[0.08, 9.2, 0.05]} />
            <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.5} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Outer Border */}
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[9.3, 9.3, 0.02]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.8} />
      </mesh>
      
      {/* Subtle Subgrid Backgrounds */}
      {[0, 1, 2].map(i => [0, 1, 2].map(j => (
         <mesh key={`subgrid-bg-${i}-${j}`} position={[(j * 3) - 3, -((i * 3) - 3), -0.05]}>
            <planeGeometry args={[2.95, 2.95]} />
            <meshBasicMaterial color="#0ea5e9" transparent opacity={0.03} />
         </mesh>
      )))}
    </group>
  );
};
