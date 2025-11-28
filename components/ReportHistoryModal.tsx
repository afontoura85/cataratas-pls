import React from 'react';
import { Project, ArchivedReport } from '../types';
import { CloseIcon, ArchiveBoxIcon, DocumentArrowDownIcon } from './Icons';
import { exportToPDF, exportToXLSX, exportToJSON } from '../services/exportService';
import toast from 'react-hot-toast';

interface ReportHistoryModalProps {
  project: Project;
  onClose: () => void;
}

export const ReportHistoryModal: React.FC<ReportHistoryModalProps> = ({ project, onClose }) => {
    const reports = [...(project.archived_reports || [])].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    const handleDownload = async (report: ArchivedReport) => {
        try {
            // Reconstruct a project object that represents the state at the time of archival
            const historicalProject: Project = {
                ...project, // Use current project for static details like name, developer etc.
                progress: report.progressSnapshot, // Override progress with the snapshot.
            };

            // Call the correct export function with the snapshotted data
            if (report.format === 'pdf') {
                await exportToPDF(historicalProject, report.plsDataSnapshot, report.financialsSnapshot, report.options);
            } else if (report.format === 'xlsx') {
                exportToXLSX(historicalProject, report.plsDataSnapshot, report.financialsSnapshot, report.options);
            } else {
                exportToJSON(historicalProject, report.plsDataSnapshot, report.financialsSnapshot, report.options);
            }
            toast.success(`Relatório "${report.title}" gerado novamente.`);
        } catch (error) {
            console.error("Failed to re-generate report:", error);
            toast.error("Falha ao gerar o relatório histórico.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700">
                           <ArchiveBoxIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                                Histórico de Relatórios
                            </h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                                Acesse e baixe relatórios arquivados enviados à CEF.
                            </p>
                        </div>
                    </div>
                     <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <main className="flex-grow p-4 overflow-y-auto">
                    {reports.length > 0 ? (
                        <ul className="space-y-3">
                            {reports.map(report => (
                                <li key={report.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-200 dark:border-slate-600">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{report.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Gerado em: {new Date(report.generatedAt).toLocaleString('pt-BR')}
                                            <span className="mx-2">|</span>
                                            Formato: <span className="uppercase font-medium">{report.format}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(report)}
                                        className="flex-shrink-0 flex items-center gap-2 ml-4 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold"
                                    >
                                        <DocumentArrowDownIcon />
                                        Download
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <div className="text-center py-16">
                            <ArchiveBoxIcon className="mx-auto h-12 w-12 text-slate-400" />
                            <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
                                Nenhum relatório arquivado
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Para arquivar um relatório, marque a opção "Marcar como enviado à CEF" ao gerar um novo relatório.
                            </p>
                        </div>
                    )}
                </main>
                 <footer className="flex justify-end gap-4 p-4 border-t bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-semibold">
                        Fechar
                    </button>
                </footer>
            </div>
        </div>
    );
};