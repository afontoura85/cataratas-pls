/**
 * @file Componente `PlsTable` que renderiza a matriz principal de progresso dos serviços.
 * É o coração da interface de visualização de dados, permitindo a edição em linha do progresso
 * para cada serviço em cada unidade, além de filtrar os serviços exibidos.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ServiceCategory, ProgressMatrix, ServiceSubItem, HousingUnit, CategoryFinancials } from '../types';
import { EditIcon, SearchIcon, ChatBubbleIcon, ChevronRightIcon, ChevronDownIcon } from './Icons';

/**
 * @typedef {object} PlsTableProps
 * @property {ServiceCategory[]} plsData - Os dados estruturados da PLS.
 * @property {HousingUnit[]} housingUnits - A lista de unidades habitacionais.
 * @property {ProgressMatrix} progress - A matriz de progresso atual.
 * @property {(item: ServiceSubItem) => void} onEditItem - Callback para abrir o modal de edição em lote.
 * @property {(itemId: string, unitIndex: number, newProgress: number) => void} onUpdateSingleProgress - Callback para atualizar o progresso de uma única célula.
 * @property {(categoryId: string, itemId: string, newName: string) => void} onUpdateItemName - Callback para atualizar o nome de um item de serviço.
 * @property {CategoryFinancials[]} categoryFinancials - Dados financeiros calculados por categoria.
 * @property {() => void} onOpenTextAssistant - Callback para abrir o assistente de texto.
 */
interface PlsTableProps {
  plsData: ServiceCategory[];
  housingUnits: HousingUnit[];
  progress: ProgressMatrix;
  onEditItem: (item: ServiceSubItem) => void;
  onUpdateSingleProgress: (itemId: string, unitIndex: number, newProgress: number) => void;
  onUpdateItemName: (categoryId: string, itemId: string, newName: string) => void;
  categoryFinancials: CategoryFinancials[];
  onOpenTextAssistant: () => void;
}

/**
 * Componente auxiliar para destacar uma substring dentro de um texto.
 * Usado para dar feedback visual nos resultados da busca na tabela.
 * @param {object} props - Propriedades do componente.
 * @param {string} props.text - O texto completo.
 * @param {string} props.highlight - A substring a ser destacada.
 * @returns {React.ReactElement} O texto com a parte destacada.
 */
const Highlight: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <>{text}</>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/50 rounded-sm px-0.5 py-0">
                        {part}
                    </mark>
                ) : (
                    part
                )
            )}
        </>
    );
};

/**
 * Componente para edição de um valor numérico diretamente na célula da tabela.
 * Aparece quando o usuário clica em uma célula de progresso.
 * @param {object} props - Propriedades do componente.
 * @param {number} props.value - O valor inicial a ser editado.
 * @param {(newValue: number) => void} props.onSave - Callback chamado ao salvar (onBlur, onEnter).
 * @param {() => void} props.onCancel - Callback chamado ao cancelar (onEscape).
 * @returns {React.ReactElement} O campo de input para edição.
 */
