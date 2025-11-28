import React, { useState, useEffect } from 'react';
import { SettingsIcon, CloseIcon, DocumentMagnifyingGlassIcon, CircleStackIcon, UserGroupIcon } from './Icons';
import { Project, UserProfile } from '../types';
import toast from 'react-hot-toast';
import { DocumentsSettings } from './DocumentsSettings';
import { GeneralSettings } from './GeneralSettings';
import { BackupSettings } from './BackupSettings';
import { MembersSettings } from './MembersSettings';
import { useAuth } from '../hooks/useAuth';

interface ProjectSettingsProps {
  project: Project;
  onSave: (data: Project) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

type SettingsTab = 'general' | 'documents' | 'members' | 'backup';


export const ProjectSettings: React.FC<ProjectSettingsProps> = ({ project, onSave, onCancel, onDelete }) => {
  const [formData, setFormData] = useState<Project>(project);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { user } = useAuth();

  useEffect(() => {
    setFormData(project);
  }, [project]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.housing_units.length > 0 && formData.cost_of_works > 0) {
      onSave(formData);
    }
  };

  const handleDeleteClick = () => {
    const confirmation = prompt(`Esta é uma ação irreversível. Para confirmar a exclusão, digite o nome exato do projeto: "${project.name}"`);
    if (confirmation === null) {
        return;
    }
    if (confirmation.trim() === project.name) {
        onDelete(project.id);
        onCancel(); // Close the modal after initiating delete
    } else {
        toast.error("O nome do projeto não corresponde. A exclusão foi cancelada.");
    }
  };

  const isOwner = user?.uid === project.ownerId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-6 pb-0 border-b dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700">
                       <SettingsIcon />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                            Configurações do Projeto
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                            Edite os detalhes e documentos do empreendimento.
                        </p>
                    </div>
                </div>
                 <button onClick={onCancel} className="p-2 -mt-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                    <CloseIcon />
                </button>
            </div>
            <nav className="mt-4 -mb-px flex space-x-8">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'general' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}
                >
                    <SettingsIcon /> Geral
                </button>
                <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'documents' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}
                >
                    <DocumentMagnifyingGlassIcon /> Documentos
                </button>
                {isOwner && (
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'members' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}
                    >
                        <UserGroupIcon /> Membros
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('backup')}
                    className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'backup' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'}`}
                >
                    <CircleStackIcon className="h-6 w-6" /> Backup
                </button>
            </nav>
        </header>
        
        <form className="overflow-y-auto" onSubmit={handleSubmit}>
            <div className="p-6">
                {activeTab === 'general' && <GeneralSettings formData={formData} setFormData={setFormData} onDelete={handleDeleteClick} />}
                {activeTab === 'documents' && <DocumentsSettings project={formData} onSave={onSave} />}
                {activeTab === 'members' && isOwner && user && <MembersSettings project={formData} user={user} />}
                {activeTab === 'backup' && <BackupSettings project={formData} />}
            </div>
            <footer className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                <div className="flex justify-end items-center">
                    <div>
                        <button type="button" onClick={onCancel} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600">
                            Cancelar
                        </button>
                        <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={activeTab !== 'general'}
                          title={activeTab !== 'general' ? 'Ações de salvamento são feitas dentro de cada aba.' : ''}
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </footer>
        </form>
      </div>
    </div>
  );
};