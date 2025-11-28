/**
 * @file Componente `GeneralSettings` que renderiza a aba "Geral" dentro do modal de configurações do projeto.
 * Permite a edição dos detalhes principais do projeto, como nome, custos, empresas envolvidas e unidades habitacionais.
 */
import React, { useState } from 'react';
import { Project, HousingUnit } from '../types';
import { PlusIcon, TrashIcon, SparklesIcon } from './Icons';

/**
 * Componente de input reutilizável com rótulo, estilizado para formulários.
 * @param {object} props - Propriedades do componente.
 * @returns {React.ReactElement} O campo de input renderizado.
 */
const FormInput: React.FC<{label: string, id: string, value: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, type?: string, required?: boolean, min?: number, step?: string | number}> = 
  ({label, id, value, onChange, type = 'text', required = true, min, step}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-slate-300">
      {label}
    </label>
    <div className="mt-1">
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        min={min}
        step={step}
        className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
    </div>
  </div>
);

/**
 * @typedef {object} GeneralSettingsProps
 * @property {Project} formData - O estado atual do formulário do projeto.
 * @property {React.Dispatch<React.SetStateAction<Project>>} setFormData - Função para atualizar o estado do formulário.
 * @property {() => void} onDelete - Callback para acionar a exclusão do projeto.
 */
interface GeneralSettingsProps {
    formData: Project;
    setFormData: React.Dispatch<React.SetStateAction<Project>>;
    onDelete: () => void;
}

/**
 * Renderiza o formulário para edição das configurações gerais do projeto.
 * @param {GeneralSettingsProps} props As propriedades do componente.
 * @returns {React.ReactElement} A aba de configurações gerais.
 */
