import React, { useState, useRef, useMemo, useEffect } from 'react';
import { BuildingIcon, CloseIcon, PlusIcon, SparklesIcon, TrashIcon, DocumentArrowUpIcon, SpinnerIcon, MapPinIcon, CheckCircleIcon, SpinnerIconSmall, GpsFixedIcon } from './Icons';
import { Project, HousingUnit, PlsCategoryTemplate, ScheduleStage, ImportMetadata } from '../types';
import { extractDataFromFRE, ExtractedFreData, extractPlsFromBudgetFile, extractDataFromScheduleFile } from '../services/geminiService';
import toast from 'react-hot-toast';


type ProjectCreationData = Omit<Project, 'id' | 'progress' | 'created_at' | 'ownerId' | 'members'>;

interface ProjectSetupProps {
  onSetup: (data: ProjectCreationData) => void;
  onCancel: () => void;
}

const initialFormData: Omit<ProjectCreationData, 'pls_data' | 'history' | 'schedule' | 'duration_months' | 'import_metadata'> & { history: [] } = {
  name: '',
  housing_units: [],
  cost_of_works: 0,
  total_enterprise_cost: 0,
  vgv: 0,
  developer: {
    name: '',
    cnpj: '',
  },
  construction_company: {
    name: '',
    cnpj: '',
  },
  address: {
    street: '',
    city: '',
    state: '',
    zip: '',
    latitude: null,
    longitude: null,
  },
  responsible_engineer: {
    name: '',
    crea: '',
    email: '',
  },
  history: [],
};

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
        className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
      />
    </div>
  </div>
);

const validateFreData = (data: ExtractedFreData): string[] => {
    const errors: string[] = [];
    if (!data.projectName?.trim()) errors.push("Nome do Projeto não encontrado.");
    if (!data.costOfWorks || data.costOfWorks <= 0) errors.push("Custo Total das Obras inválido ou não encontrado.");
    if (!data.totalEnterpriseCost || data.totalEnterpriseCost <= 0) errors.push("Custo Total de Empreendimento inválido ou não encontrado.");
    if (data.vgv === undefined || data.vgv < 0) errors.push("VGV inválido ou não encontrado.");
    if (!data.developerName?.trim()) errors.push("Nome do Proponente não encontrado.");
    if (!data.developerCnpj?.trim()) errors.push("CNPJ do Proponente não encontrado.");
    if (!data.constructionCompanyName?.trim()) errors.push("Nome da Construtora não encontrado.");
    if (!data.constructionCompanyCnpj?.trim()) errors.push("CNPJ da Construtora não encontrado.");
    if (!data.addressStreet?.trim()) errors.push("Endereço (Logradouro) não encontrado.");
    if (!data.addressCity?.trim()) errors.push("Endereço (Cidade) não encontrada.");
    if (!data.addressState?.trim()) errors.push("Endereço (Estado/UF) não encontrado.");
    if (!data.addressZip?.trim() || !/^\d{5}-?\d{3}$/.test(data.addressZip)) errors.push("CEP inválido ou não encontrado.");
    if (!data.engineerName?.trim()) errors.push("Nome do Engenheiro Responsável não encontrado.");
    if (!data.engineerCrea?.trim()) errors.push("CREA do Engenheiro não encontrado.");
    if (data.units === undefined || data.units < 0 || !Number.isInteger(data.units)) errors.push("Número de Unidades inválido ou não encontrado.");
    return errors;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}


