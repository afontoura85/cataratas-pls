/**
 * @file Componente `AppContent` que atua como o controlador principal da interface do usuário.
 * Ele consome o `ProjectContext` e gerencia a renderização condicional do painel de projetos
 * ou da visualização detalhada de um projeto ativo. Também controla a visibilidade de todos os modais da aplicação.
 */
import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { useProject } from './contexts/ProjectContext';
import { PlsTable } from './components/PlsTable';
import { Header } from './components/Header';
import { ProjectSetup } from './components/ProjectSetup';
import { PLS_TEMPLATE } from './constants';
import { AssistantView, ServiceSubItem, HousingUnit } from './types';
import { GeminiAssistant } from './components/GeminiAssistant';
import { ProgressUpdateModal } from './components/ProgressUpdateModal';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ProjectSettings } from './components/ProjectSettings';
import { SpinnerIcon, BuildingIcon } from './components/Icons';
import { FinancialSummary } from './components/FinancialSummary';
import { ReportBuilderModal } from './components/ReportBuilderModal';
import { UnitProgressSummary } from './components/UnitProgressSummary';
import { UnitExportModal } from './components/UnitExportModal';
import { PlsEditorModal } from './components/PlsEditorModal';
import { HistoryModal } from './components/HistoryModal';
import { exportToJSON } from './services/exportService';
import { TextAssistantModal } from './components/TextAssistantModal';
import { LiveAssistantModal } from './components/LiveAssistantModal';
import { ReportHistoryModal } from './components/ReportHistoryModal';
import { LayoutEditorModal } from './components/LayoutEditorModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';

/**
 * O componente principal que gerencia a lógica de renderização da aplicação após a
 * inicialização e o carregamento dos dados do projeto. Ele atua como um roteador de UI,
 * exibindo a tela de login, o painel de projetos ou a visualização de um projeto específico.
 * @returns {React.ReactElement} O conteúdo principal da aplicação.
 */
