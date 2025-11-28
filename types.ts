
/**
 * @file Contém todas as definições de tipo e interface para a aplicação,
 * fornecendo um modelo de dados robusto e consistente.
 */

/**
 * Representa uma única unidade habitacional dentro de um projeto.
 */
export interface HousingUnit {
  /** Identificador único da unidade. */
  id: string;
  /** Nome de exibição, ex: "Casa 01". */
  name: string;
}

/**
 * Representa um único serviço ou tarefa faturável dentro de uma categoria.
 */
export interface ServiceSubItem {
  /** Identificador único do serviço, ex: "1.1". */
  id: string;
  /** Nome do serviço. */
  name: string;
  /** Percentual do custo total do projeto que este item representa. */
  incidence: number;
  /** Custo monetário calculado com base na incidência. */
  cost: number;
  /** Unidade de medida, ex: 'vb', 'un', 'm²'. */
  unit: string;
}

/**
 * Representa uma categoria principal de serviços, que agrupa vários sub-itens.
 */
export interface ServiceCategory {
  /** Identificador único da categoria, ex: "1". */
  id: string;
  /** Nome da categoria, ex: "SERVIÇOS PRELIMINARES". */
  name: string;
  /** Lista de serviços (sub-itens) dentro desta categoria. */
  subItems: ServiceSubItem[];
  /** Soma das incidências de todos os sub-itens. */
  totalIncidence: number;
  /** Custo monetário total calculado para a categoria. */
  totalCost: number;
  /** Percentual acumulado do projeto até esta categoria. */
  accumulatedPercentage: number;
}

/**
 * Matriz que armazena o progresso (0-100) de cada serviço para cada unidade.
 * A chave é o ID do serviço (ServiceSubItem.id) e o valor é um array de números,
 * onde o índice do array corresponde ao índice da unidade habitacional.
 */
export type ProgressMatrix = Record<string, number[]>;

/**
 * Define as visualizações disponíveis no painel do Assistente Gemini.
 */
export type AssistantView = 'image' | 'advisor' | 'research' | 'ocr';

/**
 * Modelo para um sub-item de serviço ao importar ou editar a estrutura da PLS.
 * Esta versão não contém o custo calculado, pois depende do custo total do projeto.
 */
export interface PlsSubItemTemplate {
  /** Identificador do sub-item, ex: "1.1". */
  id: string;
  /** Nome do serviço. */
  name: string;
  /** Incidência percentual do serviço no custo total. */
  incidence: number;
  /** Unidade de medida. */
  unit: string;
}

/**
 * Modelo para uma categoria de serviço ao importar ou editar a estrutura da PLS.
 */
export interface PlsCategoryTemplate {
  /** Identificador da categoria, ex: "1". */
  id:string;
  /** Nome da categoria. */
  name: string;
  /** Lista de modelos de sub-itens de serviço. */
  subItems: PlsSubItemTemplate[];
}

/**
 * Registra uma única alteração de progresso no histórico do projeto para auditoria.
 */
export interface ProgressLog {
  /** Identificador único do registro de log. */
  id: string;
  /** Data e hora da alteração em formato ISO. */
  timestamp: string;
  /** ID do serviço alterado. */
  itemId: string;
  /** Nome do serviço no momento da alteração. */
  itemName: string;
  /** ID da unidade alterada. */
  unitId: string;
  /** Nome da unidade no momento da alteração. */
  unitName: string;
  /** Valor do progresso antes da alteração. */
  oldProgress: number;
  /** Novo valor de progresso. */
  newProgress: number;
}

/**
 * Representa uma etapa no cronograma físico-financeiro do projeto, geralmente importado de documentos oficiais.
 */