export const ProjectSetup: React.FC<ProjectSetupProps> = ({ onSetup, onCancel }) => {
  const [formData, setFormData] = useState<Omit<ProjectCreationData, 'pls_data' | 'schedule' | 'duration_months' | 'import_metadata'>>(initialFormData);
  const [customPlsData, setCustomPlsData] = useState<PlsCategoryTemplate[] | null>(null);
  const [scheduleData, setScheduleData] = useState<{ schedule: ScheduleStage[], duration_months: number } | null>(null);
  const [quickGen, setQuickGen] = useState({ prefix: 'Casa', start: 1, end: 64 });
  const [importMetadata, setImportMetadata] = useState<ImportMetadata>({});
  
  const [isImportingFre, setIsImportingFre] = useState(false);
  const [isImportingBudget, setIsImportingBudget] = useState(false);
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);

  const [budgetImportSuccess, setBudgetImportSuccess] = useState(false);
  const [scheduleImportSuccess, setScheduleImportSuccess] = useState(false);
  
  const freFileInputRef = useRef<HTMLInputElement>(null);
  const budgetFileInputRef = useRef<HTMLInputElement>(null);
  const scheduleFileInputRef = useRef<HTMLInputElement>(null);


  const { street, city, state, latitude, longitude } = formData.address || {};

  const fullAddress = useMemo(() => {
    if (street && city && state) {
      return `${street}, ${city}, ${state}`;
    }
    return null;
  }, [street, city, state]);

  const debouncedAddress = useDebounce(fullAddress, 1000);

  const mapQuery = useMemo(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        return `${latitude},${longitude}`;
    }
    return debouncedAddress;
  }, [latitude, longitude, debouncedAddress]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const keys = name.split('.');

    if (keys.length > 1) {
        const [mainKey, subKey] = keys as [keyof ProjectCreationData, string];
        setFormData(prev => ({
            ...prev,
            [mainKey]: {
                // Ensure the parent object exists before spreading it
                ...(typeof prev[mainKey] === 'object' && prev[mainKey] !== null ? prev[mainKey] : {}),
                [subKey]: value,
            },
        }));
    } else if (name === 'cost_of_works' || name === 'total_enterprise_cost' || name === 'vgv') {
        setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.housing_units.length > 0 && formData.cost_of_works > 0) {
      onSetup({
          ...formData,
          pls_data: customPlsData,
          schedule: scheduleData?.schedule,
          duration_months: scheduleData?.duration_months,
          import_metadata: importMetadata,
      });
    }
  };
  
  const applyExtractedProjectData = (extractedData: Partial<ExtractedFreData>) => {
     const updatedFormData = {
        ...formData,
        name: extractedData.projectName || formData.name,
        cost_of_works: typeof extractedData.costOfWorks === 'number' ? extractedData.costOfWorks : formData.cost_of_works,
        total_enterprise_cost: typeof extractedData.totalEnterpriseCost === 'number' ? extractedData.totalEnterpriseCost : formData.total_enterprise_cost,
        vgv: typeof extractedData.vgv === 'number' ? extractedData.vgv : formData.vgv,
        developer: {
            name: extractedData.developerName || formData.developer?.name || '',
            cnpj: extractedData.developerCnpj || formData.developer?.cnpj || '',
        },
        construction_company: {
            name: extractedData.constructionCompanyName || formData.construction_company?.name || '',
            cnpj: extractedData.constructionCompanyCnpj || formData.construction_company?.cnpj || '',
        },
        address: {
          street: extractedData.addressStreet || formData.address?.street || '',
          city: extractedData.addressCity || formData.address?.city || '',
          state: extractedData.addressState || formData.address?.state || '',
          zip: extractedData.addressZip || formData.address?.zip || '',
          latitude: formData.address?.latitude || null,
          longitude: formData.address?.longitude || null,
        },
        responsible_engineer: {
          name: extractedData.engineerName || formData.responsible_engineer?.name || '',
          crea: extractedData.engineerCrea || formData.responsible_engineer?.crea || '',
          email: extractedData.engineerEmail || formData.responsible_engineer?.email || '',
        },
        housing_units: formData.housing_units, // Keep existing units unless specified
      };

      if (extractedData.units && extractedData.units > 0 && updatedFormData.housing_units.length === 0) {
          const newUnits: HousingUnit[] = [];
          const padLength = String(extractedData.units).length;
          const prefix = "Casa";

          for (let i = 1; i <= extractedData.units; i++) {
              const number = String(i).padStart(padLength > 1 ? padLength : 2, '0');
              newUnits.push({
                  id: `unit_${Date.now()}_${i}`,
                  name: `${prefix} ${number}`.trim()
              });
          }
          updatedFormData.housing_units = newUnits;
      }
      setFormData(updatedFormData);
  }

  const handleImportFreClick = () => {
    freFileInputRef.current?.click();
  }
  
  const handleFreFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingFre(true);
    
    const promise = extractDataFromFRE(file);

    toast.promise(promise, {
        loading: 'Analisando FRE com a IA...',
        success: (extractedData) => {
            if (extractedData) {
                // Clean the CEP before validation to handle formats like "85.859-385"
                if (extractedData.addressZip) {
                    // Remove all non-digit characters
                    const cleanedZip = extractedData.addressZip.replace(/[^\d]/g, '');
                    // Reformat to ddddd-ddd if it has 8 digits
                    if (cleanedZip.length === 8) {
                        extractedData.addressZip = `${cleanedZip.slice(0, 5)}-${cleanedZip.slice(5)}`;
                    } else {
                        // Let validation catch other cases, just pass the cleaned string
                        extractedData.addressZip = cleanedZip;
                    }
                }
                const validationErrors = validateFreData(extractedData);
                if (validationErrors.length > 0) {
                    const errorHtml = `Dados extraídos, mas inválidos:<br/>- ${validationErrors.join('<br/>- ')}`;
                    toast.error(<div>{errorHtml}</div>, { duration: 6000 });
                    throw new Error('Validation failed');
                }
                applyExtractedProjectData(extractedData);
                setImportMetadata(prev => ({...prev, fre_imported_at: new Date().toISOString() }));
                return 'Dados da FRE importados com sucesso!';
            }
            throw new Error("Não foi possível extrair dados da FRE.");
        },
        error: (error) => {
            console.error("FRE Import failed:", error);
            if (error.message.includes('Validation failed')) {
                return 'Falha na validação dos dados. Verifique o documento.';
            }
            return `Falha ao importar FRE: ${error.message}`;
        }
    });
    
    try {
      await promise;
    } catch (error) {
      // Errors are handled by the toast
    } finally {
        setIsImportingFre(false);
        if(freFileInputRef.current) freFileInputRef.current.value = "";
    }
  }

  const handleImportBudgetClick = () => {
    budgetFileInputRef.current?.click();
  };

  const handleBudgetFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImportingBudget(true);
      setBudgetImportSuccess(false);

      const promise = extractPlsFromBudgetFile(file);
      toast.promise(promise, {
          loading: 'Analisando orçamento com a IA...',
          success: (plsData) => {
              if (plsData && plsData.length > 0) {
                  setCustomPlsData(plsData);
                  setBudgetImportSuccess(true);
                  setImportMetadata(prev => ({ ...prev, pls_imported_at: new Date().toISOString() }));
                  return 'Orçamento importado e PLS criada!';
              }
              throw new Error("Não foi possível extrair dados da PLS do arquivo.");
          },
          error: (err) => `Falha ao importar: ${err.message}`
      });

      try {
          await promise;
      } catch (e) {
          // Errors handled by toast
      } finally {
          setIsImportingBudget(false);
          if (budgetFileInputRef.current) budgetFileInputRef.current.value = "";
      }
  };

  const handleImportScheduleClick = () => {
    scheduleFileInputRef.current?.click();
  };

  const handleScheduleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImportingSchedule(true);
      setScheduleImportSuccess(false);

      const promise = extractDataFromScheduleFile(file);
      toast.promise(promise, {
          loading: 'Analisando cronograma com a IA...',
          success: (extractedData) => {
              if (extractedData) {
                  const { projectDetails, scheduleDetails } = extractedData;
                  
                  // The applyExtractedProjectData function is smart enough to not overwrite
                  // existing valid data with null values from the schedule file.
                  applyExtractedProjectData(projectDetails);
                  setScheduleData(scheduleDetails);
                  setScheduleImportSuccess(true);
                  setImportMetadata(prev => ({ ...prev, schedule_imported_at: new Date().toISOString() }));
                  return 'Cronograma importado com sucesso!';
              }
              throw new Error("Não foi possível extrair dados do cronograma.");
          },
          error: (err) => `Falha ao importar: ${err.message}`
      });

      try {
          await promise;
      } catch (e) {
          // Errors handled by toast
      } finally {
          setIsImportingSchedule(false);
          if (scheduleFileInputRef.current) scheduleFileInputRef.current.value = "";
      }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
        toast.error('Geolocalização não é suportada por este navegador.');
        return;
    }

    const toastId = toast.loading('Obtendo sua localização...');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            setFormData(prev => ({
                ...prev,
                address: {
                    ...(prev.address || {}),
                    latitude: latitude,
                    longitude: longitude,
                } as Project['address'],
            }));
            toast.success('Localização atualizada!', { id: toastId });
        },
        (error) => {
            let errorMessage = 'Não foi possível obter a localização.';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permissão de localização negada.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Informação de localização indisponível.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'A solicitação de localização expirou.';
                    break;
            }
            toast.error(errorMessage, { id: toastId });
        }
    );
  };


  const isImporting = isImportingFre || isImportingBudget || isImportingSchedule;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl relative max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-6 border-b dark:border-slate-700 flex justify-between items-start">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50">
                   <BuildingIcon />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                        Configurar Novo Projeto
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                        Insira os detalhes do empreendimento para iniciar a PLS.
                    </p>
                </div>
            </div>
             <button onClick={onCancel} className="p-2 -mt-2 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
                <CloseIcon />
            </button>
        </header>
        
        <form className="overflow-y-auto relative" onSubmit={handleSubmit}>
            {isImporting && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 flex flex-col items-center justify-center z-10 rounded-b-2xl">
                    <SpinnerIcon />
                    <p className="mt-2 font-semibold text-slate-700 dark:text-slate-200">
                        {isImportingFre ? 'Analisando FRE...' : isImportingBudget ? 'Analisando Orçamento...' : 'Analisando Cronograma...'}
                    </p>
                    <p className="text-sm text-slate-500">Isso pode levar alguns segundos.</p>
                </div>
            )}
            <div className="p-6">
                <div className="space-y-3 mb-6">
                    <input type="file" accept="image/*,application/pdf,.xls,.xlsx" ref={freFileInputRef} onChange={handleFreFileSelect} className="hidden" />
                    <button
                        type="button"
                        onClick={handleImportFreClick}
                        disabled={isImporting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/50 border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        {isImportingFre ? <SpinnerIconSmall /> : <DocumentArrowUpIcon />}
                        Importar FRE para preencher automaticamente
                    </button>
                    
                     <input type="file" accept="image/*,application/pdf,.xls,.xlsx" ref={budgetFileInputRef} onChange={handleBudgetFileSelect} className="hidden" />
                     <button
                        type="button"
                        onClick={handleImportBudgetClick}
                        disabled={isImporting}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/50 border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImportingBudget ? <SpinnerIconSmall /> : <DocumentArrowUpIcon />}
                        <div className="text-left">
                            <span className="font-semibold">Importar Orçamento Sintético</span>
                            <span className="block text-xs font-normal">Use o sintético para criar a estrutura da PLS com base nas incidências do seu orçamento. Ex: 01-ORCS-Hab_v015.C_-_Cond...pdf</span>
                        </div>
                    </button>

                    <input type="file" accept="image/*,application/pdf,.xls,.xlsx" ref={scheduleFileInputRef} onChange={handleScheduleFileSelect} className="hidden" />
                    <button
                        type="button"
                        onClick={handleImportScheduleClick}
                        disabled={isImporting}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/50 border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImportingSchedule ? <SpinnerIconSmall /> : <DocumentArrowUpIcon />}
                        <div className="text-left">
                            <span className="font-semibold">Importar Cronograma Físico-Financeiro</span>
                            <span className="block text-xs font-normal">Importe o cronograma para preencher automaticamente os dados do projeto e o planejamento das etapas. Ex: 01-CRO-Hab_v015.C_-_Cond...pdf</span>
                        </div>
                    </button>
                </div>
                
                 {budgetImportSuccess && (
                  <div className="my-4 p-3 bg-emerald-50 dark:bg-emerald-900/50 border-l-4 border-emerald-400 dark:border-emerald-600 flex items-center gap-3" role="alert">
                      <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">Orçamento e itens da PLS importados com sucesso!</p>
                  </div>
                )}

                 {scheduleImportSuccess && (
                  <div className="my-4 p-3 bg-emerald-50 dark:bg-emerald-900/50 border-l-4 border-emerald-400 dark:border-emerald-600 flex items-center gap-3" role="alert">
                      <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">Cronograma Físico-Financeiro importado com sucesso!</p>
                  </div>
                )}
                

                <div className="space-y-6">
                    <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Detalhes do Projeto</legend>
                        <FormInput label="Nome do Projeto" id="name" value={formData.name} onChange={handleChange} />
                        <div />
                        <FormInput label="Custo Total da Obra (R$)" id="cost_of_works" value={formData.cost_of_works || ''} onChange={handleChange} type="number" step="0.01" />
                        <FormInput label="Custo Total de Empreendimento (R$)" id="total_enterprise_cost" value={formData.total_enterprise_cost || ''} onChange={handleChange} type="number" step="0.01" />
                        <div className="md:col-span-2">
                            <FormInput label="VGV (R$)" id="vgv" value={formData.vgv || ''} onChange={handleChange} type="number" step="0.01" />
                        </div>
                    </fieldset>

                    <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Proponente</legend>
                        <FormInput label="Nome do Proponente" id="developer.name" value={formData.developer?.name || ''} onChange={handleChange} />
                        <FormInput label="CPF/CNPJ" id="developer.cnpj" value={formData.developer?.cnpj || ''} onChange={handleChange} />
                    </fieldset>

                     <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Construtora</legend>
                        <FormInput label="Nome da Construtora" id="construction_company.name" value={formData.construction_company?.name || ''} onChange={handleChange} />
                        <FormInput label="CPF/CNPJ" id="construction_company.cnpj" value={formData.construction_company?.cnpj || ''} onChange={handleChange} />
                    </fieldset>
                    
                    <fieldset className="col-span-full">
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200">Unidades Habitacionais</legend>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">Adicione e nomeie cada unidade do projeto.</p>
                        
                         <div className="mt-4 p-3 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                <SparklesIcon />
                                <span>Geração Rápida</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <input name="prefix" value={quickGen.prefix} onChange={handleQuickGenChange} placeholder="Prefixo (ex: Casa)" className="sm:col-span-2 appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
                                <input name="start" type="number" value={quickGen.start} onChange={handleQuickGenChange} placeholder="De" className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
                                <input name="end" type="number" value={quickGen.end} onChange={handleQuickGenChange} placeholder="Até" className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm" />
                            </div>
                            <button type="button" onClick={handleQuickGenerate} className="mt-3 w-full sm:w-auto px-4 py-2 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-all duration-200 text-sm font-medium">
                                Gerar Unidades
                            </button>
                        </div>

                        <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-2 rounded-md border dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                            {formData.housing_units.map((unit, index) => (
                                <div key={unit.id} className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={unit.name}
                                        onChange={(e) => handleUnitNameChange(unit.id, e.target.value)}
                                        placeholder={`Nome da Unidade ${index + 1}`}
                                        className="flex-grow appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-200 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                                    />
                                    <button type="button" onClick={() => handleRemoveUnit(unit.id)} className="text-rose-500 hover:text-rose-700 p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50" disabled={formData.housing_units.length < 1}>
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                             {formData.housing_units.length === 0 && <p className="text-center text-sm text-slate-500">Adicione pelo menos uma unidade.</p>}
                        </div>
                        <button type="button" onClick={handleAddUnit} className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">
                            <PlusIcon />
                            Adicionar Unidade Manualmente
                        </button>
                    </fieldset>

                     <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200">Endereço</legend>
                        <div className="md:col-span-2">
                            <FormInput label="Logradouro" id="address.street" value={formData.address?.street || ''} onChange={handleChange} />
                        </div>
                        <FormInput label="Cidade" id="address.city" value={formData.address?.city || ''} onChange={handleChange} />
                        <FormInput label="Estado" id="address.state" value={formData.address?.state || ''} onChange={handleChange} />
                         <FormInput label="CEP" id="address.zip" value={formData.address?.zip || ''} onChange={handleChange} />
                         <FormInput label="Latitude" id="address.latitude" value={formData.address?.latitude ?? ''} onChange={handleChange} type="number" step="any" required={false} />
                         <FormInput label="Longitude" id="address.longitude" value={formData.address?.longitude ?? ''} onChange={handleChange} type="number" step="any" required={false} />
                    </fieldset>
                    
                    <fieldset>
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <MapPinIcon />
                                <span>Localização no Mapa</span>
                            </div>
                             <button
                                type="button"
                                onClick={handleGetCurrentLocation}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                            >
                                <GpsFixedIcon />
                                Usar Localização Atual
                            </button>
                        </legend>
                        <div className="mt-3 h-64 w-full bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                            {mapQuery ? (
                                <iframe
                                    title="Project Location Map"
                                    width="100%"
                                    height="100%"
                                    className="border-0"
                                    loading="lazy"
                                    key={mapQuery}
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=k&z=17&ie=UTF8&iwloc=A&output=embed`}
                                ></iframe>
                            ) : (
                                <p className="text-sm text-slate-500 px-4 text-center">Preencha o endereço ou as coordenadas para visualizar o mapa.</p>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Para ajustar a posição exata, altere os campos de Latitude e Longitude. O pino no mapa será atualizado.</p>
                    </fieldset>

                     <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <legend className="text-lg font-medium text-gray-900 dark:text-slate-200 col-span-full">Responsável Técnico</legend>
                        <FormInput label="Nome do Engenheiro" id="responsible_engineer.name" value={formData.responsible_engineer?.name || ''} onChange={handleChange} />
                        <FormInput label="Nº CREA" id="responsible_engineer.crea" value={formData.responsible_engineer?.crea || ''} onChange={handleChange} />
                        <div className="md:col-span-2">
                           <FormInput label="E-mail" id="responsible_engineer.email" type="email" value={formData.responsible_engineer?.email || ''} onChange={handleChange} />
                        </div>
                    </fieldset>
                </div>
                <div className="mt-8 pt-5 border-t dark:border-slate-700">
                    <div className="flex justify-end">
                        <button type="button" onClick={onCancel} className="bg-white dark:bg-slate-700 py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600">
                            Cancelar
                        </button>
                        <button type="submit" className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50" disabled={isImporting}>
                            Criar Projeto
                        </button>
                    </div>
                </div>
            </div>
        </form>
      </div>
    </div>
  );
};