const AppContent: React.FC = () => {
    const { user, isInitializing: isAuthInitializing } = useAuth();
    const {
        activeProject,
        projects,
        isLoadingProjects,
        projectFinancials,
        dynamicPlsData,
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
    } = useProject();

    // Estados para controlar a visibilidade de modais e painéis
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [isReportBuilderOpen, setIsReportBuilderOpen] = useState(false);
    const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
    const [isPlsEditorOpen, setIsPlsEditorOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isReportHistoryOpen, setIsReportHistoryOpen] = useState(false);
    const [isAssistantVisible, setIsAssistantVisible] = useState(false);
    const [isTextAssistantOpen, setIsTextAssistantOpen] = useState(false);
    const [isLiveAssistantOpen, setIsLiveAssistantOpen] = useState(false);
    const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);

    const [assistantView, setAssistantView] = useState<AssistantView>('image');
    const [editingItem, setEditingItem] = useState<ServiceSubItem | null>(null);
    const [exportingUnit, setExportingUnit] = useState<HousingUnit | null>(null);

    const handleExportJson = () => {
        if (!activeProject) return;
        const allCategoryIds = dynamicPlsData.map(c => c.id);
        const exportOptions = {
            title: `Exportação Completa - ${activeProject.name}`,
            includeProjectDetails: true,
            includeFinancialSummary: true,
            includeProgressTable: true,
            includeUnitDetails: true,
            selectedCategoryIds: allCategoryIds,
            aiSummary: null,
        };
        exportToJSON(activeProject, dynamicPlsData, projectFinancials, exportOptions);
    };

    if (isAuthInitializing || (isLoadingProjects && user)) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center text-center p-4">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-6">
                    <BuildingIcon />
                </div>
                <div className="flex items-center justify-center">
                    <SpinnerIcon />
                    <h2 className="ml-4 text-xl font-semibold text-slate-700 dark:text-slate-200">
                      {isAuthInitializing ? 'Verificando sessão...' : 'Carregando seus projetos...'}
                    </h2>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    if (!activeProject) {
        return (
            <>
                <ProjectDashboard
                    onSelectProject={setActiveProjectId}
                    onCreateProject={() => setIsCreatingProject(true)}
                    user={user}
                    onOpenBackupRestore={() => setIsBackupRestoreModalOpen(true)}
                />
                {isCreatingProject && (
                    <ProjectSetup
                        onSetup={(projectData) => {
                            createProject(projectData);
                            setIsCreatingProject(false);
                        }}
                        onCancel={() => setIsCreatingProject(false)}
                    />
                )}
                 {isBackupRestoreModalOpen && (
                    <BackupRestoreModal
                        onClose={() => setIsBackupRestoreModalOpen(false)}
                        projects={projects}
                        onRestore={overwriteProjects}
                        onImport={importProjects}
                    />
                )}
            </>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-200">
            <Header
                project={activeProject}
                onBackToDashboard={() => setActiveProjectId(null)}
                onShowSettings={() => setIsEditingSettings(true)}
                onShowReportBuilder={() => setIsReportBuilderOpen(true)}
                onShowPlsEditor={() => setIsPlsEditorOpen(true)}
                onShowHistory={() => setIsHistoryModalOpen(true)}
                onShowReportHistory={() => setIsReportHistoryOpen(true)}
                onToggleAssistant={() => setIsAssistantVisible(prev => !prev)}
                onToggleLiveAssistant={() => setIsLiveAssistantOpen(prev => !prev)}
                onExportJson={handleExportJson}
            />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="space-y-8">
                    <FinancialSummary project={activeProject} financials={projectFinancials} />
                    <PlsTable
                        plsData={dynamicPlsData}
                        housingUnits={activeProject.housing_units}
                        progress={activeProject.progress}
                        onEditItem={setEditingItem}
                        onUpdateSingleProgress={updateSingleProgress}
                        onUpdateItemName={updateItemName}
                        categoryFinancials={projectFinancials.categoryTotals}
                        onOpenTextAssistant={() => setIsTextAssistantOpen(true)}
                    />
                    <UnitProgressSummary 
                        project={activeProject}
                        plsData={dynamicPlsData}
                        onExportUnit={setExportingUnit}
                    />
                </div>
            </main>
            {isAssistantVisible && (
              <>
                  <div
                      className="fixed inset-0 bg-black bg-opacity-50 z-30"
                      onClick={() => setIsAssistantVisible(false)}
                      aria-hidden="true"
                  ></div>
                  <GeminiAssistant
                      currentView={assistantView}
                      setCurrentView={setAssistantView}
                      plsData={dynamicPlsData}
                      progress={activeProject.progress}
                      onClose={() => setIsAssistantVisible(false)}
                  />
              </>
            )}
            {editingItem && (
                <ProgressUpdateModal
                    item={editingItem}
                    housingUnits={activeProject.housing_units}
                    initialProgress={activeProject.progress[editingItem.id] || []}
                    onUpdate={(itemId, newProgress) => {
                        updateProgress(itemId, newProgress);
                        setEditingItem(null);
                    }}
                    onClose={() => setEditingItem(null)}
                />
            )}
            {exportingUnit && (
                <UnitExportModal
                    unit={exportingUnit}
                    project={activeProject}
                    plsData={dynamicPlsData}
                    onClose={() => setExportingUnit(null)}
                />
            )}
            {isEditingSettings && (
                <ProjectSettings
                    project={activeProject}
                    onSave={(updatedProject) => {
                        updateProject(updatedProject);
                        setIsEditingSettings(false);
                    }}
                    onCancel={() => setIsEditingSettings(false)}
                    onDelete={() => {
                        deleteProject(activeProject.id);
                        setIsEditingSettings(false);
                    }}
                />
            )}
            {isReportBuilderOpen && (
                <ReportBuilderModal
                    project={activeProject}
                    plsData={dynamicPlsData}
                    financials={projectFinancials}
                    onClose={() => setIsReportBuilderOpen(false)}
                    onArchiveReport={archiveReport}
                    onManageLayouts={() => setIsLayoutEditorOpen(true)}
                />
            )}
            {isLayoutEditorOpen && (
                <LayoutEditorModal
                    isOpen={isLayoutEditorOpen}
                    onClose={() => setIsLayoutEditorOpen(false)}
                    projectLayouts={activeProject.layouts || []}
                    onSave={(layouts) => {
                        saveLayouts(layouts);
                        setIsLayoutEditorOpen(false);
                    }}
                    project={activeProject}
                />
            )}
            {isPlsEditorOpen && (
                <PlsEditorModal
                    initialPlsData={activeProject.pls_data || PLS_TEMPLATE}
                    onSave={(newPls) => {
                        savePls(newPls);
                        setIsPlsEditorOpen(false);
                    }}
                    onClose={() => setIsPlsEditorOpen(false)}
                />
            )}
            {isHistoryModalOpen && (
                <HistoryModal
                    history={activeProject.history || []}
                    onClose={() => setIsHistoryModalOpen(false)}
                />
            )}
            {isReportHistoryOpen && (
                <ReportHistoryModal
                    project={activeProject}
                    onClose={() => setIsReportHistoryOpen(false)}
                />
            )}
            {isTextAssistantOpen && (
                <TextAssistantModal
                    isOpen={isTextAssistantOpen}
                    onClose={() => setIsTextAssistantOpen(false)}
                    project={activeProject}
                    plsData={dynamicPlsData}
                    financials={projectFinancials}
                    onUpdateProgressFromAssistant={updateProgressFromAssistant}
                />
            )}
            {isLiveAssistantOpen && (
                <LiveAssistantModal
                    isOpen={isLiveAssistantOpen}
                    onClose={() => setIsLiveAssistantOpen(false)}
                />
            )}
        </div>
    );
};

export default AppContent;