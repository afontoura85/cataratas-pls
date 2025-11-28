import React, { useState, useEffect } from 'react';
import { ServiceSubItem, HousingUnit } from '../types';
import { CloseIcon, CheckCircleIcon } from './Icons';

interface ProgressUpdateModalProps {
  item: ServiceSubItem;
  housingUnits: HousingUnit[];
  initialProgress: number[];
  onUpdate: (itemId: string, newProgress: number[]) => void;
  onClose: () => void;
}

export const ProgressUpdateModal: React.FC<ProgressUpdateModalProps> = ({ item, housingUnits, initialProgress, onUpdate, onClose }) => {
  const [progress, setProgress] = useState<number[]>(initialProgress);
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [bulkValue, setBulkValue] = useState(100);
  const units = housingUnits.length;

  useEffect(() => {
    // Ensure progress array has the correct length, padding with 0 if necessary
    const currentProgress = Array.from({ length: units }, (_, i) => initialProgress[i] || 0);
    setProgress(currentProgress);
  }, [initialProgress, units]);

  const toggleUnitSelection = (unitIndex: number) => {
    setSelectedUnits(prev =>
      prev.includes(unitIndex) ? prev.filter(i => i !== unitIndex) : [...prev, unitIndex]
    );
  };

  const handleSelectAll = () => {
    setSelectedUnits(Array.from({ length: units }, (_, i) => i));
  };
  
  const handleClearSelection = () => {
    setSelectedUnits([]);
  };

  const applyValueToSelected = (value: number) => {
    if (selectedUnits.length === 0) {
        return;
    }
    const newProgress = [...progress];
    selectedUnits.forEach(index => {
        newProgress[index] = value;
    });
    setProgress(newProgress);
  };

  const handleApplyBulkValue = () => {
    applyValueToSelected(bulkValue);
  };

  const handleUnitProgressChange = (unitIndex: number, value: number) => {
    const newProgress = [...progress];
    const clampedValue = Math.max(0, Math.min(100, value));
    newProgress[unitIndex] = Math.round(clampedValue);
    setProgress(newProgress);
  }

  const handleSave = () => {
    onUpdate(item.id, progress);
  };

  const handleBarMouseDown = (
    downEvent: React.MouseEvent<HTMLDivElement>,
    unitIndex: number
  ) => {
    downEvent.preventDefault();
    downEvent.stopPropagation();

    const bar = downEvent.currentTarget;
    const rect = bar.getBoundingClientRect();

    const updateProgressFromEvent = (moveEvent: MouseEvent) => {
        const offsetX = moveEvent.clientX - rect.left;
        const newPercentage = (offsetX / rect.width) * 100;
        handleUnitProgressChange(unitIndex, newPercentage);
    };

    updateProgressFromEvent(downEvent.nativeEvent);

    const handleMouseMove = (moveEvent: MouseEvent) => {
        updateProgressFromEvent(moveEvent);
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Editar Progresso</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{item.id} - {item.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <CloseIcon />
          </button>
        </header>

        <main className="p-6 overflow-y-auto">
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border dark:border-slate-200 dark:border-slate-600">
            <h3 className="text-base font-semibold mb-3 text-slate-800 dark:text-slate-100">Ações em Lote</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-full sm:w-auto flex-1">
                <label htmlFor="bulk-progress" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Definir progresso (%)</label>
                <div className="flex items-center gap-2">
                    <input type="range" min="0" max="100" value={bulkValue} onChange={e => setBulkValue(Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer"/>
                    <input type="number" min="0" max="100" id="bulk-progress" value={bulkValue} onChange={e => setBulkValue(Number(e.target.value))} className="w-20 p-2 border dark:border-slate-500 rounded-md text-center bg-white dark:bg-slate-800"/>
                </div>
              </div>
              <button onClick={handleApplyBulkValue} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold self-stretch sm:self-end">
                Aplicar
              </button>
            </div>
             <div className="flex items-center gap-2 flex-wrap mt-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">Ajustes rápidos:</span>
                {[0, 25, 50, 75, 100].map(val => (
                    <button key={val} onClick={() => { setBulkValue(val); applyValueToSelected(val); }} className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-full font-semibold">
                        {val}%
                    </button>
                ))}
            </div>
            <div className="flex gap-4 mt-4 text-sm font-medium">
                <button onClick={handleSelectAll} className="text-blue-600 dark:text-blue-400 hover:underline">Selecionar Todos</button>
                <button onClick={handleClearSelection} className="text-blue-600 dark:text-blue-400 hover:underline">Limpar Seleção</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            {housingUnits.map((unit, i) => {
              const isSelected = selectedUnits.includes(i);
              const progressValue = progress[i] === undefined ? 0 : progress[i];

              return (
              <div
                key={unit.id}
                onClick={() => toggleUnitSelection(i)}
                className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all text-center flex flex-col justify-between h-32 ${
                    isSelected 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 shadow-lg' 
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                {isSelected && (
                    <div className="absolute top-1 right-1 text-blue-500">
                        <CheckCircleIcon className="h-6 w-6" />
                    </div>
                )}
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{unit.name}</span>
                 <div 
                    className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 my-1 cursor-ew-resize touch-none"
                    onMouseDown={(e) => handleBarMouseDown(e, i)}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="bg-blue-600 h-2 rounded-full pointer-events-none"
                        style={{ width: `${progressValue}%` }}
                    ></div>
                </div>
                <div className="relative">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={progressValue}
                        onChange={(e) => handleUnitProgressChange(i, parseInt(e.target.value, 10) || 0)}
                        onClick={e => e.stopPropagation()}
                        className="w-full p-1 pr-6 border-0 rounded-md text-center text-xl font-bold bg-transparent text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700 appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute inset-y-0 right-2 flex items-center text-xl font-bold text-slate-400 dark:text-slate-500 pointer-events-none">%</span>
                </div>
              </div>
            )})}
          </div>
        </main>
        
        <footer className="flex justify-end gap-4 p-4 border-t bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
          <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold">
            Salvar Alterações
          </button>
        </footer>
      </div>
    </div>
  );
};