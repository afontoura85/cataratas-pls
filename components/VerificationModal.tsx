/**
 * @file Componente `VerificationModal` que exibe uma comparação lado a lado
 * entre os dados atuais do projeto e os novos dados extraídos de um documento.
 * Permite que o usuário revise as alterações antes de confirmar a atualização.
 */
import React from 'react';
import { CloseIcon } from './Icons';
import { Project, PlsCategoryTemplate, ScheduleStage } from '../types';
import { ExtractedFreData, ExtractedScheduleData } from '../services/geminiService';

/**
 * @typedef {object} VerificationData
 * @property {'fre' | 'pls' | 'schedule'} type - O tipo de documento sendo verificado.
 * @property {any} newData - Os novos dados extraídos para comparação.
 */
type VerificationData = {
    type: 'fre' | 'pls' | 'schedule';
    newData: any;
};

/**
 * @typedef {object} VerificationModalProps
 * @property {Project} project - O estado atual do projeto.
 * @property {VerificationData} data - Os novos dados e o tipo de documento para verificação.
 * @property {() => void} onClose - Callback para fechar o modal.
 * @property {(newData: any) => void} onConfirm - Callback para confirmar e aplicar as novas atualizações.
 */
interface VerificationModalProps {
    project: Project;
    data: VerificationData;
    onClose: () => void;
    onConfirm: (newData: any) => void;
}

/**
 * Renderiza uma linha em uma tabela de comparação, destacando visualmente se o valor mudou.
 * @param {object} props - Propriedades do componente.
 * @param {string} props.label - O rótulo do campo.
 * @param {any} props.oldValue - O valor antigo.
 * @param {any} props.newValue - O novo valor.
 * @returns {React.ReactElement} A linha da tabela.
 */
