/**
 * @file Define o contexto global de gerenciamento de estado para os projetos.
 * Utiliza o padrão `useReducer` para uma manipulação de estado previsível e centralizada.
 * Este provedor encapsula toda a lógica de negócio para carregar, criar, atualizar e
 * excluir projetos, bem como para calcular dados derivados como o resumo financeiro.
 */
import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import * as projectService from '../services/projectService';
import { 
    Project, ServiceCategory, ProgressMatrix, Financials, CategoryFinancials, 
    PlsCategoryTemplate, ProgressLog, AssistantProgressUpdate, ArchivedReport, LayoutTemplate
} from '../types';
import { PLS_TEMPLATE } from '../constants';
import { useAuth } from '../hooks/useAuth';

// --- STATE AND ACTION TYPES ---

/**
 * A forma do estado global gerenciado pelo `ProjectContext`.
 */
interface ProjectState {
    /** A lista de todos os projetos do usuário. */
    projects: Project[];
    /** O ID do projeto atualmente selecionado para visualização/edição. */
    activeProjectId: string | null;
    /** Sinalizador que indica se os projetos estão sendo carregados do Firestore. */
    isLoadingProjects: boolean;
}

/**
 * Define todas as ações possíveis que podem ser despachadas para o `projectReducer`.
 */
type Action =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_PROJECTS'; payload: Project[] }
    | { type: 'SET_ACTIVE_PROJECT_ID'; payload: string | null }
    | { type: 'ADD_PROJECT'; payload: Project }
    | { type: 'UPDATE_PROJECT'; payload: Project }
    | { type: 'DELETE_PROJECT'; payload: string };

/**
 * A forma completa do valor fornecido pelo `ProjectContext`.
 * Inclui o estado e todas as funções de ação para manipulá-lo.
 */
interface ProjectContextType extends ProjectState {
    /** O objeto de projeto ativo completo. */
    activeProject: Project | null;
    /** A estrutura de serviços (PLS) calculada dinamicamente para o projeto ativo. */
    dynamicPlsData: ServiceCategory[];
    /** O resumo financeiro calculado para o projeto ativo. */
    projectFinancials: Financials;
    /** Define o projeto ativo pelo seu ID. */
    setActiveProjectId: (id: string | null) => void;
    /** Cria um novo projeto. */
    createProject: (projectData: Omit<Project, 'id' | 'progress' | 'created_at' | 'ownerId' | 'members'>) => void;
    /** Atualiza um projeto existente. */
    updateProject: (updatedProject: Project) => void;
    /** Exclui um projeto. */
    deleteProject: (id: string) => void;
    /** Atualiza o progresso de um serviço em todas as unidades (edição em lote). */
    updateProgress: (itemId: string, newProgress: number[]) => void;
    /** Atualiza o progresso de um serviço em uma única unidade. */
    updateSingleProgress: (itemId: string, unitIndex: number, newProgress: number) => void;
    /** Processa e aplica atualizações de progresso solicitadas pelo assistente de IA. */
    updateProgressFromAssistant: (updates: AssistantProgressUpdate[]) => string;
    /** Salva uma nova estrutura de PLS personalizada para o projeto. */
    savePls: (newPlsData: PlsCategoryTemplate[]) => void;
    /** Salva os layouts de relatório personalizados. */
    saveLayouts: (layouts: LayoutTemplate[]) => void;
    /** Atualiza o nome de um item de serviço. */
    updateItemName: (categoryId: string, itemId: string, newName: string) => void;
    /** Arquiva um novo relatório no histórico do projeto. */
    archiveReport: (reportData: Omit<ArchivedReport, 'id'>) => void;
    /** Substitui todos os projetos por um novo conjunto de um backup. */
    overwriteProjects: (projects: Project[]) => Promise<void>;
    /** Adiciona projetos de um backup à lista existente. */
    importProjects: (projects: Project[]) => Promise<void>;
}

// --- HELPER FUNCTION FOR ERRORS ---
/**
 * Analisa um erro do Firestore e retorna uma mensagem amigável para o usuário.
 * Especificamente, detecta erros de permissão e orienta o usuário sobre como corrigi-los.
 * @param {any} error O objeto de erro capturado.
 * @param {string} defaultMessage A mensagem a ser exibida para outros tipos de erro.
 * @returns {string} A mensagem de erro formatada.
 */
