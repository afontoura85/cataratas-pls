import React from 'react';
import { Project } from '../types';
import { ArrowDownTrayIcon } from './Icons';
import toast from 'react-hot-toast';

interface BackupSettingsProps {
    project: Project;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({ project }) => {
    
    const handleBackup = () => {
        try {
            // Wrap the single project in an array to be compatible with the global importer
            const data = JSON.stringify([project], null, 2);
            const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            const safeName = project.name.replace(/\s+/g, '_');

            link.href = url;
            link.download = `cataratas_pls_backup_${safeName}_${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            toast.success('Backup do projeto criado com sucesso!');
        } catch (error) {
            console.error('Failed to create project backup:', error);
            toast.error('Ocorreu um erro ao criar o backup do projeto.');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-200">Backup e Restauração do Projeto</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Exporte os dados deste projeto para um arquivo JSON ou restaure um a partir de um arquivo.</p>
            </div>

            <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Exportar Projeto Atual</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">
                    Isso salvará um backup contendo apenas os dados do projeto '{project.name}' em um arquivo .json.
                    Você pode usar a função <span className="font-semibold text-slate-600 dark:text-slate-300">"Importar Projetos"</span> na tela inicial para restaurar este projeto mais tarde.
                </p>
                <button
                    type="button"
                    onClick={handleBackup}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-sm"
                >
                    <ArrowDownTrayIcon />
                    Exportar Backup do Projeto
                </button>
            </div>
        </div>
    );
};