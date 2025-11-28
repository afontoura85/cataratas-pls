import React, { useMemo } from 'react';
import { Project, UserProfile } from '../types';
import { BuildingIcon, PlusIcon, SignOutIcon, CircleStackIcon, ArrowUpTrayIcon } from './Icons';
import { PLS_TEMPLATE } from '../constants';
import { ThemeToggle } from './ThemeToggle';
import { auth } from '../firebase/config';
import { useProject } from '../contexts/ProjectContext';

interface ProjectDashboardProps {
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  user: UserProfile | null;
  onOpenBackupRestore: () => void;
}

const calculateProjectProgress = (project: Project): number => {
    // Guard against incomplete project data that might come from a backup
    if (!project || !Array.isArray(project.housing_units) || typeof project.progress !== 'object' || !project.progress) {
        return 0;
    }

    const unitCount = project.housing_units.length;
    if (unitCount === 0) {
        return 0;
    }

    let totalWeightedProgress = 0;
    const template = project.pls_data || PLS_TEMPLATE;

    template.forEach(category => {
        if (category && Array.isArray(category.subItems)) {
            let categoryMeasuredSum = 0;
            let categoryTotalIncidence = 0;

            category.subItems.forEach(item => {
                const incidence = typeof item.incidence === 'number' ? item.incidence : 0;
                categoryTotalIncidence += incidence;

                const itemProgress = project.progress[item.id] || [];
                // Ensure itemProgress is an array of numbers
                const validProgress = Array.from({ length: unitCount }, (_, i) => typeof itemProgress[i] === 'number' ? itemProgress[i] : 0);
                const averageProgress = validProgress.reduce((a, b) => a + b, 0) / unitCount;

                categoryMeasuredSum += (averageProgress / 100) * incidence;
            });

            // New logic: Sum of Subitems * Global Incidence (decimal) * 10
            const measuredIncidence = categoryMeasuredSum * (categoryTotalIncidence / 100) * 10;
            totalWeightedProgress += measuredIncidence;
        }
    });

    return isNaN(totalWeightedProgress) ? 0 : totalWeightedProgress;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
};

const ProjectCard: React.FC<{ project: Project; progress: number; onSelect: () => void; }> = React.memo(({ project, progress, onSelect }) => {
    return (
        <div onClick={onSelect} className="bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer flex flex-col justify-between group border dark:border-slate-700">
            <div className="p-6">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400">{project?.name}</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{project?.housing_units.length} unidades</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Construtora: {project?.construction_company?.name || 'N/A'}</p>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-2">{formatCurrency(project?.cost_of_works)}</p>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-700 rounded-b-lg">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Progresso</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{progress.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        </div>
    );
});

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ onSelectProject, onCreateProject, user, onOpenBackupRestore }) => {
  const { projects } = useProject();
  
  const progressMap = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(project => {
        map.set(project.id, calculateProjectProgress(project));
    });
    return map;
  }, [projects]);
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-slate-100">Construtora Cataratas</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">{user?.email}</span>
            <button 
                onClick={onOpenBackupRestore} 
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" 
                aria-label="Backup e Restauração"
                title="Backup e Restauração"
            >
                <CircleStackIcon className="h-6 w-6" />
            </button>
            <ThemeToggle />
             <button onClick={() => auth.signOut()} className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400" aria-label="Sair">
                <SignOutIcon />
            </button>
            <button onClick={onCreateProject} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-semibold shadow-sm">
              <PlusIcon />
              <span className="hidden sm:inline">Novo Projeto</span>
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {projects.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
             <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-700">
                <BuildingIcon />
            </div>
            <h2 className="mt-6 text-xl font-semibold text-slate-700 dark:text-slate-200">Nenhum projeto encontrado.</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Os seus projetos agora são salvos na nuvem. Clique em "Novo Projeto" para começar.</p>
            <div className="mt-6 border-t dark:border-slate-700 pt-6 max-w-md mx-auto">
                <p className="text-sm text-slate-500 dark:text-slate-400">Ou, se você tem um arquivo de backup:</p>
                <button
                    onClick={onOpenBackupRestore}
                    className="mt-2 font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 inline-flex items-center gap-2"
                >
                    <ArrowUpTrayIcon />
                    Importar ou Restaurar Projetos
                </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project}
                progress={progressMap.get(project.id) || 0}
                onSelect={() => onSelectProject(project.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};