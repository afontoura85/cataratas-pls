/**
 * @file Contém constantes e templates padrão para a aplicação.
 */
import { PlsCategoryTemplate } from './types';

/**
 * Template padrão da Planilha de Levantamento de Serviços (PLS).
 * Este modelo é utilizado quando um novo projeto é criado sem a importação de um
 * arquivo de orçamento personalizado. Os valores de incidência são baseados no
 * documento "Orçamento Sintético - Habitação" de referência.
 */
export const PLS_TEMPLATE: PlsCategoryTemplate[] = [
  {
    id: '1',
    name: 'SERVIÇOS PRELIMINARES GERAIS',
    subItems: [
      { id: '1.1', name: 'serviços técnicos (projetos, orçamentos, levant. topog., sondagem, licenças e PCMAT)', incidence: 0.57, unit: 'vb' },
      { id: '1.2', name: 'instalações e canteiros (barracão, cercamento e placa da obra)', incidence: 0.69, unit: 'vb' },
      { id: '1.3', name: 'ligações provisórias (água, energia, telefone e esgoto)', incidence: 0.04, unit: 'vb' },
      { id: '1.4', name: 'manutenção canteiro/consumo', incidence: 1.25, unit: 'mes' },
      { id: '1.5', name: 'transportes máquinas e equipamentos', incidence: 0.89, unit: 'vb' },
      { id: '1.6', name: 'controle tecnológico', incidence: 0.08, unit: 'vb' },
      { id: '1.7', name: 'gestão de resíduos', incidence: 0.05, unit: 'vb' },
      { id: '1.8', name: 'gestão da qualidade', incidence: 0.05, unit: 'vb' },
      { id: '1.10', name: 'administração local (engenheiros, mestres, etc.)', incidence: 2.84, unit: 'mes' },
    ],
  },
  {
    id: '2',
    name: 'FUNDAÇÕES E CONTENÇÕES',
    subItems: [
      { id: '2.1', name: 'Fundações', incidence: 7.36, unit: 'etapa' },
    ],
  },
  {
    id: '3',
    name: 'SUPRAESTRUTURA',
    subItems: [
      { id: '3.1', name: 'Supraestrutura', incidence: 14.15, unit: 'etapa' },
    ],
  },
  {
    id: '4',
    name: 'PAREDES E PAINÉIS',
    subItems: [
      { id: '4.1', name: 'alvenaria / fechamentos', incidence: 13.89, unit: 'etapa' },
      { id: '4.2', name: 'esquadrias metálicas', incidence: 5.14, unit: 'un' },
      { id: '4.3', name: 'esquadrias de madeira', incidence: 1.23, unit: 'un' },
    ],
  },
  {
    id: '5',
    name: 'COBERTURA E PROTEÇÕES',
    subItems: [
      { id: '5.1', name: 'telhados', incidence: 4.27, unit: 'etapa' },
      { id: '5.2', name: 'impermeabilizações', incidence: 0.79, unit: 'etapa' },
    ],
  },
  {
    id: '6',
    name: 'REVESTIMENTOS',
    subItems: [
      { id: '6.1', name: 'revestimentos internos', incidence: 4.06, unit: 'etapa' },
      { id: '6.2', name: 'azulejos', incidence: 3.02, unit: 'etapa' },
      { id: '6.3', name: 'revestimentos externos', incidence: 4.07, unit: 'etapa' },
      { id: '6.4', name: 'forros', incidence: 0.85, unit: 'etapa' },
      { id: '6.5', name: 'pinturas', incidence: 6.58, unit: 'etapa' },
    ],
  },
  {
    id: '7',
    name: 'PAVIMENTAÇÃO',
    subItems: [
      { id: '7.2', name: 'cerâmica', incidence: 2.25, unit: 'etapa' },
      { id: '7.4', name: 'cimentados', incidence: 1.53, unit: 'etapa' },
      { id: '7.5', name: 'rodapés, soleiras e peitoris', incidence: 1.02, unit: 'etapa' },
    ],
  },
  {
    id: '8',
    name: 'INSTALAÇÕES',
    subItems: [
      { id: '8.1', name: 'elétricas / telefônicas', incidence: 6.63, unit: 'etapa' },
      { id: '8.2', name: 'hidráulicas / gás / incêndio', incidence: 5.05, unit: 'etapa' },
      { id: '8.3', name: 'sanitárias / pluvial', incidence: 3.35, unit: 'etapa' },
      { id: '8.4', name: 'aparelhos, metais e bancadas', incidence: 2.20, unit: 'un' },
    ],
  },
  {
    id: '9',
    name: 'COMPLEMENTAÇÕES',
    subItems: [
      { id: '9.1', name: 'calafete / limpeza', incidence: 0.56, unit: 'etapa' },
      { id: '9.2', name: 'ligações definitivas', incidence: 1.54, unit: 'vb' },
    ],
  },
  {
    id: '10',
    name: 'INFRAESTRUTURA E URBANIZAÇÃO',
    subItems: [
      { id: '10.1', name: 'terraplenagem', incidence: 0.99, unit: 'etapa' },
      { id: '10.5', name: 'pavimentação', incidence: 1.18, unit: 'etapa' },
      { id: '10.6', name: 'energia e iluminação', incidence: 0.25, unit: 'etapa' },
      { id: '10.9', name: 'obras especiais', incidence: 0.79, unit: 'etapa' },
      { id: '10.10', name: 'paisagismo, equipamentos e ambientação', incidence: 0.79, unit: 'etapa' },
    ],
  },
];
