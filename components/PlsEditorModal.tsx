import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PlsCategoryTemplate, PlsSubItemTemplate } from '../types';
import { CloseIcon, PlusIcon, TrashIcon, TableCellsIcon } from './Icons';

interface PlsEditorModalProps {
  initialPlsData: PlsCategoryTemplate[];
  onSave: (newPlsData: PlsCategoryTemplate[]) => void;
  onClose: () => void;
}

// Helper component for inline editing
const EditableField: React.FC<{
  value: string | number;
  onSave: (value: string | number) => void;
  type?: 'text' | 'number';
  className?: string;
  placeholder?: string;
}> = ({ value, onSave, type = 'text', className = '', placeholder = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleSave = () => {
    setIsEditing(false);
    if (currentValue.trim() === '') {
        setCurrentValue(String(value));
        return;
    }
    if (currentValue !== String(value)) {
      if (type === 'number') {
        onSave(parseFloat(currentValue) || 0);
      } else {
        onSave(currentValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(String(value));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        step={type === 'number' ? "0.01" : undefined}
        className={`p-1 border border-blue-500 rounded-md bg-white dark:bg-slate-700 text-sm ring-1 ring-blue-500 outline-none ${className}`}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer text-sm truncate ${className}`}
      title="Clique para editar"
    >
      {type === 'number' ? Number(value).toFixed(2) : value}
    </div>
  );
};


const CategoryEditor: React.FC<{
    category: PlsCategoryTemplate;
    categoryIndex: number;
    onCategoryChange: (index: number, field: 'name' | 'id', value: string) => void;
    onItemChange: (catIndex: number, itemIndex: number, field: 'name' | 'id' | 'incidence' | 'unit', value: string | number) => void;
    onAddItem: (catIndex: number) => void;
    onRemoveItem: (catIndex: number, itemIndex: number) => void;
    onRemoveCategory: (catIndex: number) => void;
    totalIncidence: number;
}> = ({ category, categoryIndex, onCategoryChange, onItemChange, onAddItem, onRemoveItem, onRemoveCategory, totalIncidence }) => {
    return (
        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="flex items-start gap-4 mb-3">
                <div className="flex-grow">
                     <EditableField
                        value={category.name}
                        onSave={(v) => onCategoryChange(categoryIndex, 'name', String(v))}
                        className="text-lg font-bold w-full !p-2"
                        placeholder="Nome da Etapa"
                    />
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="font-bold text-blue-600 dark:text-blue-400">{totalIncidence.toFixed(2)}%</p>
                    <p className="text-xs text-slate-500">Total da Etapa</p>
                </div>
                <button onClick={() => onRemoveCategory(categoryIndex)} className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-full">
                    <TrashIcon />
                </button>
            </div>

            <div className="space-y-1 pl-4 border-l-2 dark:border-slate-600">
                {category.subItems.map((item, itemIndex) => (
                    <div key={`${item.id}-${itemIndex}`} className="group flex items-center gap-2 -ml-1 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50">
                        <EditableField
                            value={item.id}
                            onSave={v => onItemChange(categoryIndex, itemIndex, 'id', String(v))}
                            placeholder="ID"
                            className="w-20"
                        />
                        <EditableField
                            value={item.name}
                            onSave={v => onItemChange(categoryIndex, itemIndex, 'name', String(v))}
                            placeholder="Nome do Serviço"
                            className="flex-grow"
                        />
                         <EditableField
                            value={item.unit}
                            onSave={v => onItemChange(categoryIndex, itemIndex, 'unit', String(v))}
                            placeholder="Unid."
                            className="w-20"
                        />
                        <EditableField
                            value={item.incidence}
                            onSave={v => onItemChange(categoryIndex, itemIndex, 'incidence', Number(v))}
                            placeholder="%"
                            type="number"
                            className="w-24 text-right"
                        />
                         <button onClick={() => onRemoveItem(categoryIndex, itemIndex)} className="p-2 text-slate-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
            </div>
            <button onClick={() => onAddItem(categoryIndex)} className="mt-3 ml-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
                <PlusIcon />
                Adicionar Serviço
            </button>
        </div>
    );
};


export const PlsEditorModal: React.FC<PlsEditorModalProps> = ({ initialPlsData, onSave, onClose }) => {
    const [editedPls, setEditedPls] = useState<PlsCategoryTemplate[]>(() => JSON.parse(JSON.stringify(initialPlsData)));

    const handleCategoryChange = (index: number, field: 'name' | 'id', value: string) => {
        const newPls = [...editedPls];
        newPls[index] = { ...newPls[index], [field]: value };
        setEditedPls(newPls);
    };

    const handleItemChange = (catIndex: number, itemIndex: number, field: 'name' | 'id' | 'incidence' | 'unit', value: string | number) => {
        const newPls = [...editedPls];
        const category = newPls[catIndex];
        const newItems = [...category.subItems];
        
        // Update the item
        const updatedItem = { ...newItems[itemIndex], [field]: value };
        newItems[itemIndex] = updatedItem;

        // If ID changed, sort the items numerically and lexicographically
        if (field === 'id') {
            newItems.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
        }

        newPls[catIndex] = { ...category, subItems: newItems };
        setEditedPls(newPls);
    };

    const handleAddCategory = () => {
        const newCategory: PlsCategoryTemplate = {
            id: String(editedPls.length + 1),
            name: 'Nova Etapa',
            subItems: [],
        };
        setEditedPls([...editedPls, newCategory]);
    };

    const handleRemoveCategory = (index: number) => {
        if (window.confirm(`Tem certeza que deseja remover a etapa "${editedPls[index].name}" e todos os seus serviços?`)) {
            setEditedPls(editedPls.filter((_, i) => i !== index));
        }
    };

    const handleAddItem = (catIndex: number) => {
        const category = editedPls[catIndex];
        const newItem: PlsSubItemTemplate = {
            id: `${category.id}.${category.subItems.length + 1}`,
            name: 'Novo Serviço',
            incidence: 0,
            unit: 'un',
        };
        const newPls = [...editedPls];
        newPls[catIndex] = { ...newPls[catIndex], subItems: [...newPls[catIndex].subItems, newItem] };
        setEditedPls(newPls);
    };

    const handleRemoveItem = (catIndex: number, itemIndex: number) => {
        const newPls = [...editedPls];
        const newItems = newPls[catIndex].subItems.filter((_, i) => i !== itemIndex);
        newPls[catIndex] = { ...newPls[catIndex], subItems: newItems };
        setEditedPls(newPls);
    };

    const calculatedTotals = useMemo(() => {
        const categoryTotals = editedPls.map(cat => cat.subItems.reduce((sum, item) => sum + item.incidence, 0));
        const projectTotal = categoryTotals.reduce((sum, total) => sum + total, 0);
        return { categoryTotals, projectTotal };
    }, [editedPls]);

    const totalColorClass = () => {
        const total = calculatedTotals.projectTotal;
        if (total > 99.9 && total < 100.1) return 'text-emerald-600 dark:text-emerald-400';
        if (total > 95 && total < 105) return 'text-amber-600 dark:text-amber-400';
        return 'text-rose-600 dark:text-rose-400';
    }


    const handleSaveChanges = () => {
        // Simple validation
        if (calculatedTotals.projectTotal < 99.9 || calculatedTotals.projectTotal > 100.1) {
            if (!window.confirm(`O total das incidências (${calculatedTotals.projectTotal.toFixed(2)}%) não está em 100%. Deseja salvar mesmo assim?`)) {
                return;
            }
        }
        onSave(editedPls);
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700">
                           <TableCellsIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                                Editor da PLS
                            </h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                                Adicione, remova e edite as etapas e serviços do projeto.
                            </p>
                        </div>
                    </div>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <main className="flex-grow p-6 overflow-y-auto">
                    <div className="space-y-4">
                        {editedPls.map((cat, index) => (
                            <CategoryEditor
                                key={cat.id + index}
                                category={cat}
                                categoryIndex={index}
                                onCategoryChange={handleCategoryChange}
                                onItemChange={handleItemChange}
                                onAddItem={handleAddItem}
                                onRemoveItem={handleRemoveItem}
                                onRemoveCategory={handleRemoveCategory}
                                totalIncidence={calculatedTotals.categoryTotals[index]}
                            />
                        ))}
                    </div>
                    <button onClick={handleAddCategory} className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all duration-200 font-semibold">
                        <PlusIcon />
                        Adicionar Etapa
                    </button>
                </main>

                <footer className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-between items-center">
                    <div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total do Projeto: </span>
                        <span className={`text-lg font-bold ${totalColorClass()}`}>
                            {calculatedTotals.projectTotal.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600">
                            Cancelar
                        </button>
                        <button type="button" onClick={handleSaveChanges} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                            Salvar Alterações na PLS
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