export interface ScheduleStage {
  /** Número da etapa (ex: 1, 2, 3...). */
  stage: number;
  /** Progresso físico esperado para a etapa específica (%). */
  physical_progress_stage: number;
  /** Progresso físico acumulado até o final desta etapa (%). */
  physical_progress_accumulated: number;
  /** Liberação financeira esperada para a etapa específica (%). */
  financial_release_stage: number;
  /** Liberação financeira acumulada até o final desta etapa (%). */
  financial_release_accumulated: number;
}

/**
 * Define o modelo para um layout de relatório em PDF, permitindo personalização visual.
 */
export interface LayoutTemplate {
  /** Identificador único do layout. */
  id: string;
  /** Nome do layout para exibição na UI. */
  name: string;
  /** Logo principal (em base64) para a capa do relatório. */
  logoBase64?: string | null;
  /** Logo menor (em base64) para o cabeçalho de cada página. */
  headerLogoBase64?: string | null;
  /** Cor de destaque (hex) usada em títulos e elementos visuais. */
  primaryColor: string;
  /** Família da fonte a ser usada no PDF (ex: 'helvetica', 'times'). */
  fontFamily?: string;
  /** Texto customizado para o cabeçalho de cada página. */
  headerText?: string;
  /** Texto customizado para o rodapé de cada página. */
  footerText?: string;
  /** Se este é o layout padrão para novos relatórios. */
  isDefault?: boolean;
}

/**
 * Define as opções selecionadas pelo usuário ao gerar um relatório, controlando o conteúdo e a aparência.
 */
export interface ReportOptions {
  /** Título principal do relatório. */
  title: string;
  /** Se deve incluir a seção de detalhes do projeto. */
  includeProjectDetails: boolean;
  /** Se deve incluir a seção de resumo financeiro. */
  includeFinancialSummary: boolean;
  /** Se deve incluir a tabela detalhada de progresso da PLS. */
  includeProgressTable: boolean;
  /** Se deve incluir a matriz de progresso por unidade. */
  includeUnitDetails: boolean;
  /** Array de IDs das categorias de serviço a serem incluídas no relatório. */
  selectedCategoryIds: string[];
  /** Resumo executivo gerado por IA (opcional). */
  aiSummary?: string | null;
  /** Layout visual a ser aplicado ao relatório PDF. */
  layout?: LayoutTemplate;
  /** Orientação da página para o PDF ('p' para retrato, 'l' para paisagem). */
  orientation?: 'p' | 'l';
  /** Número da medição para exibição no relatório. */
  measurementNumber?: number;
}

/**
 * Representa um relatório que foi arquivado no histórico do projeto.
 * Contém um snapshot de todos os dados relevantes no momento da geração para fins de auditoria.
 */
export interface ArchivedReport {
  /** Identificador único do relatório arquivado. */
  id: string;
  /** Título do relatório no momento da geração. */
  title: string;
  /** Data e hora em formato ISO de quando o relatório foi gerado. */
  generatedAt: string;
  /** Formato do arquivo gerado ('pdf', 'xlsx', 'json'). */
  format: 'pdf' | 'xlsx' | 'json';
  /** Opções usadas para gerar o relatório. */
  options: ReportOptions;
  /** Snapshot dos dados financeiros no momento da geração. */
  financialsSnapshot: Financials;
  /** Snapshot da matriz de progresso no momento da geração. */
  progressSnapshot: ProgressMatrix;
  /** Snapshot dos dados calculados da PLS no momento da geração. */
  plsDataSnapshot: ServiceCategory[];
}

/**
 * Metadados sobre a importação de documentos para o projeto, registrando as datas.
 */
export interface ImportMetadata {
  /** Data da última importação bem-sucedida de um arquivo FRE. */
  fre_imported_at?: string;
  /** Data da última importação bem-sucedida de um arquivo de Orçamento (PLS). */
  pls_imported_at?: string;
  /** Data da última importação bem-sucedida de um arquivo de Cronograma. */
  schedule_imported_at?: string;
}

/**
 * Representa o perfil de um usuário autenticado.
 */
export interface UserProfile {
  /** Identificador único do Firebase Auth. */
  uid: string;
  /** E-mail do usuário. */
  email: string | null;
}

