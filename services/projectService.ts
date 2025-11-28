import { Project, ProgressMatrix, HousingUnit, PlsCategoryTemplate } from '../types';
import { PLS_TEMPLATE } from '../constants';
import { db } from '../firebase/config';
// FIX: Import `writeBatch` from Firestore to handle batch operations.
import { 
    collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, 
    serverTimestamp, orderBy, arrayUnion, arrayRemove, DocumentData, writeBatch 
} from 'firebase/firestore';

const PROJECTS_COLLECTION = 'projects';

/**
 * Converte um documento do Firestore para o tipo Project, tratando o timestamp.
 * @param {DocumentData} doc O documento do Firestore.
 * @returns {Project} O objeto de projeto convertido.
 */
const fromFirestore = (doc: DocumentData): Project => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        // Converte o timestamp do Firestore para uma string ISO, ou usa a data atual como fallback.
        created_at: data.created_at?.toDate().toISOString() || new Date().toISOString(),
    } as Project;
}

/**
 * Carrega todos os projetos do Firestore associados a um usuário.
 * @param {string} userId O ID do usuário autenticado.
 * @returns {Promise<Project[]>} Um array de projetos do usuário.
 */
export const loadProjects = async (userId: string): Promise<Project[]> => {
    if (!userId) return [];
    
    // Query para projetos onde o usuário é listado como membro.
    const projectsRef = collection(db, PROJECTS_COLLECTION);
    const q = query(projectsRef, where('members', 'array-contains', userId), orderBy('created_at', 'desc'));
    
    try {
        const querySnapshot = await getDocs(q);
        const projects = querySnapshot.docs.map(fromFirestore);
        return projects;
    } catch (error) {
        console.error("Failed to load projects from Firestore", error);
        throw error; // Relança o erro original para que o contexto possa analisá-lo.
    }
};

/**
 * Gera a matriz de progresso inicial para um novo projeto.
 * @param {HousingUnit[]} housingUnits As unidades habitacionais do projeto.
 * @param {PlsCategoryTemplate[]} plsData A estrutura de serviços da PLS.
 * @returns {ProgressMatrix} Um objeto onde cada chave é um ID de serviço e o valor é um array de zeros, um para cada unidade.
 */
const getInitialProgressForProject = (housingUnits: HousingUnit[], plsData: PlsCategoryTemplate[]): ProgressMatrix => {
    const initialProgress: ProgressMatrix = {};
    plsData.forEach(category => {
        category.subItems.forEach(item => {
            initialProgress[item.id] = Array(housingUnits.length).fill(0);
        });
    });
    return initialProgress;
};


/**
 * Cria um novo projeto no Firestore.
 * @param {Omit<Project, 'id' | 'progress' | 'created_at' | 'ownerId' | 'members'>} projectData Os dados do formulário de criação do projeto.
 * @param {string} userId O ID do usuário que está criando o projeto.
 * @returns {Promise<Project>} O objeto de projeto completo como foi salvo.
 */
export const addProject = async (projectData: Omit<Project, 'id' | 'progress' | 'created_at' | 'ownerId' | 'members'>, userId: string): Promise<Project> => {
    const plsDataToUse = projectData.pls_data || PLS_TEMPLATE;
    const initialProgress = getInitialProgressForProject(projectData.housing_units, plsDataToUse);

    const newProjectData = {
        ...projectData,
        ownerId: userId,
        members: [userId], // O proprietário é membro por padrão
        progress: initialProgress,
        created_at: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), newProjectData);

    return {
        ...projectData,
        id: docRef.id,
        progress: initialProgress,
        created_at: new Date().toISOString(),
        ownerId: userId,
        members: [userId],
    };
};


/**
 * Atualiza um projeto existente no Firestore.
 * @param {Project} updatedProject O objeto do projeto com as informações atualizadas.
 * @returns {Promise<void>}
 */
export const updateProject = async (updatedProject: Project): Promise<void> => {
    const { id, ...projectData } = updatedProject;
    const projectRef = doc(db, PROJECTS_COLLECTION, id);
    const dataToUpdate = { ...projectData };
    // Remove o campo `created_at` para evitar erros de tipo no Firestore ao atualizar.
    delete (dataToUpdate as any).created_at;

    await updateDoc(projectRef, dataToUpdate);
};


/**
 * Exclui um projeto do Firestore.
 * @param {string} projectId O ID do projeto a ser excluído.
 * @returns {Promise<void>}
 */
