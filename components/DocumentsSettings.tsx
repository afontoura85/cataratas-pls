/**
 * @file Componente `DocumentsSettings` que renderiza a aba "Documentos" dentro do modal de configurações.
 * Permite que o usuário reimporte documentos como FRE, Orçamento e Cronograma para atualizar
 * os dados do projeto, acionando um modal de verificação antes de aplicar as mudanças.
 */
import React, { useRef, useState } from 'react';
import { Project, PlsCategoryTemplate, ScheduleStage } from '../types';
import { DocumentArrowUpIcon, CheckCircleIcon, SpinnerIconSmall } from './Icons';
import { VerificationModal } from './VerificationModal';
import { ExtractedFreData, ExtractedScheduleData, extractDataFromFRE, extractPlsFromBudgetFile, extractDataFromScheduleFile } from '../services/geminiService';
import toast from 'react-hot-toast';

/**
 * @typedef {object | null} VerificationData
 * @property {'fre' | 'pls' | 'schedule'} type - O tipo de documento sendo verificado.
 * @property {any} newData - Os novos dados extraídos do documento.
 */
type VerificationData = {
    type: 'fre' | 'pls' | 'schedule';
    newData: any;
} | null;

/**
 * @typedef {object} DocumentSectionProps
 * @property {string} title - O título da seção do documento.
 * @property {string} description - Uma breve descrição do propósito do documento.
 * @property {string} [importDate] - A data da última importação (formato ISO).
 * @property {() => void} onImportClick - Callback para iniciar o processo de importação.
 * @property {boolean} isImporting - Sinalizador para indicar se a importação está em andamento.
 */
interface DocumentSectionProps {
    title: string;
    description: string;
    importDate?: string;
    onImportClick: () => void;
    isImporting: boolean;
}

/**
 * Componente de UI para uma única seção de documento (FRE, Orçamento, etc.).
 * Exibe o status da importação e um botão para iniciar uma nova importação.
 * @param {DocumentSectionProps} props As propriedades do componente.
 * @returns {React.ReactElement} A seção de documento renderizada.
 */
