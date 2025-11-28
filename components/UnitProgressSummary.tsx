/**
 * @file Componente `UnitProgressSummary` que exibe uma lista de todas as unidades habitacionais
 * e seu progresso geral ponderado. Permite expandir cada unidade para ver os serviços em
 * andamento e oferece uma ação para exportar um relatório detalhado daquela unidade.
 */
import React, { useState, useMemo } from 'react';
import { Project, ServiceCategory, UnitFinancials, HousingUnit } from '../types';
import { TableCellsIcon, DocumentArrowDownIcon, ChevronDownIcon, ChevronRightIcon } from './Icons';

/**
 * @typedef {object} UnitProgressSummaryProps
 * @property {Project} project - O objeto do projeto ativo.
 * @property {ServiceCategory[]} plsData - A estrutura de serviços calculada da PLS.
 * @property {(unit: HousingUnit) => void} onExportUnit - Callback para acionar a exportação de um relatório para uma unidade específica.
 */
interface UnitProgressSummaryProps {
    project: Project;
    plsData: ServiceCategory[];
    onExportUnit: (unit: HousingUnit) => void;
}

/**
 * Renderiza um painel recolhível que resume o progresso de cada unidade habitacional.
 * Cada unidade exibe seu progresso total e pode ser expandida para mostrar detalhes.
 * @param {UnitProgressSummaryProps} props As propriedades do componente.
 * @returns {React.ReactElement} O componente de resumo de progresso por unidade.
 */
export const UnitProgressSummary: React.FC<UnitProgressSummaryProps> = ({ project, plsData, onExportUnit }) => {
    const [isCollapsed, setIsCollapsed] = useState(true); // Começa recolhido por padrão
    const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

    const unitFinancials = useMemo((): UnitFinancials[] => {
        if (!project) return [];
        
        const { housing_units, progress } = project;
        
        return housing_units.map((unit, unitIndex) => {
            let totalWeightedProgress = 0;
            
            plsData.forEach(category => {
                category.subItems.forEach(item => {
                    const itemProgressArray = progress[item.id] || [];
                    const unitProgress = itemProgressArray[unitIndex] || 0;
                    
                    totalWeightedProgress += (unitProgress / 100) * item.incidence;
                });
            });
            
            return {
                id: unit.id,
                name: unit.name,
                progress: totalWeightedProgress,
            };
        });
    }, [project, plsData]);

    const getProgressedItemsForUnit = (unitId: string) => {
        const unitIndex = project.housing_units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return [];

        const progressedItems: { id: string; name: string; progress: number }[] = [];

        plsData.forEach(category => {
            category.subItems.forEach(item => {
                const itemProgress = project.progress[item.id]?.[unitIndex] || 0;
                if (itemProgress > 0) {
                    progressedItems.push({
                        id: item.id,
                        name: item.name,
                        progress: itemProgress,
                    });
                }
            });
        });
        return progressedItems;
    };

    const handleToggleUnit = (unitId: string) => {
        setExpandedUnitId(prevId => (prevId === unitId ? null : unitId));
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-lg">
            <button 
                className="w-full flex justify-between items-center text-left"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-expanded={!isCollapsed}
            >
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <TableCellsIcon />
                    Progresso por Unidades
                </h2>
                {isCollapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
            </button>

            {!isCollapsed && (
                <div className="mt-4 space-y-2">
                    {unitFinancials.map(unit => {
                         const isExpanded = expandedUnitId === unit.id;
                        return (
                        <div key={unit.id} className="p-3 rounded-md bg-slate-50 dark:bg-slate-700/50 border dark:border-slate-600 transition-all duration-300">
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="flex-grow w-full cursor-pointer" onClick={() => handleToggleUnit(unit.id)}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                            {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                            {unit.name}
                                        </span>
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">{unit.progress.toFixed(2)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${unit.progress}%` }}></div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onExportUnit({ id: unit.id, name: unit.name })}
                                    className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold"
                                    aria-label={`Exportar progresso para ${unit.name}`}
                                >
                                   <DocumentArrowDownIcon />
                                   <span className="sm:hidden">Exportar Relatório da Unidade</span>
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="mt-3 pt-3 border-t dark:border-slate-600 pl-2 sm:pl-4">
                                    <h4 className="text-sm font-semibold mb-2 text-slate-600 dark:text-slate-300">Itens com progresso:</h4>
                                    {(() => {
                                        const progressedItems = getProgressedItemsForUnit(unit.id);
                                        if (progressedItems.length === 0) {
                                            return <p className="text-xs text-slate-500 italic">Nenhum serviço progrediu nesta unidade ainda.</p>
                                        }
                                        return (
                                            <ul className="space-y-1 text-xs list-disc list-inside">
                                                {progressedItems.map(item => (
                                                    <li key={item.id} className="text-slate-600 dark:text-slate-400">
                                                        {item.name}: <span className="font-semibold text-slate-800 dark:text-slate-200">{item.progress}%</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            )}
             {!isCollapsed && unitFinancials.length === 0 && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
                    Nenhuma unidade habitacional encontrada neste projeto.
                </p>
            )}
        </div>
    );
};
