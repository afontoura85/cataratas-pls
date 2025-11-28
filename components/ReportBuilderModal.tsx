import React, { useState, useMemo } from 'react';
import { Project, ServiceCategory, Financials, ArchivedReport, ReportOptions, LayoutTemplate } from '../types';
import { CloseIcon, ChartPieIcon, SpinnerIconSmall, SparklesIcon, PaintBrushIcon } from './Icons';
import { exportToPDF, exportToXLSX, exportToJSON } from '../services/exportService';
import { generateReportSummary } from '../services/geminiService';
import toast from 'react-hot-toast';

interface ReportBuilderModalProps {
    project: Project;
    plsData: ServiceCategory[];
    financials: Financials;
    onClose: () => void;
    onArchiveReport: (report: Omit<ArchivedReport, 'id'>) => void;
    onManageLayouts: () => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const initialOptions = (allCategoryIds: string[]): Omit<ReportOptions, 'layout'> => ({
    title: 'Planilha de Levantamento de Serviços',
    includeProjectDetails: true,
    includeFinancialSummary: true,
    includeProgressTable: true,
    includeUnitDetails: true,
    selectedCategoryIds: allCategoryIds,
    aiSummary: null,
    orientation: 'l',
    measurementNumber: 1,
});

const parseServiceName = (name: string): { mainName: string; description: string | null } => {
    const nameParts = name.match(/(.*?)\s*\((.*)\)/);
    const mainName = nameParts ? nameParts[1].trim() : name;
    const description = nameParts ? nameParts[2].trim() : null;
    return { mainName, description };
};


export const ReportBuilderModal: React.FC<ReportBuilderModalProps> = ({ project, plsData, financials, onClose, onArchiveReport, onManageLayouts }) => {
    const allCategoryIds = useMemo(() => plsData.map(c => c.id), [plsData]);
    const [options, setOptions] = useState(() => initialOptions(allCategoryIds));
    const [outputFormat, setOutputFormat] = useState<'pdf' | 'xlsx' | 'json'>('pdf');
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [archiveAndSave, setArchiveAndSave] = useState(false);
    const [measurementNumber, setMeasurementNumber] = useState((project.archived_reports?.length || 0) + 1);

    const defaultLayout: LayoutTemplate = useMemo(() => ({
        id: 'default',
        name: 'Padrão do Sistema',
        primaryColor: '#0284c7', // sky-600
        logoBase64: null,
        isDefault: !(project.layouts || []).some(l => l.isDefault),
    }), [project.layouts]);

    const availableLayouts = useMemo(() => [defaultLayout, ...(project.layouts || [])], [project.layouts, defaultLayout]);
    
    const [selectedLayoutId, setSelectedLayoutId] = useState<string>(() => {
        const userDefaultLayout = (project.layouts || []).find(l => l.isDefault);
        if (userDefaultLayout) {
            return userDefaultLayout.id;
        }
        if (defaultLayout.isDefault) {
            return defaultLayout.id;
        }
        return availableLayouts.length > 0 ? availableLayouts[0].id : 'default';
    });


    const unitsWithProgressPreview = useMemo(() => {
        return project.housing_units.map((unit, unitIndex) => {
            const servicesWithProgress = plsData.flatMap(category => 
                category.subItems
                    .map(item => ({ name: item.name, progress: project.progress[item.id]?.[unitIndex] || 0 }))
                    .filter(item => item.progress > 0)
            );
            return { unitName: unit.name, hasProgress: servicesWithProgress.length > 0, services: servicesWithProgress };
        }).filter(u => u.hasProgress);
    }, [project, plsData]);


    const handleOptionChange = <K extends keyof ReportOptions>(key: K, value: ReportOptions[K]) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    const handleCategoryToggle = (categoryId: string) => {
        const newSelection = options.selectedCategoryIds.includes(categoryId)
            ? options.selectedCategoryIds.filter(id => id !== categoryId)
            : [...options.selectedCategoryIds, categoryId];
        handleOptionChange('selectedCategoryIds', newSelection);
    };

    const handleSelectAllCategories = () => handleOptionChange('selectedCategoryIds', allCategoryIds);
    const handleClearAllCategories = () => handleOptionChange('selectedCategoryIds', []);

    const filteredPlsData = useMemo(() => {
        return plsData
            .filter(cat => options.selectedCategoryIds.includes(cat.id))
            .map(cat => ({ ...cat, subItems: cat.subItems.filter(item => item.cost > 0) })) // Example of further filtering if needed
            .filter(cat => cat.subItems.length > 0);
    }, [plsData, options.selectedCategoryIds]);
    
    const handleGenerateSummary = async () => {
        setIsGeneratingSummary(true);
        handleOptionChange('aiSummary', null);
        
        const promise = generateReportSummary(project, financials, plsData, options);

        toast.promise(promise, {
            loading: 'Gerando resumo com IA...',
            success: (summary) => {
                handleOptionChange('aiSummary', summary);
                return 'Resumo gerado com sucesso!';
            },
            error: (err) => {
                console.error("Failed to generate AI summary:", err);
                return 'Ocorreu um erro ao gerar o resumo.';
            }
        });

        try {
            await promise;
        } catch (e) {
            // error handled by toast
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 50));

        const selectedLayout = availableLayouts.find(l => l.id === selectedLayoutId) || defaultLayout;
        const finalOptions: ReportOptions = { ...options, layout: selectedLayout, measurementNumber };

        try {
            if (archiveAndSave) {
                onArchiveReport({
                    title: finalOptions.title,
                    generatedAt: new Date().toISOString(),
                    format: outputFormat,
                    options: finalOptions,
                    financialsSnapshot: financials,
                    progressSnapshot: project.progress,
                    plsDataSnapshot: plsData,
                });
            }

            if (outputFormat === 'pdf') {
                await exportToPDF(project, plsData, financials, finalOptions);
            } else if (outputFormat === 'xlsx') {
                exportToXLSX(project, plsData, financials, finalOptions);
            } else {
                exportToJSON(project, plsData, financials, finalOptions);
            }
            toast.success('Relatório gerado com sucesso!');
        } catch (error) {
            console.error("Failed to export report:", error);
            toast.error("Ocorreu um erro ao gerar o relatório.");
        } finally {
            setIsExporting(false);
            onClose();
        }
    };