const DiffRow: React.FC<{ label: string; oldValue: any; newValue: any }> = ({ label, oldValue, newValue }) => {
    const hasChanged = String(oldValue) !== String(newValue);
    return (
        <tr className={hasChanged ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
            <td className="px-4 py-2 font-medium text-sm text-slate-600 dark:text-slate-300 border-b dark:border-slate-200 dark:border-slate-700">{label}</td>
            <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 border-b dark:border-slate-200 dark:border-slate-700">{String(oldValue)}</td>
            <td className={`px-4 py-2 text-sm border-b dark:border-slate-200 dark:border-slate-700 ${hasChanged ? 'font-bold text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>
                {String(newValue)}
            </td>
        </tr>
    );
};

/**
 * Componente específico para verificar as diferenças nos dados da FRE.
 * @param {object} props - Propriedades do componente.
 * @param {Project} props.oldData - Os dados atuais do projeto.
 * @param {ExtractedFreData} props.newData - Os novos dados extraídos do FRE.
 * @returns {React.ReactElement} A tabela de comparação do FRE.
 */
const FreVerifier: React.FC<{ oldData: Project; newData: ExtractedFreData }> = ({ oldData, newData }) => {
    const fields: { label: string; oldValue: any; newValue: any }[] = [
        { label: 'Nome do Projeto', oldValue: oldData.name, newValue: newData.projectName },
        { label: 'Custo da Obra', oldValue: oldData.cost_of_works, newValue: newData.costOfWorks },
        { label: 'Custo do Empreendimento', oldValue: oldData.total_enterprise_cost, newValue: newData.totalEnterpriseCost },
        { label: 'VGV', oldValue: oldData.vgv, newValue: newData.vgv },
        { label: 'Proponente', oldValue: oldData.developer.name, newValue: newData.developerName },
        { label: 'CNPJ Proponente', oldValue: oldData.developer.cnpj, newValue: newData.developerCnpj },
        { label: 'Construtora', oldValue: oldData.construction_company.name, newValue: newData.constructionCompanyName },
        { label: 'CNPJ Construtora', oldValue: oldData.construction_company.cnpj, newValue: newData.constructionCompanyCnpj },
        { label: 'Endereço', oldValue: oldData.address.street, newValue: newData.addressStreet },
        { label: 'Cidade', oldValue: oldData.address.city, newValue: newData.addressCity },
        { label: 'Engenheiro', oldValue: oldData.responsible_engineer.name, newValue: newData.engineerName },
        { label: 'CREA', oldValue: oldData.responsible_engineer.crea, newValue: newData.engineerCrea },
    ];

    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border-b-2 dark:border-slate-600">Campo</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border-b-2 dark:border-slate-600">Valor Atual</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border-b-2 dark:border-slate-600">Novo Valor</th>
                </tr>
            </thead>
            <tbody>
                {fields.map(f => <DiffRow key={f.label} {...f} />)}
            </tbody>
        </table>
    );
};

/**
 * Componente específico para verificar as diferenças na estrutura da PLS.
 * @param {object} props - Propriedades do componente.
 * @param {PlsCategoryTemplate[] | null} props.oldData - A estrutura de PLS atual.
 * @param {PlsCategoryTemplate[]} props.newData - A nova estrutura de PLS proposta.
 * @returns {React.ReactElement} A visualização de comparação da PLS.
 */
const PlsVerifier: React.FC<{ oldData: PlsCategoryTemplate[] | null; newData: PlsCategoryTemplate[] }> = ({ oldData, newData }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <h4 className="font-semibold mb-2">Estrutura Atual</h4>
            <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded-md max-h-96 overflow-auto">
                {JSON.stringify(oldData, null, 2) || 'Nenhuma estrutura de PLS personalizada definida.'}
            </pre>
        </div>
        <div>
            <h4 className="font-semibold mb-2 text-amber-700 dark:text-amber-300">Nova Estrutura Proposta</h4>
            <pre className="text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md max-h-96 overflow-auto">
                {JSON.stringify(newData, null, 2)}
            </pre>
        </div>
    </div>
);

/**
 * Componente específico para verificar as diferenças nos dados do Cronograma.
 * @param {object} props - Propriedades do componente.
 * @param {Project} props.oldData - Os dados atuais do projeto.
 * @param {ExtractedScheduleData} props.newData - Os novos dados extraídos do cronograma.
 * @returns {React.ReactElement} A tabela de comparação do cronograma.
 */
const ScheduleVerifier: React.FC<{ oldData: Project; newData: ExtractedScheduleData }> = ({ oldData, newData }) => (
    <div className="space-y-4">
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border-b-2 dark:border-slate-600">Campo</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border-b-2 dark:border-slate-600">Valor Atual</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 border-b-2 dark:border-slate-600">Novo Valor</th>
                </tr>
            </thead>
            <tbody>
                <DiffRow label="Duração (meses)" oldValue={oldData.duration_months || 'N/A'} newValue={newData.scheduleDetails.duration_months} />
            </tbody>
        </table>
        <p className="text-sm text-slate-500">O cronograma completo será substituído.</p>
    </div>
);

/**
 * Modal para que o usuário revise e confirme as alterações extraídas de um documento antes de aplicá-las ao projeto.
 * @param {VerificationModalProps} props As propriedades do componente.
 * @returns {React.ReactElement} O modal de verificação.
 */
export const VerificationModal: React.FC<VerificationModalProps> = ({ project, data, onClose, onConfirm }) => {

    const renderVerificationContent = () => {
        switch (data.type) {
            case 'fre':
                return <FreVerifier oldData={project} newData={data.newData as ExtractedFreData} />;
            case 'pls':
                return <PlsVerifier oldData={project.pls_data} newData={data.newData as PlsCategoryTemplate[]} />;
            case 'schedule':
                 return <ScheduleVerifier oldData={project} newData={data.newData as ExtractedScheduleData} />;
            default:
                return <p>Tipo de verificação não reconhecido.</p>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                            Verificar Alterações - {data.type.toUpperCase()}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                            Revise os dados extraídos do novo documento. As alterações estão destacadas.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                        <CloseIcon />
                    </button>
                </header>

                <main className="flex-grow p-6 overflow-y-auto">
                    {renderVerificationContent()}
                </main>

                <footer className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600">
                        Cancelar
                    </button>
                    <button type="button" onClick={() => onConfirm(data.newData)} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700">
                        Confirmar Atualização
                    </button>
                </footer>
            </div>
        </div>
    );
};
