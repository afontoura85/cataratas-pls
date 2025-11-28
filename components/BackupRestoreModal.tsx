import React, { useRef, useState } from 'react';
import { CloseIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from './Icons';
import toast from 'react-hot-toast';
import { Project } from '../types';

export const isValidProjectArray = (data: any): data is Project[] => {
    if (!Array.isArray(data)) {
        return false;
    }
    if (data.length === 0) {
        return true;
    }
    for (const item of data) {
        if (
            typeof item !== 'object' || item === null ||
            typeof item.id !== 'string' || typeof item.name !== 'string' ||
            typeof item.created_at !== 'string' || typeof item.cost_of_works !== 'number'
        ) {
            return false;
        }
    }
    return true;
};


interface BackupRestoreModalProps {
    onClose: () => void;
    projects: Project[];
    onRestore: (projects: Project[]) => Promise<void>;
    onImport: (projects: Project[]) => Promise<void>;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose, projects, onRestore, onImport }) => {
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [fileToRestore, setFileToRestore] = useState<File | null>(null);
    const [fileToImport, setFileToImport] = useState<File | null>(null);

    const handleBackup = () => {
        try {
            if (!projects || projects.length === 0) {
                toast.error('Não há dados de projetos para fazer backup.');
                return;
            }
            const data = JSON.stringify(projects, null, 2);
            const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];

            link.href = url;
            link.download = `cataratas_pls_backup_${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            toast.success('Backup criado com sucesso!');
        } catch (error) {
            console.error('Failed to create backup:', error);
            toast.error('Ocorreu um erro ao criar o backup.');
        }
    };

    const handleRestoreClick = () => {
        restoreInputRef.current?.click();
    };
    
    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleRestoreFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileToRestore(file);
        }
        if(event.target) event.target.value = "";
    };

    const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileToImport(file);
        }
        if(event.target) event.target.value = "";
    };

    const handleApplyRestore = () => {
        if (!fileToRestore) {
            toast.error("Por favor, selecione um arquivo de backup para restaurar.");
            return;
        }

        if (!window.confirm(
            'ATENÇÃO: Restaurar um backup irá substituir TODOS os seus projetos neste navegador. Esta ação não pode ser desfeita. Deseja continuar?'
        )) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                toast.error('Não foi possível ler o arquivo de backup.');
                return;
            }

            try {
                const parsedData = JSON.parse(text);
                if (!isValidProjectArray(parsedData)) {
                    throw new Error('O arquivo de backup não contém dados de projeto válidos ou está em um formato incompatível.');
                }
                
                await toast.promise(onRestore(parsedData), {
                    loading: 'Restaurando backup...',
                    success: 'Backup restaurado com sucesso!',
                    error: (err) => `Falha ao restaurar: ${err.message}`
                });

                onClose();

            } catch (error) {
                console.error('Failed to restore backup:', error);
                if (error instanceof Error) {
                    toast.error(`Falha ao restaurar: ${error.message}`);
                } else {
                    toast.error('O arquivo de backup é inválido ou está corrompido.');
                }
            }
        };

        reader.onerror = () => {
            toast.error('Erro ao ler o arquivo.');
        };
        
        reader.readAsText(fileToRestore);
    };

    const handleApplyImport = () => {
        if (!fileToImport) {
            toast.error("Por favor, selecione um arquivo para importar.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                toast.error('Não foi possível ler o arquivo.');
                return;
            }

            try {
                const parsedData = JSON.parse(text);
                if (!isValidProjectArray(parsedData)) {
                    throw new Error('O arquivo não contém dados de projeto válidos ou está em um formato incompatível.');
                }
                
                await toast.promise(onImport(parsedData), {
                    loading: 'Importando projetos...',
                    success: `${parsedData.length} projeto(s) importado(s) com sucesso!`,
                    error: (err) => `Falha ao importar: ${err.message}`
                });

                onClose();

            } catch (error) {
                console.error('Failed to import data:', error);
                if (error instanceof Error) {
                    toast.error(`Falha ao importar: ${error.message}`);
                } else {
                    toast.error('O arquivo é inválido ou está corrompido.');
                }
            }
        };
        reader.onerror = () => {
            toast.error('Erro ao ler o arquivo.');
        };
        reader.readAsText(fileToImport);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                        Backup e Gerenciamento de Dados
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <main className="p-6 space-y-6">
                    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Criar Backup</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">
                            Salve todos os seus projetos deste navegador em um arquivo JSON local.
                        </p>
                        <button
                            onClick={handleBackup}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm"
                        >
                            <ArrowDownTrayIcon />
                            Fazer Download do Backup
                        </button>
                    </div>

                     <div className="p-4 border border-emerald-300 dark:border-emerald-700 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 space-y-3">
                         <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">Importar Projetos (Adicionar)</h3>
                         <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            Adicione projetos de um arquivo de backup à sua lista atual sem substituir os dados existentes.
                        </p>
                        <input type="file" accept="application/json,.json" ref={importInputRef} onChange={handleImportFileChange} className="hidden" />
                        <button
                            onClick={handleImportClick}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold shadow-sm"
                        >
                            <ArrowUpTrayIcon />
                            {fileToImport ? 'Trocar Arquivo' : 'Carregar Arquivo'}
                        </button>
                        {fileToImport && (
                             <>
                                <div className="text-center text-sm text-slate-600 dark:text-slate-300 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md border dark:border-slate-200 dark:border-slate-600">
                                    <p>Arquivo selecionado:</p>
                                    <p className="font-semibold truncate" title={fileToImport.name}>{fileToImport.name}</p>
                                </div>
                                <button
                                    onClick={handleApplyImport}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold shadow-sm"
                                >
                                    <ArrowUpTrayIcon />
                                    Importar Projetos
                                </button>
                            </>
                        )}
                    </div>

                    <div className="p-4 border border-rose-300 dark:border-rose-700 rounded-lg bg-rose-50 dark:bg-rose-900/40 space-y-3">
                         <h3 className="font-semibold text-rose-800 dark:text-rose-200">Restaurar (Substituir Tudo)</h3>
                         <p className="text-sm text-rose-700 dark:text-rose-300">
                            <strong className="font-bold">Aviso:</strong> Esta ação substituirá todos os seus projetos neste navegador.
                        </p>
                        <input type="file" accept="application/json,.json" ref={restoreInputRef} onChange={handleRestoreFileChange} className="hidden" />
                        <button
                            onClick={handleRestoreClick}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 font-semibold shadow-sm"
                        >
                            <ArrowUpTrayIcon />
                            {fileToRestore ? 'Trocar Arquivo' : 'Carregar Arquivo'}
                        </button>
                        {fileToRestore && (
                             <>
                                <div className="text-center text-sm text-slate-600 dark:text-slate-300 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md border dark:border-slate-200 dark:border-slate-600">
                                    <p>Arquivo selecionado:</p>
                                    <p className="font-semibold truncate" title={fileToRestore.name}>{fileToRestore.name}</p>
                                </div>
                                <button
                                    onClick={handleApplyRestore}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 font-semibold shadow-sm"
                                >
                                    <ArrowUpTrayIcon />
                                    Aplicar Restauração
                                </button>
                            </>
                        )}
                    </div>
                </main>
                
                 <footer className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600">
                        Fechar
                    </button>
                </footer>
            </div>
        </div>
    );
};