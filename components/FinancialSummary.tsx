/**
 * @file Componente `FinancialSummary` que exibe um painel com os principais indicadores financeiros do projeto.
 * Mostra o progresso geral, valores medidos, saldo e um detalhamento por etapa da obra.
 */
import React from 'react';
import { Project, CategoryFinancials } from '../types';
import { ChartBarIcon } from './Icons';

/**
 * @typedef {object} FinancialSummaryProps
 * @property {Project} project - O objeto do projeto ativo.
 * @property {object} financials - Os dados financeiros calculados para o projeto.
 * @property {number} financials.totalProgress - O progresso ponderado total do projeto (%).
 * @property {number} financials.totalReleased - O valor monetário total liberado/medido.
 * @property {number} financials.balanceToMeasure - O saldo financeiro restante a medir.
 * @property {CategoryFinancials[]} financials.categoryTotals - Detalhes financeiros agregados por categoria.
 */
interface FinancialSummaryProps {
    project: Project;
    financials: {
        totalProgress: number;
        totalReleased: number;
        balanceToMeasure: number;
        categoryTotals: CategoryFinancials[];
    }
}

/**
 * Formata um valor numérico como moeda no padrão BRL (Real brasileiro).
 * @param {number} value O valor a ser formatado.
 * @returns {string} A string formatada, ex: "R$ 1.234,56".
 */
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
};

/**
 * Um card para exibir uma única métrica financeira com título e valor.
 * @param {object} props - Propriedades do componente.
 * @param {string} props.title - O título da métrica.
 * @param {string} props.value - O valor da métrica.
 * @param {string} [props.className] - Classes CSS adicionais para o valor.
 * @returns {React.ReactElement} O componente do card de métrica.
 */
const MetricCard: React.FC<{ title: string; value: string; className?: string }> = ({ title, value, className }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-200 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className={`text-2xl font-bold ${className}`}>{value}</p>
    </div>
);

/**
 * Renderiza o painel de resumo financeiro do projeto.
 * Inclui cards de métricas principais e barras de progresso para o total e para cada etapa.
 * @param {FinancialSummaryProps} props - As propriedades do componente, incluindo dados do projeto e financeiros.
 * @returns {React.ReactElement} O componente de resumo financeiro.
 */
export const FinancialSummary: React.FC<FinancialSummaryProps> = ({ project, financials }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-md border dark:border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <ChartBarIcon />
                Resumo Financeiro
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <MetricCard title="Incidência" value={`${financials.totalProgress.toFixed(2)}%`} className="text-amber-600 dark:text-amber-400" />
                <MetricCard title="Executado" value={formatCurrency(financials.totalReleased)} className="text-emerald-600 dark:text-emerald-400" />
                <MetricCard title="Saldo a Medir" value={formatCurrency(financials.balanceToMeasure)} className="text-amber-600 dark:text-amber-400" />
                <MetricCard title="Custo Total da Obra" value={formatCurrency(project.cost_of_works)} className="text-slate-700 dark:text-slate-300" />
            </div>
             <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-4">
              <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${financials.totalProgress}%` }}></div>
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-200">Detalhes por Etapa</h3>
                <div className="space-y-4">
                    {financials.categoryTotals.map(category => (
                        <div key={category.id}>
                            <div className="flex justify-between items-center mb-1 text-sm gap-4">
                                <div className="flex-grow flex items-baseline gap-3 min-w-0">
                                    <p className="font-medium text-slate-600 dark:text-slate-300 truncate" title={`${category.id} - ${category.name}`}>
                                        {category.id} - {category.name}
                                    </p>
                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                                        {category.totalIncidence.toFixed(2)}%
                                    </p>
                                </div>
                                <p className="font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap flex-shrink-0">
                                    {formatCurrency(category.released)} / <span className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(category.totalCost)}</span>
                                </p>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${category.progress}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