const InlineEditInput: React.FC<{
    value: number;
    onSave: (newValue: number) => void;
    onCancel: () => void;
}> = ({ value, onSave, onCancel }) => {
    const [currentValue, setCurrentValue] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSave = () => {
        const newValue = parseInt(currentValue, 10);
        if (!isNaN(newValue) && newValue >= 0 && newValue <= 100) {
            onSave(newValue);
        } else {
            onCancel(); 
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <input
            ref={inputRef}
            type="number"
            min="0"
            max="100"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full p-2 text-center bg-yellow-50 dark:bg-slate-900 border-2 border-blue-500 rounded-none outline-none box-border"
        />
    );
};


/**
 * O principal componente de tabela para exibir e interagir com a PLS (Planilha de Levantamento de Serviços - PLS).
 * Ele mostra uma visão em matriz de todos os serviços e seu progresso em cada unidade.
 * Suporta busca para filtrar os serviços e edição em linha para atualizações rápidas.
 * @param {PlsTableProps} props As propriedades do componente.
 * @returns {React.ReactElement} A tabela de PLS renderizada.
 */
export const PlsTable: React.FC<PlsTableProps> = ({ plsData, housingUnits, progress, onEditItem, onOpenTextAssistant, onUpdateSingleProgress }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ itemId: string, unitIndex: number } | null>(null);

  const filteredPlsData = useMemo(() => {
    if (!searchQuery.trim()) {
      return plsData;
    }

    const lowercasedQuery = searchQuery.toLowerCase();
    
    return plsData.map(category => {
      if (category.name.toLowerCase().includes(lowercasedQuery)) {
        return category;
      }
      
      const matchingSubItems = category.subItems.filter(item => 
        item.name.toLowerCase().includes(lowercasedQuery) ||
        item.id.toLowerCase().includes(lowercasedQuery)
      );

      if (matchingSubItems.length > 0) {
        return { ...category, subItems: matchingSubItems };
      }

      return null;
    }).filter((category): category is ServiceCategory => category !== null);

  }, [plsData, searchQuery]);

  const serviceItems = useMemo(() => {
      return filteredPlsData.flatMap(cat => cat.subItems);
  }, [filteredPlsData]);

  return (
    <>
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-md border dark:border-slate-700">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
              <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                      type="text"
                      placeholder="Buscar serviço por ID ou nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-700/80 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-amber-500 focus:ring-amber-500 rounded-md transition-colors"
                  />
              </div>
              <div className="flex-shrink-0 px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 rounded-md font-semibold text-sm">
                Legenda X = Concluído
              </div>
          </div>
          
          <div className="overflow-auto relative border dark:border-slate-700 rounded-lg" style={{ maxHeight: '70vh' }}>
            <table className="w-full border-collapse text-sm text-center bg-white dark:bg-slate-800">
                <thead className="z-20">
                  <tr className="bg-slate-100 dark:bg-slate-700">
                      <th rowSpan={2} className="sticky top-0 left-0 z-30 bg-slate-100 dark:bg-slate-700 p-2 border-b border-r dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200">Serviço</th>
                      <th colSpan={housingUnits.length} className="p-1 border-b dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200">Casa</th>
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-700">
                    {housingUnits.map((unit, index) => {
                      const unitNumber = index + 1;
                       let finalTop: string;
                       let finalBottom: string;
                       if (unitNumber % 10 === 0) {
                           finalTop = String(unitNumber / 10 -1); // 10 -> 0, 20 -> 1
                           finalBottom = '0';
                       } else {
                           finalTop = String(Math.floor(unitNumber / 10));
                           finalBottom = String(unitNumber % 10);
                       }
                      return (
                        <th key={unit.id} className="sticky top-0 z-10 p-1 min-w-[3rem] border-b dark:border-slate-600 font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700">
                          <div className="-space-y-1">
                            <div>{finalTop}</div>
                            <div className="font-bold">{finalBottom}</div>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {serviceItems.length > 0 ? serviceItems.map(item => {
                    const progressRow = progress[item.id] || [];
                    return (
                      <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="sticky left-0 p-2 border-b border-r dark:border-slate-600 text-left whitespace-nowrap bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50 z-10">
                          <span className="text-slate-500 dark:text-slate-400 mr-2 font-mono">{item.id}</span>
                          <button 
                            onClick={() => onEditItem(item)} 
                            className="font-medium text-slate-800 dark:text-slate-200 text-left hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm"
                            title={`Edição em lote para "${item.name}"`}
                          >
                            <Highlight text={item.name} highlight={searchQuery} />
                          </button>
                        </td>
                        {housingUnits.map((unit, unitIndex) => {
                          const unitProgress = progressRow[unitIndex] ?? 0;
                          const isEditing = editingCell?.itemId === item.id && editingCell.unitIndex === unitIndex;
                          
                          return (
                            <td 
                              key={unit.id}
                              className="p-0 border-b dark:border-slate-600 cursor-pointer font-mono"
                              onClick={() => {
                                  if (!isEditing) {
                                      setEditingCell({ itemId: item.id, unitIndex });
                                  }
                              }}
                              title={`Editar ${item.name} para ${unit.name}`}
                            >
                              {isEditing ? (
                                <InlineEditInput
                                    value={unitProgress}
                                    onSave={(newValue) => {
                                        onUpdateSingleProgress(item.id, unitIndex, newValue);
                                        setEditingCell(null);
                                    }}
                                    onCancel={() => setEditingCell(null)}
                                />
                               ) : (
                                <div
                                  className={`w-full h-full p-2 flex items-center justify-center font-semibold ${
                                    unitProgress === 100
                                      ? 'bg-emerald-500 text-white'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {unitProgress === 100 ? 'X' : unitProgress}
                                </div>
                               )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }) : (
                      <tr>
                          <td colSpan={housingUnits.length + 1} className="text-center py-16">
                                <p className="font-semibold text-slate-700 dark:text-slate-200">Nenhum resultado encontrado</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tente ajustar seus termos de pesquisa.</p>
                          </td>
                      </tr>
                  )}
                </tbody>
            </table>
          </div>

      </div>
      <div className="fixed bottom-8 right-8 z-30">
          <button
              onClick={onOpenTextAssistant}
              className="bg-blue-500 hover:bg-blue-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-transform transform hover:scale-110"
              aria-label="Abrir Assistente de Texto"
              title="Assistente de Texto"
          >
              <ChatBubbleIcon className="w-8 h-8" />
          </button>
      </div>
    </>
  );
};