const handleFirestoreError = (error: any, defaultMessage: string): string => {
    console.error("Firestore Error:", error);
    const errorCode = error?.code;
    const errorMessage = error?.message || '';

    if (errorCode === 'permission-denied' || errorMessage.includes('permission-denied') || errorMessage.includes('Missing or insufficient permissions')) {
        return "Permissão Negada: Verifique as regras de segurança do seu Firestore. A criação/leitura de projetos pode não estar permitida para seu usuário.";
    }

    if (errorCode === 'failed-precondition' && errorMessage.includes('index')) {
        return "Índice do Banco de Dados Ausente: O Firestore requer um índice para esta consulta. Verifique o console do desenvolvedor do navegador (F12) para um link direto para criá-lo.";
    }
    
    return `${defaultMessage}: ${errorMessage || 'Erro desconhecido.'}`;
};

// --- REDUCER ---

/**
 * Função pura que calcula o próximo estado com base no estado anterior e em uma ação despachada.
 * @param {ProjectState} state O estado atual.
 * @param {Action} action A ação a ser processada.
 * @returns {ProjectState} O novo estado.
 */
const projectReducer = (state: ProjectState, action: Action): ProjectState => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoadingProjects: action.payload };
        case 'SET_PROJECTS':
            return { ...state, projects: action.payload };
        case 'SET_ACTIVE_PROJECT_ID':
            return { ...state, activeProjectId: action.payload };
        case 'ADD_PROJECT':
            return { ...state, projects: [action.payload, ...state.projects] };
        case 'UPDATE_PROJECT':
            return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p) };
        case 'DELETE_PROJECT':
            return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
        default:
            return state;
    }
};

// --- CONTEXT ---

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// --- PROVIDER ---

/**
 * Provedor de contexto que encapsula os componentes filhos, dando-lhes acesso ao estado
 * do projeto e às funções para modificá-lo.
 * Lida com o carregamento inicial de dados do Firestore e a persistência do projeto ativo.
 * @param {object} props - Propriedades do componente.
 * @param {React.ReactNode} props.children - Os componentes filhos a serem renderizados.
 * @returns {React.ReactElement} O componente provedor.
 */