const DocumentSection: React.FC<DocumentSectionProps> = ({ title, description, importDate, onImportClick, isImporting }) => (
    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
        <div className="flex items-start justify-between gap-4">
            <div className="flex-grow">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
                {importDate ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>Importado em: {new Date(importDate).toLocaleString('pt-BR')}</span>
                    </div>
                ) : (
                    <div className="mt-2 text-xs text-slate-500 font-medium italic">
                        <span>Não importado</span>
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={onImportClick}
                disabled={isImporting}
                className="flex-shrink-0 flex items-center justify-center gap-2 w-48 px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
                {isImporting ? <SpinnerIconSmall /> : <DocumentArrowUpIcon />}
                Verificar e Reimportar
            </button>
        </div>
    </div>
);

/**
 * Renderiza a aba de gerenciamento de documentos, permitindo a reimportação
 * e atualização dos dados do projeto a partir de arquivos.
 * @param {object} props - Propriedades do componente.
 * @param {Project} props.project - O projeto atual.
 * @param {(updatedProject: Project) => void} props.onSave - Callback para salvar o projeto atualizado.
 * @returns {React.ReactElement} A aba de configurações de documentos.
 */
export const DocumentsSettings: React.FC<{ project: Project; onSave: (updatedProject: Project) => void }> = ({ project, onSave }) => {
    const [verificationData, setVerificationData] = useState<VerificationData>(null);
    const [isImporting, setIsImporting] = useState< 'fre' | 'pls' | 'schedule' | null>(null);

    const freFileInputRef = useRef<HTMLInputElement>(null);
    const plsFileInputRef = useRef<HTMLInputElement>(null);
    const scheduleFileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'fre' | 'pls' | 'schedule') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(type);
        const promise = 
            type === 'fre' ? extractDataFromFRE(file) :
            type === 'pls' ? extractPlsFromBudgetFile(file) :
            extractDataFromScheduleFile(file);

        try {
            const newData = await toast.promise(promise as Promise<any>, {
                loading: `Analisando ${type.toUpperCase()} com a IA...`,
                success: 'Documento analisado!',
                error: (err) => `Falha na análise: ${err.message}`
            });

            if (newData) {
                setVerificationData({ type, newData });
            }
        } catch (error) {
            console.error(`Failed to import ${type}`, error);
        } finally {
            setIsImporting(null);
            e.target.value = ""; // Reseta o input de arquivo
        }
    };
    
    const handleConfirmUpdate = (newData: any) => {
        if (!verificationData) return;
        const { type } = verificationData;

        let updatedProject = { ...project };

        if (type === 'fre') {
            const data = newData as ExtractedFreData;
            updatedProject = { ...updatedProject,
                name: data.projectName,
                cost_of_works: data.costOfWorks,
                total_enterprise_cost: data.totalEnterpriseCost,
                vgv: data.vgv,
                developer: { name: data.developerName, cnpj: data.developerCnpj },
                construction_company: { name: data.constructionCompanyName, cnpj: data.constructionCompanyCnpj },
                address: { ...updatedProject.address, street: data.addressStreet, city: data.addressCity, state: data.addressState, zip: data.addressZip },
                responsible_engineer: { name: data.engineerName, crea: data.engineerCrea, email: data.engineerEmail },
            };
        } else if (type === 'pls') {
            updatedProject.pls_data = newData as PlsCategoryTemplate[];
        } else if (type === 'schedule') {
            const data = newData as ExtractedScheduleData;
            updatedProject.schedule = data.scheduleDetails.schedule;
            updatedProject.duration_months = data.scheduleDetails.duration_months;
            if (data.projectDetails.costOfWorks) updatedProject.cost_of_works = data.projectDetails.costOfWorks;
            if (data.projectDetails.projectName) updatedProject.name = data.projectDetails.projectName;
        }

        updatedProject.import_metadata = {
            ...updatedProject.import_metadata,
            [`${type}_imported_at`]: new Date().toISOString(),
        };
        
        onSave(updatedProject);
        setVerificationData(null);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-200">Gerenciamento de Documentos</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Reimporte documentos para verificar alterações e atualizar os dados do projeto.</p>
            </div>

            <input type="file" accept="image/*,application/pdf,.xls,.xlsx" ref={freFileInputRef} onChange={(e) => handleFileSelect(e, 'fre')} className="hidden" />
            <input type="file" accept="image/*,application/pdf,.xls,.xlsx" ref={plsFileInputRef} onChange={(e) => handleFileSelect(e, 'pls')} className="hidden" />
            <input type="file" accept="image/*,application/pdf,.xls,.xlsx" ref={scheduleFileInputRef} onChange={(e) => handleFileSelect(e, 'schedule')} className="hidden" />

            <div className="space-y-4">
                <DocumentSection 
                    title="Ficha Resumo do Empreendimento (FRE)"
                    description="Atualiza os detalhes principais do projeto, como custos, nomes e endereços."
                    importDate={project.import_metadata?.fre_imported_at}
                    onImportClick={() => freFileInputRef.current?.click()}
                    isImporting={isImporting === 'fre'}
                />
                 <DocumentSection 
                    title="Orçamento Sintético"
                    description="Define a estrutura da PLS, incluindo todas as etapas, serviços e suas respectivas incidências."
                    importDate={project.import_metadata?.pls_imported_at}
                    onImportClick={() => plsFileInputRef.current?.click()}
                    isImporting={isImporting === 'pls'}
                />
                 <DocumentSection 
                    title="Cronograma Físico-Financeiro"
                    description="Atualiza o planejamento de etapas e o prazo de execução da obra."
                    importDate={project.import_metadata?.schedule_imported_at}
                    onImportClick={() => scheduleFileInputRef.current?.click()}
                    isImporting={isImporting === 'schedule'}
                />
            </div>
            
            {verificationData && (
                <VerificationModal
                    project={project}
                    data={verificationData}
                    onClose={() => setVerificationData(null)}
                    onConfirm={handleConfirmUpdate}
                />
            )}
        </div>
    );
};