export const deleteProject = async (projectId: string): Promise<void> => {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await deleteDoc(projectRef);
};

/**
 * Adiciona um membro a um projeto no Firestore.
 * @param {string} projectId O ID do projeto.
 * @param {string} memberId O ID do membro a ser adicionado.
 * @returns {Promise<void>}
 */
export const addMemberToProject = async (projectId: string, memberId: string): Promise<void> => {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
        members: arrayUnion(memberId)
    });
};

/**
 * Remove um membro de um projeto no Firestore.
 * @param {string} projectId O ID do projeto.
 * @param {string} memberId O ID do membro a ser removido.
 * @returns {Promise<void>}
 */
export const removeMemberFromProject = async (projectId: string, memberId: string): Promise<void> => {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
        members: arrayRemove(memberId)
    });
};

/**
 * Lida com a lógica de negócio de ajustar a matriz de progresso
 * quando o número de unidades habitacionais muda.
 * @param {Project} oldProject O estado anterior do projeto.
 * @param {Project} updatedProject O novo estado do projeto com as atualizações.
 * @returns {Project} O projeto atualizado com a matriz de progresso ajustada.
 */
export const handleUnitChanges = (oldProject: Project, updatedProject: Project): Project => {
    const oldUnitCount = oldProject.housing_units.length;
    const newUnitCount = updatedProject.housing_units.length;
    const projectToUpdate = { ...updatedProject };

    if (newUnitCount !== oldUnitCount) {
        const adjustedProgress = { ...projectToUpdate.progress };
        Object.keys(adjustedProgress).forEach(itemId => {
            const oldProgressArray = adjustedProgress[itemId] || [];
            const newProgressArray = Array(newUnitCount).fill(0);
            
            const unitsToCopy = Math.min(oldUnitCount, newUnitCount);
            for (let i = 0; i < unitsToCopy; i++) {
                newProgressArray[i] = oldProgressArray[i];
            }
            adjustedProgress[itemId] = newProgressArray;
        });
        projectToUpdate.progress = adjustedProgress;
    }
    return projectToUpdate;
};

/**
 * Substitui todos os projetos no armazenamento por uma nova lista.
 * @param {Project[]} newProjects O novo array de projetos a ser salvo.
 * @param {string} userId O ID do usuário para associar os novos projetos.
 * @returns {Promise<void>}
 */
export const overwriteProjectsInStorage = async (newProjects: Project[], userId: string): Promise<void> => {
    const batch = writeBatch(db);
    
    // Exclui todos os projetos antigos do usuário
    const currentProjects = await loadProjects(userId);
    currentProjects.forEach(proj => {
        batch.delete(doc(db, PROJECTS_COLLECTION, proj.id));
    });

    // Adiciona os novos projetos
    newProjects.forEach(proj => {
        const { id, ...data } = proj;
        
        // Garante que dados de proprietário antigo sejam removidos antes de salvar.
        delete (data as any).ownerId;
        delete (data as any).members;
        
        const newDocRef = doc(collection(db, PROJECTS_COLLECTION));
        batch.set(newDocRef, { 
            ...data, 
            ownerId: userId, 
            members: [userId], 
            created_at: serverTimestamp() 
        });
    });

    await batch.commit();
};

/**
 * Importa (adiciona) projetos a partir de um arquivo de backup para a conta de um usuário.
 * Não apaga os projetos existentes.
 * @param {Project[]} newProjects O array de projetos a serem importados.
 * @param {string} userId O ID do usuário que está importando os projetos.
 * @returns {Promise<void>}
 */
export const importProjects = async (newProjects: Project[], userId: string): Promise<void> => {
    const batch = writeBatch(db);
    
    newProjects.forEach(proj => {
        // Remove o ID original para que o Firestore gere um novo, evitando conflitos.
        const { id, ...data } = proj;
        
        // Garante que dados de proprietário antigo sejam removidos antes de salvar.
        delete (data as any).ownerId;
        delete (data as any).members;
        
        const newDocRef = doc(collection(db, PROJECTS_COLLECTION));
        
        // Atribui o projeto ao usuário atual e o define como único membro.
        batch.set(newDocRef, { 
            ...data, 
            ownerId: userId, 
            members: [userId], 
            created_at: serverTimestamp() 
        });
    });

    await batch.commit();
};