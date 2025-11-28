/**
 * @file Componente `Header` que exibe informações chave do projeto ativo e fornece acesso rápido a todas as ações principais, como configurações, relatórios e assistentes.
 */
import React from 'react';
import { Project } from '../types';
import { ArrowLeftIcon, SettingsIcon, DocumentArrowDownIcon, TableCellsIcon, HistoryIcon, SparklesIcon, CodeBracketIcon, MicrophoneIcon, ArchiveBoxIcon, SignOutIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';
import { auth } from '../firebase/config';

/**
 * @typedef {object} HeaderProps
 * @property {Project} project - O objeto do projeto ativo a ser exibido.
 * @property {() => void} onBackToDashboard - Callback para retornar ao painel de projetos.
 * @property {() => void} onShowSettings - Callback para abrir o modal de configurações do projeto.
 * @property {() => void} onShowReportBuilder - Callback para abrir o construtor de relatórios.
 * @property {() => void} onShowPlsEditor - Callback para abrir o editor da PLS.
 * @property {() => void} onShowHistory - Callback para abrir o histórico de alterações.
 * @property {() => void} onShowReportHistory - Callback para abrir o histórico de relatórios.
 * @property {() => void} onToggleAssistant - Callback para alternar a visibilidade do assistente Gemini.
 * @property {() => void} onToggleLiveAssistant - Callback para alternar a visibilidade do assistente de voz.
 * @property {() => void} onExportJson - Callback para exportar os dados brutos do projeto em JSON.
 */
interface HeaderProps {
  project: Project;
  onBackToDashboard: () => void;
  onShowSettings: () => void;
  onShowReportBuilder: () => void;
  onShowPlsEditor: () => void;
  onShowHistory: () => void;
  onShowReportHistory: () => void;
  onToggleAssistant: () => void;
  onToggleLiveAssistant: () => void;
  onExportJson: () => void;
}

/**
 * Subcomponente para exibir um item de detalhe no cabeçalho, com um rótulo e um valor.
 * @param {object} props - Propriedades do componente.
 * @param {string} props.label - O rótulo do detalhe.
 * @param {string | number | null} [props.value] - O valor a ser exibido.
 * @returns {React.ReactElement} O componente de item de detalhe.
 */
const DetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
    <div className="p-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{value || 'N/A'}</p>
    </div>
);

/**
 * O cabeçalho principal da visualização do projeto.
 * Contém uma barra de ações superior e uma barra de informações inferior com detalhes do projeto.
 * @param {HeaderProps} props - Propriedades para configurar o cabeçalho e seus manipuladores de evento.
 * @returns {React.ReactElement} O componente de cabeçalho.
 */
export const Header: React.FC<HeaderProps> = ({ project, onBackToDashboard, onShowSettings, onShowReportBuilder, onShowPlsEditor, onShowHistory, onShowReportHistory, onToggleAssistant, onToggleLiveAssistant, onExportJson }) => {
  
  return (
    <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-20 border-b-4 border-amber-400">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Barra superior para ações */}
        <div className="flex justify-between items-center py-2 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
             <button onClick={onBackToDashboard} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Voltar aos projetos">
                <ArrowLeftIcon />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 hidden sm:block">
              Acompanhamento de Obras
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
             <button onClick={onToggleAssistant} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Abrir Assistente Gemini">
                <SparklesIcon />
            </button>
             <button onClick={onToggleLiveAssistant} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Abrir Assistente de Voz">
                <MicrophoneIcon />
            </button>
             <button onClick={onShowReportBuilder} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Gerar Relatório">
                <DocumentArrowDownIcon />
            </button>
            <button onClick={onShowReportHistory} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Histórico de Relatórios">
                <ArchiveBoxIcon />
            </button>
            <button onClick={onShowPlsEditor} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Editar Itens da PLS">
                <TableCellsIcon />
            </button>
             <button onClick={onShowHistory} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Histórico de Alterações">
                <HistoryIcon />
            </button>
            <button onClick={onExportJson} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Exportar Dados do Projeto (JSON)">
                <CodeBracketIcon />
            </button>
            <button onClick={onShowSettings} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Configurações do Projeto">
                <SettingsIcon />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>
            <ThemeToggle />
            <button onClick={() => auth.signOut()} className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400" aria-label="Sair">
                <SignOutIcon />
            </button>
          </div>
        </div>
        
        {/* Barra inferior para detalhes do projeto */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x dark:divide-slate-700">
            <DetailItem label="Empreendimento" value={project.name} />
            <DetailItem label="Unidades" value={project.housing_units.length} />
            <DetailItem label="Custo da Obra" value={project.cost_of_works.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <DetailItem label="Construtora" value={project.construction_company.name} />
            <DetailItem label="Proponente" value={project.developer.name} />
            <DetailItem label="Resp. Técnico" value={project.responsible_engineer.name} />
        </div>
      </div>
    </header>
  );
};