export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ formData, setFormData, onDelete }) => {
  const [quickGen, setQuickGen] = useState({ prefix: 'Casa', start: 1, end: 10 });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const keys = name.split('.');

    if (keys.length > 1) {
        const [mainKey, subKey] = keys as [keyof Project, string];
        setFormData(prev => ({
            ...prev,
            [mainKey]: {
                ...((typeof prev[mainKey] === 'object' && prev[mainKey] !== null ? prev[mainKey] : {}) as object),
                [subKey]: value,
            },
        }));
    } else if (name === 'cost_of_works' || name === 'total_enterprise_cost' || name === 'vgv') {
        const numericValue = parseFloat(value.replace(',', '.')) || 0;
        setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else if (name === 'name') {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleAddUnit = () => {
    setFormData(prev => ({
        ...prev,
        housing_units: [
            ...prev.housing_units,
            { id: `unit_${Date.now()}`, name: `Unidade ${prev.housing_units.length + 1}` }
        ]
    }));
  };

  const handleRemoveUnit = (id: string) => {
      setFormData(prev => ({
          ...prev,
          housing_units: prev.housing_units.filter(unit => unit.id !== id)
      }));
  };

  const handleUnitNameChange = (id: string, newName: string) => {
      setFormData(prev => ({
          ...prev,
          housing_units: prev.housing_units.map(unit =>
              unit.id === id ? { ...unit, name: newName } : unit
          )
      }));
  };

  const handleQuickGenerate = () => {
    if (quickGen.start > quickGen.end) return;
    const newUnits: HousingUnit[] = [];
    const padLength = String(quickGen.end).length;

    for (let i = quickGen.start; i <= quickGen.end; i++) {
        const number = String(i).padStart(padLength > 1 ? padLength : 2, '0');
        newUnits.push({
            id: `unit_${Date.now()}_${i}`,
            name: `${quickGen.prefix} ${number}`.trim()
        });
    }

    setFormData(prev => ({
        ...prev,
        housing_units: [...prev.housing_units, ...newUnits]
    }));
  }

  const handleQuickGenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type } = e.target;
      setQuickGen(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) || 0 : value }));
  }
  
  return (
    <div className="space-y-6">
        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Detalhes do Projeto</legend>
            <FormInput label="Nome do Projeto" id="name" value={formData?.name} onChange={handleChange} />
            <div />
            <FormInput label="Custo Total da Obra (R$)" id="cost_of_works" value={formData?.cost_of_works} onChange={handleChange} type="number" min={1} step="0.01" />
            <FormInput label="Custo Total de Empreendimento (R$)" id="total_enterprise_cost" value={formData?.total_enterprise_cost} onChange={handleChange} type="number" min={1} step="0.01" />
            <div className="md:col-span-2">
                <FormInput label="VGV (R$)" id="vgv" value={formData?.vgv} onChange={handleChange} type="number" min={1} step="0.01" />
            </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Proponente</legend>
            <FormInput label="Nome" id="developer.name" value={formData?.developer?.name || ''} onChange={handleChange} />
            <FormInput label="CPF/CNPJ" id="developer.cnpj" value={formData?.developer?.cnpj || ''} onChange={handleChange} />
        </fieldset>

        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Construtora</legend>
            <FormInput label="Nome" id="construction_company.name" value={formData?.construction_company?.name || ''} onChange={handleChange} />
            <FormInput label="CPF/CNPJ" id="construction_company.cnpj" value={formData?.construction_company?.cnpj || ''} onChange={handleChange} />
        </fieldset>

        <fieldset className="col-span-full">
            <legend className="text-lg font-medium text-gray-900 dark:text-slate-200">Unidades Habitacionais</legend>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">Adicione, remova ou renomeie as unidades do projeto.</p>
            
            <div className="mt-4 p-3 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    <SparklesIcon />
                    <span>Geração Rápida</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input name="prefix" value={quickGen.prefix} onChange={handleQuickGenChange} placeholder="Prefixo (ex: Casa)" className="sm:col-span-2 appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    <input name="start" type="number" value={quickGen.start} onChange={handleQuickGenChange} placeholder="De" className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    <input name="end" type="number" value={quickGen.end} onChange={handleQuickGenChange} placeholder="Até" className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <button type="button" onClick={handleQuickGenerate} className="mt-3 w-full sm:w-auto px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all duration-200 text-sm font-medium">
                    Gerar Unidades
                </button>
            </div>

            <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-2 rounded-md border dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                {formData?.housing_units.map((unit, index) => (
                    <div key={unit.id} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={unit.name}
                            onChange={(e) => handleUnitNameChange(unit.id, e.target.value)}
                            placeholder={`Nome da Unidade ${index + 1}`}
                            className="flex-grow appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                        <button type="button" onClick={() => handleRemoveUnit(unit.id)} className="text-rose-500 hover:text-rose-700 p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50" disabled={formData?.housing_units.length <= 1}>
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                {formData?.housing_units.length === 0 && <p className="text-center text-sm text-slate-500">O projeto deve ter pelo menos uma unidade.</p>}
            </div>
            <button type="button" onClick={handleAddUnit} className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                <PlusIcon />
                Adicionar Unidade Manualmente
            </button>
        </fieldset>
        
         <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Endereço</legend>
            <div className="md:col-span-2">
                <FormInput label="Logradouro" id="address.street" value={formData?.address?.street || ''} onChange={handleChange} />
            </div>
            <FormInput label="Cidade" id="address.city" value={formData?.address?.city || ''} onChange={handleChange} />
            <FormInput label="Estado" id="address.state" value={formData?.address?.state || ''} onChange={handleChange} />
             <FormInput label="CEP" id="address.zip" value={formData?.address?.zip || ''} onChange={handleChange} />
        </fieldset>

         <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Responsável Técnico</legend>
            <FormInput label="Nome do Engenheiro" id="responsible_engineer.name" value={formData?.responsible_engineer?.name || ''} onChange={handleChange} />
            <FormInput label="Nº CREA" id="responsible_engineer.crea" value={formData?.responsible_engineer?.crea || ''} onChange={handleChange} />
            <div className="md:col-span-2">
                <FormInput label="E-mail" id="responsible_engineer.email" type="email" value={formData?.responsible_engineer?.email || ''} onChange={handleChange} />
            </div>
        </fieldset>

        <fieldset className="pt-6 border-t border-rose-500/30">
            <legend className="text-lg font-medium text-rose-600 dark:text-rose-400">Zona de Perigo</legend>
            <div className="mt-4 p-4 rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/40">
                <div className="flex items-start justify-between">
                    <div>
                        <h4 className="font-semibold text-rose-800 dark:text-rose-200">Excluir este projeto</h4>
                        <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                            Uma vez que você exclui um projeto, não há como voltar atrás. Tenha certeza absoluta.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="ml-4 flex-shrink-0 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 dark:bg-rose-700 dark:hover:bg-rose-800"
                    >
                        Deletar este Projeto
                    </button>
                </div>
            </div>
        </fieldset>
    </div>
  )
}