    const isExportDisabled = isExporting || (!options.includeProjectDetails && !options.includeFinancialSummary && !options.includeProgressTable && !options.includeUnitDetails);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30 p-4" onClick={onClose}>
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <ChartPieIcon />
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Construtor de Relatório</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Personalize e visualize seu relatório antes de exportar.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <CloseIcon />
                    </button>
                </header>

                <div className="flex-grow flex p-4 gap-4 overflow-hidden">
                    {/* Controls */}
                    <aside className="w-1/3 bg-white dark:bg-slate-800 rounded-lg p-4 flex flex-col overflow-y-auto">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="report-title" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Título do Relatório</label>
                                    <input type="text" id="report-title" value={options.title} onChange={e => handleOptionChange('title', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="measurement-number" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Nº da Medição</label>
                                    <select
                                        id="measurement-number"
                                        value={measurementNumber}
                                        onChange={e => setMeasurementNumber(Number(e.target.value))}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                    >
                                        {Array.from({ length: project.duration_months || 18 }, (_, i) => i + 1).map(num => (
                                            <option key={num} value={num}>{num}</option>
                                        ))}
                                    </select>
                                    {!(project.duration_months) && <p className="text-xs text-slate-500 mt-1">Duração não definida. Padrão: 18 meses.</p>}
                                </div>
                            </div>
                             <div>
                                <h3 className="text-base font-medium text-gray-900 dark:text-slate-200">Inteligência Artificial</h3>
                                <button
                                    onClick={handleGenerateSummary}
                                    disabled={isGeneratingSummary}
                                    className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isGeneratingSummary ? (
                                        <>
                                            <SpinnerIconSmall />
                                            Analisando dados...
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon />
                                            Gerar Resumo com IA
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            <fieldset>
                                <legend className="text-base font-medium text-gray-900 dark:text-slate-200">Layout do Relatório (PDF)</legend>
                                <div className="flex items-center gap-2 mt-2">
                                    <select
                                        value={selectedLayoutId}
                                        onChange={e => setSelectedLayoutId(e.target.value)}
                                        className="flex-grow block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                        disabled={outputFormat !== 'pdf'}
                                    >
                                        {availableLayouts.map(layout => (
                                            <option key={layout.id} value={layout.id}>{layout.name} {layout.isDefault && layout.id !== 'default' ? '(Padrão)' : ''}</option>
                                        ))}
                                    </select>
                                    <button onClick={onManageLayouts} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold"
                                        disabled={outputFormat !== 'pdf'}
                                    >
                                       <PaintBrushIcon /> Gerenciar
                                    </button>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Orientação</label>
                                    <div className="mt-2 flex gap-4">
                                        <div className="flex items-center">
                                            <input id="portrait" name="orientation" type="radio" value="p" checked={options.orientation === 'p'} onChange={() => handleOptionChange('orientation', 'p')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" disabled={outputFormat !== 'pdf'} />
                                            <label htmlFor="portrait" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">Retrato</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input id="landscape" name="orientation" type="radio" value="l" checked={options.orientation === 'l'} onChange={() => handleOptionChange('orientation', 'l')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" disabled={outputFormat !== 'pdf'} />
                                            <label htmlFor="landscape" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">Paisagem</label>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset>
                                <legend className="text-base font-medium text-gray-900 dark:text-slate-200">Seções do Relatório</legend>
                                <div className="mt-2 space-y-2">
                                    {[['includeProjectDetails', 'Detalhes do Projeto'], ['includeFinancialSummary', 'Resumo Financeiro'], ['includeProgressTable', 'Tabela de Progresso'], ['includeUnitDetails', 'Detalhamento por Casas']].map(([key, label]) => (
                                        <div key={key} className="relative flex items-start">
                                            <div className="flex h-5 items-center">
                                                <input id={key} name={key} type="checkbox" checked={options[key as keyof typeof options] as boolean} onChange={e => handleOptionChange(key as keyof ReportOptions, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                            </div>
                                            <div className="ml-3 text-sm">
                                                <label htmlFor={key} className="font-medium text-gray-700 dark:text-slate-300">{label}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </fieldset>

                             <fieldset>
                                <legend className="text-base font-medium text-gray-900 dark:text-slate-200">Etapas da Obra (para Tabela)</legend>
                                 <div className="flex gap-4 mt-2 text-sm font-medium">
                                    <button onClick={handleSelectAllCategories} className="text-blue-600 dark:text-blue-400 hover:underline">Selecionar Todas</button>
                                    <button onClick={handleClearAllCategories} className="text-blue-600 dark:text-blue-400 hover:underline">Limpar Seleção</button>
                                </div>
                                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border dark:border-slate-600 rounded-md p-2">
                                    {plsData.map(category => (
                                        <div key={category.id} className="relative flex items-start">
                                            <div className="flex h-5 items-center">
                                                <input id={`cat-${category.id}`} type="checkbox" checked={options.selectedCategoryIds.includes(category.id)} onChange={() => handleCategoryToggle(category.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                            </div>
                                            <div className="ml-3 text-sm">
                                                <label htmlFor={`cat-${category.id}`} className="font-medium text-gray-700 dark:text-slate-300">{category.id} - {category.name}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </fieldset>

                             <fieldset>
                                <legend className="text-base font-medium text-gray-900 dark:text-slate-200">Formato de Saída</legend>
                                <div className="mt-2 flex gap-4">
                                     <div className="flex items-center">
                                        <input id="pdf" name="output-format" type="radio" value="pdf" checked={outputFormat === 'pdf'} onChange={() => setOutputFormat('pdf')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        <label htmlFor="pdf" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">PDF</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input id="xlsx" name="output-format" type="radio" value="xlsx" checked={outputFormat === 'xlsx'} onChange={() => setOutputFormat('xlsx')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        <label htmlFor="xlsx" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">XLSX</label>
                                    </div>
                                    <div className="flex items-center">
                                        <input id="json" name="output-format" type="radio" value="json" checked={outputFormat === 'json'} onChange={() => setOutputFormat('json')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        <label htmlFor="json" className="ml-2 block text-sm font-medium text-gray-700 dark:text-slate-300">JSON</label>
                                    </div>
                                </div>
                            </fieldset>

                             <fieldset>
                                <legend className="text-base font-medium text-gray-900 dark:text-slate-200">Ações Finais</legend>
                                <div className="mt-2 space-y-2">
                                     <div className="relative flex items-start p-3 bg-amber-50 dark:bg-amber-900/50 rounded-lg border border-amber-200 dark:border-amber-700">
                                        <div className="flex h-5 items-center">
                                            <input id="archive" name="archive" type="checkbox" checked={archiveAndSave} onChange={e => setArchiveAndSave(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        </div>
                                        <div className="ml-3 text-sm">
                                            <label htmlFor="archive" className="font-bold text-amber-800 dark:text-amber-200">Marcar como enviado à CEF e arquivar</label>
                                            <p className="text-xs text-amber-700 dark:text-amber-300">Salva uma cópia permanente deste relatório no histórico do projeto.</p>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                        </div>
                    </aside>

                    {/* Preview */}
                    <main className="w-2/3 bg-slate-200 dark:bg-slate-700/50 rounded-lg p-4 overflow-y-auto">
                       <div className="bg-white dark:bg-slate-800 shadow-lg max-w-3xl mx-auto p-8 rounded-sm">
                           {/* Preview Content */}
                            <h1 className="text-2xl font-bold mb-6 border-b pb-4">{options.title}</h1>

                           {isGeneratingSummary && (
                               <div className="mb-6 p-4 border border-dashed rounded-lg flex items-center gap-3">
                                   <SpinnerIconSmall />
                                   <span className="text-sm text-slate-500">A IA está analisando os dados para gerar o resumo...</span>
                               </div>
                           )}

                           {options.aiSummary && (
                               <div className="mb-6 border border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden">
                                   <h2 className="text-lg font-semibold p-3 bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-100 border-b border-blue-200 dark:border-blue-700 flex items-center gap-2">
                                        <SparklesIcon />
                                        Resumo Executivo (IA)
                                   </h2>
                                   <div className="p-4 text-sm whitespace-pre-wrap">
                                        {options.aiSummary}
                                   </div>
                               </div>
                           )}
                           
                           {options.includeProjectDetails && (
                                <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <h2 className="text-lg font-semibold p-3 bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600">Detalhes do Projeto</h2>
                                    <div className="p-4 text-sm space-y-1">
                                        <p><strong>Empreendimento:</strong> {project?.name}</p>
                                        <p><strong>Unidades:</strong> {project?.housing_units.length}</p>
                                        <p><strong>Custo Total:</strong> {formatCurrency(project?.cost_of_works)}</p>
                                        <p><strong>Construtora:</strong> {project?.construction_company?.name || 'N/A'} ({project?.construction_company?.cnpj || 'N/A'})</p>
                                        <p><strong>Proponente:</strong> {project?.developer?.name || 'N/A'} ({project?.developer?.cnpj || 'N/A'})</p>
                                        <p><strong>Endereço:</strong> {`${project?.address?.street || ''}, ${project?.address?.city || ''} - ${project?.address?.state || ''}`}</p>
                                    </div>
                                </div>
                           )}

                           {options.includeFinancialSummary && (
                                <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <h2 className="text-lg font-semibold p-3 bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600">Resumo Financeiro</h2>
                                     <div className="p-4 grid grid-cols-3 gap-4 text-center">
                                         <div>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Progresso Total</p>
                                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{financials.totalProgress.toFixed(2)}%</p>
                                        </div>
                                         <div>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Valor Liberado</p>
                                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(financials.totalReleased)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo a Medir</p>
                                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(financials.balanceToMeasure)}</p>
                                        </div>
                                    </div>
                                </div>
                           )}

                           {options.includeProgressTable && (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <h2 className="text-lg font-semibold p-3 bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600">Tabela de Progresso</h2>
                                    <div className="p-4">
                                        {filteredPlsData.length > 0 ? (
                                            <div className="text-xs border rounded-md overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-slate-100 dark:bg-slate-700">
                                                        <tr>
                                                            <th className="p-1 text-left font-semibold w-16">ID</th>
                                                            <th className="p-1 text-left font-semibold">Serviço</th>
                                                            <th className="p-1 text-right font-semibold w-24">Incidência</th>
                                                            <th className="p-1 text-center font-semibold w-20">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredPlsData.map(category => (
                                                            <React.Fragment key={category.id}>
                                                                <tr className="bg-blue-50 dark:bg-blue-900/50">
                                                                    <td colSpan={4} className="p-1 font-bold">{category.id} - {category.name}</td>
                                                                </tr>
                                                                {category.subItems.map(item => {
                                                                    const { mainName, description } = parseServiceName(item.name);
                                                                    const isExpanded = expandedItemId === item.id;
                                                                    return (
                                                                        <React.Fragment key={item.id}>
                                                                            <tr className="border-t dark:border-slate-700">
                                                                                <td className="p-1">{item.id}</td>
                                                                                <td className="p-1">
                                                                                    <button
                                                                                        onClick={() => setExpandedItemId(prevId => prevId === item.id ? null : item.id)}
                                                                                        disabled={!description}
                                                                                        className="text-left w-full rounded hover:text-blue-600 dark:hover:text-blue-400 disabled:hover:text-current disabled:cursor-default focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                                    >
                                                                                        {mainName}
                                                                                        {description && <span className="text-blue-500/80 ml-1 text-xs font-mono">...</span>}
                                                                                    </button>
                                                                                </td>
                                                                                <td className="p-1 text-right">{item.incidence.toFixed(2)}%</td>
                                                                                <td className="p-1 text-center">
                                                                                    <button className="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded">
                                                                                        Detalhes
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                            {isExpanded && description && (
                                                                                <tr className="bg-slate-50 dark:bg-slate-700/40">
                                                                                    <td></td>
                                                                                    <td colSpan={3} className="py-2 px-3 text-xs text-slate-500 dark:text-slate-400 italic">
                                                                                        {description}
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </React.Fragment>
                                                                    );
                                                                })}
                                                            </React.Fragment>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : <p className="text-sm text-slate-500 italic">Nenhuma etapa selecionada para exibição.</p>}
                                    </div>
                                </div>
                           )}

                            {options.includeUnitDetails && (
                                <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <h2 className="text-lg font-semibold p-3 bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-600">Detalhamento por Casas</h2>
                                    <div className="p-4 text-sm">
                                        {unitsWithProgressPreview.length > 0 ? (
                                            <>
                                                <p className="italic text-slate-500 mb-2">O relatório final incluirá uma tabela detalhada para cada casa com progresso. Abaixo uma amostra da primeira unidade.</p>
                                                <h3 className="font-bold mb-1">{unitsWithProgressPreview[0].unitName}</h3>
                                                <ul className="list-disc list-inside text-xs space-y-1">
                                                    {unitsWithProgressPreview[0].services.slice(0, 3).map((item, index) => (
                                                        <li key={index}>{parseServiceName(item.name).mainName}: <strong>{item.progress}%</strong></li>
                                                    ))}
                                                    {unitsWithProgressPreview[0].services.length > 3 && <li>... e mais</li>}
                                                </ul>
                                            </>
                                        ) : (
                                            <p className="italic text-slate-500">Nenhuma unidade com progresso para detalhar.</p>
                                        )}
                                    </div>
                                </div>
                           )}

                           {isExportDisabled && (
                               <p className="text-center text-slate-500 italic mt-8">Selecione pelo menos uma seção para incluir no relatório.</p>
                           )}

                       </div>
                    </main>
                </div>

                <footer className="flex justify-end gap-4 p-4 border-t bg-white dark:bg-slate-800 dark:border-slate-700 rounded-b-lg">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold">
                        Cancelar
                    </button>
                    <button onClick={handleExport} disabled={isExportDisabled} className="flex items-center justify-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed">
                        {isExporting ? (
                            <>
                                <SpinnerIconSmall />
                                Exportando...
                            </>
                        ) : (
                            'Gerar Relatório'
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
};
