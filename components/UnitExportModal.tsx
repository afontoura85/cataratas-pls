/**
 * @file Componente `UnitExportModal` que fornece uma interface para exportar os dados
 * de progresso de uma única unidade habitacional para formatos como CSV (Excel) ou JSON.
 */
import React, { useState } from 'react';
import { Project, ServiceCategory, HousingUnit } from '../types';
import { CloseIcon, DocumentArrowDownIcon, SpinnerIconSmall } from './Icons';
import { exportUnitToJSON, exportUnitToCSV } from '../services/exportService';
import toast from 'react-hot-toast';

/**
 * @typedef {object} UnitExportModalProps
 * @property {HousingUnit} unit - A unidade habitacional cujos dados serão exportados.
 * @property {Project} project - O objeto completo do projeto.
 * @property {ServiceCategory[]} plsData - A estrutura de serviços calculada da PLS.
 * @property {() => void} onClose - Callback para fechar o modal.
 */
interface UnitExportModalProps {
    unit: HousingUnit;
    project: Project;
    plsData: ServiceCategory[];
    onClose: () => void;
}

/**
 * Um modal que permite ao usuário escolher um formato e exportar um relatório
 * contendo todos os dados de progresso para uma unidade habitacional específica.
 * @param {UnitExportModalProps} props As propriedades do componente.
 * @returns {React.ReactElement} O modal de exportação de unidade.
 */
export const UnitExportModal: React.FC<UnitExportModalProps> = ({ unit, project, plsData, onClose }) => {
    const [outputFormat, setOutputFormat] = useState<'json' | 'csv'>('csv');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 50)); // Permite a atualização da UI
        try {
            if (outputFormat === 'json') {
                exportUnitToJSON(project, plsData, unit);
            } else {
                exportUnitToCSV(project, plsData, unit);
            }
            toast.success('Relatório da unidade exportado!');
        } catch (error) {
            console.error("Failed to export unit report:", error);
            toast.error("Ocorreu um erro ao gerar o relatório da unidade.");
        } finally {
            setIsExporting(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Exportar Progresso da Unidade</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{unit.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <CloseIcon />
                    </button>
                </header>

                <main className="p-6">
                    <fieldset>
                        <legend className="text-base font-medium text-gray-900 dark:text-slate-200">Formato de Saída</legend>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Escolha o formato do arquivo para exportação.</p>
                        <div className="mt-2 flex gap-4">
                            <div className="flex items-center">
                                <input id="csv" name="output-format" type="radio" value="csv" checked={outputFormat === 'csv'} onChange={() => setOutputFormat('csv')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <label htmlFor="csv" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">CSV (Excel)</label>
                            </div>
                             <div className="flex items-center">
                                <input id="json" name="output-format" type="radio" value="json" checked={outputFormat === 'json'} onChange={() => setOutputFormat('json')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <label htmlFor="json" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">JSON (Dados)</label>
                            </div>
                        </div>
                    </fieldset>
                </main>

                <footer className="flex justify-end gap-4 p-4 border-t bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold">
                        Cancelar
                    </button>
                    <button onClick={handleExport} disabled={isExporting} className="flex items-center justify-center gap-2 w-36 px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed">
                        {isExporting ? (
                            <>
                                <SpinnerIconSmall />
                                Exportando...
                            </>
                        ) : (
                            <>
                                <DocumentArrowDownIcon/>
                                Exportar
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
};