export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isInitializing: isAuthInitializing } = useAuth();
    
    const initialState: ProjectState = {
        projects: [],
        activeProjectId: null,
        isLoadingProjects: true,
    };

    const [state, dispatch] = useReducer(projectReducer, initialState);

    useEffect(() => {
        const fetchProjects = async () => {
            if (user) {
                dispatch({ type: 'SET_LOADING', payload: true });
                try {
                    const fetchedProjects = await projectService.loadProjects(user.uid);
                    dispatch({ type: 'SET_PROJECTS', payload: fetchedProjects });
                } catch (error) {
                    toast.error(handleFirestoreError(error, "Falha ao carregar projetos"));
                    dispatch({ type: 'SET_PROJECTS', payload: [] });
                } finally {
                    dispatch({ type: 'SET_LOADING', payload: false });
                }
            } else if (!isAuthInitializing) {
                // Usuário deslogado, limpa o estado
                dispatch({ type: 'SET_PROJECTS', payload: [] });
                dispatch({ type: 'SET_ACTIVE_PROJECT_ID', payload: null });
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        };
        if (!isAuthInitializing) {
            fetchProjects();
        }
    }, [user, isAuthInitializing]);


    // --- ESTADO DERIVADO (MEMOS) ---

    const activeProject = useMemo(() => {
        return state.projects.find(p => p.id === state.activeProjectId) || null;
    }, [state.projects, state.activeProjectId]);

    const dynamicPlsData = useMemo((): ServiceCategory[] => {
        if (!activeProject) return [];
        const template = activeProject.pls_data || PLS_TEMPLATE;
        let accumulated = 0;
        return template.map(category => {
            const totalIncidence = category.subItems.reduce((sum, item) => sum + (item.incidence || 0), 0);
            accumulated += totalIncidence;
            return {
                ...category,
                totalIncidence,
                accumulatedPercentage: accumulated,
                totalCost: (totalIncidence / 100) * activeProject.cost_of_works,
                subItems: category.subItems.map(item => ({
                    ...item,
                    cost: (item.incidence / 100) * activeProject.cost_of_works
                }))
            };
        });
    }, [activeProject]);

    const projectFinancials = useMemo((): Financials => {
        if (!activeProject) return { totalProgress: 0, totalReleased: 0, categoryTotals: [], balanceToMeasure: 0 };
        
        const costOfWorks = typeof activeProject.cost_of_works === 'number' ? activeProject.cost_of_works : 0;
        if (!Array.isArray(activeProject.housing_units) || typeof activeProject.progress !== 'object' || !activeProject.progress) {
            return { totalProgress: 0, totalReleased: 0, categoryTotals: [], balanceToMeasure: costOfWorks };
        }
    
        const unitCount = activeProject.housing_units.length;
        if (unitCount === 0) {
            return { totalProgress: 0, totalReleased: 0, categoryTotals: [], balanceToMeasure: costOfWorks };
        }
        
        let totalWeightedProgress = 0;
        const categoryTotals: CategoryFinancials[] = [];
        dynamicPlsData.forEach(category => {
            let categoryWeightedProgress = 0;
            category.subItems.forEach(item => {
                const itemProgressArray = activeProject.progress[item.id] || [];
                const validProgress = Array.from({ length: unitCount }, (_, i) => typeof itemProgressArray[i] === 'number' ? itemProgressArray[i] : 0);
                const averageItemProgress = validProgress.reduce((a, b) => a + b, 0) / unitCount;
                if(typeof item.incidence === 'number') {
                    categoryWeightedProgress += (averageItemProgress / 100) * item.incidence;
                }
            });
            
            totalWeightedProgress += categoryWeightedProgress;
            const categoryReleased = (categoryWeightedProgress / 100) * costOfWorks;
            const categoryProgress = category.totalIncidence > 0 ? (categoryWeightedProgress / category.totalIncidence) * 100 : 0;
            
            categoryTotals.push({ id: category.id, name: category.name, released: categoryReleased, progress: categoryProgress, totalCost: category.totalCost, totalIncidence: category.totalIncidence });
        });
        
        const totalReleased = (totalWeightedProgress / 100) * costOfWorks;
        
        const finalProgress = isNaN(totalWeightedProgress) ? 0 : totalWeightedProgress;
        const finalReleased = isNaN(totalReleased) ? 0 : totalReleased;
    
        return { 
            totalProgress: finalProgress, 
            totalReleased: finalReleased, 
            categoryTotals, 
            balanceToMeasure: costOfWorks - finalReleased 
        };
    }, [activeProject, dynamicPlsData]);


    // --- AÇÕES ---

    const setActiveProjectId = useCallback((id: string | null) => {
        dispatch({ type: 'SET_ACTIVE_PROJECT_ID', payload: id });
    }, []);

    const createProject = useCallback(async (projectData: Omit<Project, 'id' | 'progress' | 'created_at' | 'ownerId' | 'members'>) => {
        if (!user) {
            toast.error("Você precisa estar logado para criar um projeto.");
            return;
        }
        const promise = projectService.addProject(projectData, user.uid);
        toast.promise(promise, {
            loading: 'Criando projeto...',
            success: (newProject) => {
                dispatch({ type: 'ADD_PROJECT', payload: newProject });
                setActiveProjectId(newProject.id);
                return 'Projeto criado com sucesso!';
            },
            error: (err) => handleFirestoreError(err, 'Falha ao criar o projeto')
        });
    }, [user, setActiveProjectId]);

    const updateProject = useCallback(async (updatedData: Project) => {
        if (!activeProject) return;
        
        const oldProject = state.projects.find(p => p.id === updatedData.id);
        if (!oldProject) return;

        const processedProject = projectService.handleUnitChanges(oldProject, updatedData);
        
        dispatch({ type: 'UPDATE_PROJECT', payload: processedProject });

        const promise = projectService.updateProject(processedProject);
        toast.promise(promise, {
            loading: 'Salvando alterações na nuvem...',
            success: 'Projeto atualizado com sucesso!',
            error: (err) => handleFirestoreError(err, 'Falha ao salvar as alterações')
        });
    }, [activeProject, state.projects]);

    const deleteProject = useCallback(async (id: string) => {
        const projectToDelete = state.projects.find(p => p.id === id);
        if (!projectToDelete) return;
        
        dispatch({ type: 'DELETE_PROJECT', payload: id });
        if (state.activeProjectId === id) {
            setActiveProjectId(null);
        }

        const promise = projectService.deleteProject(id);
        toast.promise(promise, {
            loading: 'Excluindo projeto...',
            success: 'Projeto excluído com sucesso!',
            error: (err) => {
                dispatch({ type: 'ADD_PROJECT', payload: projectToDelete });
                return handleFirestoreError(err, `Falha ao excluir o projeto`);
            }
        });
    }, [state.projects, state.activeProjectId, setActiveProjectId]);

    const updateProjectProperty = (updatedProject: Project) => {
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        projectService.updateProject(updatedProject).catch(err => {
            toast.error(handleFirestoreError(err, "Falha ao sincronizar com a nuvem"));
        });
    };

    const updateSingleProgress = useCallback((itemId: string, unitIndex: number, newProgressValue: number) => {
        if (!activeProject) return;
        const newProgress = Math.max(0, Math.min(100, Math.round(newProgressValue)));
        const oldProgress = (activeProject.progress[itemId] || [])[unitIndex] || 0;

        if (oldProgress === newProgress) return;

        const itemDetails = dynamicPlsData.flatMap(cat => cat.subItems).find(item => item.id === itemId);
        const unit = activeProject.housing_units[unitIndex];

        if (!itemDetails || !unit) {
            toast.error("Não foi possível encontrar o serviço ou a unidade para atualizar.");
            return;
        }

        const newLog: ProgressLog = {
            id: `log_${Date.now()}_${itemId}_${unit.id}`,
            timestamp: new Date().toISOString(),
            itemId: itemId,
            itemName: itemDetails.name,
            unitId: unit.id,
            unitName: unit.name,
            oldProgress: oldProgress,
            newProgress: newProgress,
        };
        
        const newProgressArray = [...(activeProject.progress[itemId] || Array(activeProject.housing_units.length).fill(0))];
        newProgressArray[unitIndex] = newProgress;

        const updatedProject = {
            ...activeProject,
            progress: { ...activeProject.progress, [itemId]: newProgressArray },
            history: [newLog, ...(activeProject.history || [])],
        };
        
        updateProjectProperty(updatedProject);
    }, [activeProject, dynamicPlsData]);


    const updateProgress = useCallback((itemId: string, newProgress: number[]) => {
        if (!activeProject) return;
        
        const oldProgressArray = activeProject.progress[itemId] || [];
        const newLogs: ProgressLog[] = [];
        const itemDetails = dynamicPlsData.flatMap(cat => cat.subItems).find(item => item.id === itemId);

        activeProject.housing_units.forEach((unit, index) => {
            if ((oldProgressArray[index] || 0) !== (newProgress[index] || 0)) {
                newLogs.push({
                    id: `log_${Date.now()}_${itemId}_${unit.id}`,
                    timestamp: new Date().toISOString(),
                    itemId: itemId, itemName: itemDetails?.name || 'Serviço Desconhecido',
                    unitId: unit.id, unitName: unit.name,
                    oldProgress: oldProgressArray[index] || 0,
                    newProgress: newProgress[index] || 0,
                });
            }
        });

        const updatedProject = {
            ...activeProject,
            progress: { ...activeProject.progress, [itemId]: newProgress },
            history: [...newLogs, ...(activeProject.history || [])],
        };
        
        updateProjectProperty(updatedProject);
        toast.success('Progresso atualizado!');

    }, [activeProject, dynamicPlsData]);
    
    const updateProgressFromAssistant = useCallback((updates: AssistantProgressUpdate[]): string => {
        if (!activeProject) return "Erro: Projeto não está ativo.";
        
        const allUnitNames = activeProject.housing_units.map(u => u.name);
        const allUnitIndices = Array.from({ length: allUnitNames.length }, (_, i) => i);
        const allItemsMap = new Map<string, { id: string }>();
        dynamicPlsData.forEach(cat => cat.subItems.forEach(item => allItemsMap.set(item.name.toLowerCase(), { id: item.id })));
        
        let successfulUpdates = 0;
        const errorMessages: string[] = [];
        let modified = false;

        const updatedProject = JSON.parse(JSON.stringify(activeProject));

        updates.forEach(update => {
            const itemDetails = allItemsMap.get(update.serviceName.toLowerCase());
            if (!itemDetails) {
                errorMessages.push(`Serviço "${update.serviceName}" não encontrado.`);
                return;
            }

            const targetUnitIndices = update.unitNames[0]?.toLowerCase() === 'all'
                ? allUnitIndices
                : update.unitNames.map(name => allUnitNames.findIndex(unitName => unitName.toLowerCase() === name.toLowerCase())).filter(index => index !== -1);

            if (targetUnitIndices.length === 0) {
                 errorMessages.push(`Nenhuma unidade correspondente encontrada para "${update.unitNames.join(', ')}".`);
                 return;
            }
            
            const oldProgressArray = updatedProject.progress[itemDetails.id] || [];
            const newProgress = [...oldProgressArray];
            
            targetUnitIndices.forEach(index => {
                const newValue = Math.max(0, Math.min(100, update.progress));
                 if ((newProgress[index] || 0) !== newValue) {
                    const unit = activeProject.housing_units[index];
                    const newLog: ProgressLog = {
                        id: `log_${Date.now()}_${itemDetails.id}_${unit.id}`,
                        timestamp: new Date().toISOString(),
                        itemId: itemDetails.id, itemName: update.serviceName,
                        unitId: unit.id, unitName: unit.name,
                        oldProgress: newProgress[index] || 0,
                        newProgress: newValue,
                    };
                    updatedProject.history.unshift(newLog);
                    newProgress[index] = newValue;
                    modified = true;
                 }
            });

            updatedProject.progress[itemDetails.id] = newProgress;
            successfulUpdates++;
        });

        if (modified) {
            updateProjectProperty(updatedProject);
        }

        let confirmationMessage = successfulUpdates > 0 ? `${successfulUpdates} serviço(s) foram atualizados.` : '';
        if (errorMessages.length > 0) confirmationMessage += ` Falhas: ${errorMessages.join(', ')}.`;
        return confirmationMessage.trim() || "Nenhuma ação foi realizada.";
    }, [activeProject, dynamicPlsData]);

    const savePls = useCallback((newPlsData: PlsCategoryTemplate[]) => {
        if (!activeProject) return;
        const newProgress: ProgressMatrix = {};
        const unitCount = activeProject.housing_units.length;
        newPlsData.forEach(cat => cat.subItems.forEach(item => {
            newProgress[item.id] = activeProject.progress[item.id] || Array(unitCount).fill(0);
        }));
        const updatedProject = { ...activeProject, pls_data: newPlsData, progress: newProgress };
        updateProject(updatedProject);
    }, [activeProject, updateProject]);

    const saveLayouts = useCallback((layouts: LayoutTemplate[]) => {
        if (!activeProject) return;
        updateProject({ ...activeProject, layouts });
    }, [activeProject, updateProject]);

    const updateItemName = useCallback((categoryId: string, itemId: string, newName: string) => {
        if (!activeProject) return;
        const plsTemplate = activeProject.pls_data || PLS_TEMPLATE;
        const newPlsData = JSON.parse(JSON.stringify(plsTemplate));
        const category = newPlsData.find((cat: PlsCategoryTemplate) => cat.id === categoryId);
        if (category) {
            const item = category.subItems.find((i: any) => i.id === itemId);
            if (item) item.name = newName;
        }
        updateProject({ ...activeProject, pls_data: newPlsData });
    }, [activeProject, updateProject]);

    const archiveReport = useCallback((reportData: Omit<ArchivedReport, 'id'>) => {
        if (!activeProject) return;
        const newReport: ArchivedReport = { ...reportData, id: `report_${Date.now()}` };
        const updatedProject = {
            ...activeProject,
            archived_reports: [...(activeProject.archived_reports || []), newReport]
        };
        updateProject(updatedProject);
    }, [activeProject, updateProject]);

    const overwriteProjects = useCallback(async (projectsToRestore: Project[]) => {
        if (!user) {
            throw new Error("Usuário não autenticado.");
        }
        try {
            await projectService.overwriteProjectsInStorage(projectsToRestore, user.uid);
            const fetchedProjects = await projectService.loadProjects(user.uid);
            dispatch({ type: 'SET_PROJECTS', payload: fetchedProjects });
            dispatch({ type: 'SET_ACTIVE_PROJECT_ID', payload: null });
        } catch (error: any) {
            throw new Error(handleFirestoreError(error, "Falha ao restaurar dados"));
        }
    }, [user]);

    const importProjects = useCallback(async (projectsToImport: Project[]) => {
        if (!user) {
            throw new Error("Usuário não autenticado.");
        }
        try {
            await projectService.importProjects(projectsToImport, user.uid);
            const fetchedProjects = await projectService.loadProjects(user.uid);
            dispatch({ type: 'SET_PROJECTS', payload: fetchedProjects });
        } catch (error: any) {
            throw new Error(handleFirestoreError(error, "Falha ao importar dados"));
        }
    }, [user]);

    const value: ProjectContextType = {
        ...state,
        activeProject,
        dynamicPlsData,
        projectFinancials,
        setActiveProjectId,
        createProject,
        updateProject,
        deleteProject,
        updateProgress,
        updateSingleProgress,
        updateProgressFromAssistant,
        savePls,
        saveLayouts,
        updateItemName,
        archiveReport,
        overwriteProjects,
        importProjects,
    };

    return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

// --- HOOK ---

/**
 * Hook personalizado para consumir o `ProjectContext`.
 * Fornece uma maneira fácil para os componentes acessarem o estado global do projeto
 * e as funções de ação.
 * @returns {ProjectContextType} O valor completo do contexto.
 * @throws {Error} Lança um erro se for usado fora de um `ProjectProvider`.
 */
export const useProject = (): ProjectContextType => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};