/**
 * A estrutura principal que define um projeto de construção.
 * Contém todos os dados estáticos e dinâmicos relacionados a um empreendimento.
 */
export interface Project {
  /** Identificador único do projeto, gerado pelo Firestore. */
  id: string;
  /** Nome do empreendimento. */
  name: string;
  /** ID do usuário proprietário do projeto. */
  ownerId: string;
  /** Array de IDs de usuários com acesso ao projeto. */
  members: string[];
  /** Lista de unidades habitacionais. */
  housing_units: HousingUnit[];
  /** Matriz de progresso de todos os serviços em todas as unidades. */
  progress: ProgressMatrix;
  /** Data de criação do projeto em formato ISO. */
  created_at: string;
  /** Detalhes de endereço do empreendimento. */
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    latitude: number | null;
    longitude: number | null;
  };
  /** Detalhes do proponente/incorporador. */
  developer: {
    name: string;
    cnpj: string;
  };
  /** Detalhes da construtora. */
  construction_company: {
    name: string;
    cnpj: string;
  };
  /** Custo total das obras (valor principal para cálculos). */
  cost_of_works: number;
  /** Custo total do empreendimento. */
  total_enterprise_cost: number;
  /** Valor global de vendas (VGV). */
  vgv: number;
  /** Detalhes do engenheiro responsável técnico. */
  responsible_engineer: {
    name: string;
    crea: string;
    email: string;
  };
  /** Estrutura personalizada da PLS importada de um orçamento, se houver. */
  pls_data: PlsCategoryTemplate[] | null;
  /** Histórico de todas as alterações de progresso. */
  history: ProgressLog[];
  /** Cronograma físico-financeiro importado. */
  schedule?: ScheduleStage[];
  /** Duração total da obra em meses, extraída do cronograma. */
  duration_months?: number;
  /** Histórico de relatórios gerados e arquivados. */
  archived_reports?: ArchivedReport[];
  /** Layouts de relatório personalizados pelo usuário. */
  layouts?: LayoutTemplate[];
  /** Datas de importação de documentos para referência. */
  import_metadata?: ImportMetadata;
}

/**
 * Detalhes financeiros calculados para uma única categoria de serviço.
 */
export interface CategoryFinancials {
  /** ID da categoria. */
  id: string;
  /** Nome da categoria. */
  name: string;
  /** Valor monetário liberado/medido com base no progresso. */
  released: number;
  /** Progresso percentual ponderado da categoria. */
  progress: number;
  /** Custo total da categoria. */
  totalCost: number;
  /** Incidência percentual total da categoria no projeto. */
  totalIncidence: number;
  /** Incidência percentual medida (executada) no projeto. */
  measuredIncidence: number;
}

/**
 * Resumo financeiro global calculado para o projeto.
 */
export interface Financials {
  /** Progresso ponderado total do projeto (%). */
  totalProgress: number;
  /** Valor monetário total liberado/medido. */
  totalReleased: number;
  /** Saldo financeiro restante a medir. */
  balanceToMeasure: number;
  /** Detalhes financeiros agregados por categoria. */
  categoryTotals: CategoryFinancials[];
}

/**
 * Detalhes financeiros calculados para uma única unidade habitacional.
 */
export interface UnitFinancials {
  /** ID da unidade. */
  id: string;
  /** Nome da unidade. */
  name: string;
  /** Progresso ponderado total da unidade (%). */
  progress: number;
}

/**
 * Estrutura de dados usada pelo assistente de IA (via function calling)
 * para solicitar atualizações de progresso no projeto.
 */
export interface AssistantProgressUpdate {
  /** Nome do serviço a ser atualizado. */
  serviceName: string;
  /** Nomes das unidades a serem atualizadas (pode conter "all" para todas). */
  unitNames: string[];
  /** Novo valor de progresso a ser aplicado. */
  progress: number;
}
