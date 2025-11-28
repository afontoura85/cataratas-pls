
/**
 * @file Serviço responsável por exportar os dados do projeto para diferentes formatos de arquivo.
 * Suporta exportação para JSON, XLSX (Excel) e PDF, com opções de personalização de conteúdo e layout.
 */
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ServiceCategory, ProgressMatrix, Project, Financials, HousingUnit, ReportOptions, LayoutTemplate } from '../types';

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
 * Trigger a file download from the browser.
 * @param {Blob} blob The file content as a Blob.
 * @param {string} filename The name of the file to download.
 */
const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

/**
 * Tipo estendido para o objeto jsPDF para incluir a propriedade `lastAutoTable`
 * que é adicionada pelo plugin jspdf-autotable.
 */
type jsPDFWithAutoTable = jsPDF & {
  lastAutoTable: {
    finalY: number;
  };
};

/**
 * Calcula o progresso médio de um serviço em todas as unidades habitacionais.
 * @param {number[]} progressRow Array com o progresso (0-100) para um único serviço.
 * @param {number} unitCount O número total de unidades habitacionais.
 * @returns {number} O progresso médio percentual.
 */
const getAverageProgress = (progressRow: number[], unitCount: number): number => {
    if (unitCount === 0) return 0;
    return progressRow.reduce((a, b) => a + b, 0) / unitCount;
}

/**
 * Exporta os dados do relatório selecionado para um arquivo JSON.
 * @param {Project} project O objeto completo do projeto.
 * @param {ServiceCategory[]} plsData A estrutura de serviços calculada.
 * @param {Financials} financials Os dados financeiros calculados.
 * @param {ReportOptions} options As opções de relatório definidas pelo usuário.
 */
export const exportToJSON = (project: Project, plsData: ServiceCategory[], financials: Financials, options: ReportOptions) => {
  const reportData: any = {
    reportTitle: options.title,
    generatedAt: new Date().toISOString(),
  };

  if (options.aiSummary) {
    reportData.aiGeneratedSummary = options.aiSummary;
  }

  if (options.includeProjectDetails) {
    reportData.projectDetails = {
      name: project?.name,
      costOfWorks: project?.cost_of_works,
      developer: project?.developer || { name: '', cnpj: '' },
      constructionCompany: project?.construction_company || { name: '', cnpj: '' },
      address: project?.address || { street: '', city: '', state: '', zip: '', latitude: null, longitude: null },
      responsibleEngineer: project?.responsible_engineer || { name: '', crea: '', email: '' },
      housingUnits: {
        count: project?.housing_units.length,
        units: project?.housing_units,
      },
    };
  }

  if (options.includeFinancialSummary) {
    reportData.financialSummary = financials;
  }

  if (options.includeProgressTable) {
    const filteredPlsData = plsData.filter(cat => options.selectedCategoryIds.includes(cat.id));
    
    reportData.progressTable = filteredPlsData.map(category => ({
      id: category.id,
      name: category.name,
      totalIncidence: category.totalIncidence,
      subItems: category.subItems.map(item => ({
        id: item.id,
        name: item.name,
        incidence: item.incidence,
        cost: item.cost,
        progressPerUnit: project?.progress[item.id] || Array(project?.housing_units.length).fill(0),
        averageProgress: getAverageProgress(project?.progress[item.id] || [], project?.housing_units.length),
      })),
    }));
  }

  if (options.includeUnitDetails) {
    const unitsWithProgress = project?.housing_units.map((unit, unitIndex) => {
        const servicesWithProgress = plsData.flatMap(category => {
            const items = category.subItems
                .map(item => ({ 
                    category: category.name,
                    id: item.id, 
                    name: item.name, 
                    progress: project?.progress[item.id]?.[unitIndex] || 0 
                }))
                .filter(item => item.progress > 0);
            return items;
        });
        return { unitName: unit.name, unitId: unit.id, services: servicesWithProgress };
    }).filter(u => u.services.length > 0);
    reportData.detailedProgressByUnit = unitsWithProgress;
  }

  const jsonString = JSON.stringify(reportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  triggerDownload(blob, `PLS_Relatorio_${project?.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
};

/**
 * Exporta a PLS completa para um arquivo XLSX (Excel), formatado de acordo com o modelo de referência da CEF.
 * @param {Project} project O objeto completo do projeto.
 * @param {ServiceCategory[]} plsData A estrutura de serviços calculada.
 * @param {Financials} financials Os dados financeiros calculados.
 * @param {ReportOptions} options As opções de relatório definidas pelo usuário (usado para contexto).
 */
export const exportToXLSX = (project: Project, plsData: ServiceCategory[], financials: Financials, options: ReportOptions) => {
    const wb = XLSX.utils.book_new();
    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];
    
    const numUnits = project.housing_units.length;
    const baseColsCount = 4; // Item, Discriminação, Incidência Global, Incidência Mensurada
    const totalCols = baseColsCount + numUnits;

    let currentRow = 0;

    // Helper to add a merged row
    const addMergedRow = (content: string | null, empty: boolean = false) => {
        aoa.push(empty ? [] : [content]);
        // Ensure we have at least one cell for the merge to be valid in case of content
        if (!empty && content === null) aoa[aoa.length - 1] = [''];
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: totalCols - 1 } });
        currentRow++;
    };

    // 1. Title
    addMergedRow('PLANILHA DE LEVANTAMENTO DE SERVIÇOS EXECUTADOS - PLS');

    // 2. Medição (No empty row before)
    addMergedRow(`Medição: ${options.measurementNumber || '1'}`);

    // 3. Data da Medição
    const currentDate = new Date().toLocaleDateString('pt-BR');
    addMergedRow(`Data da Medição: ${currentDate}`);

    // 4. Empty
    // REMOVED empty row as per previous request

    // 5. Project Name
    addMergedRow(project.name);

    // 6. Proponente
    const proponenteText = `Proponente: ${project.developer?.name || 'N/A'} - CNPJ: ${project.developer?.cnpj || 'N/A'}`;
    addMergedRow(proponenteText);

    // 7. Construtora
    const construtoraText = `Construtora: ${project.construction_company?.name || 'N/A'} - CNPJ: ${project.construction_company?.cnpj || 'N/A'}`;
    addMergedRow(construtoraText);
    
    // 8. Resp Técnico
    const respTecnicoText = `Responsável Técnico: ${project.responsible_engineer?.name || 'N/A'} - CREA: ${project.responsible_engineer?.crea || 'N/A'}`;
    addMergedRow(respTecnicoText);

    // 9. Address
    const fullAddress = project.address ? `${project.address.street || ''}, ${project.address.city || ''} - ${project.address.state || ''}` : 'N/A';
    addMergedRow(`Endereço da Obra: ${fullAddress}`);

    // 10. Empty
    addMergedRow(null, true);

    // 11. Incidência Mensurada
    addMergedRow(`Incidência Mensurada: ${financials.totalProgress.toFixed(2)}%`);

    // 12. Executado
    addMergedRow(`Executado: ${formatCurrency(financials.totalReleased)}`);

    // 13. Custo da Obra
    addMergedRow(`Custo da Obra: ${formatCurrency(project.cost_of_works)}`);

    // 14. Empty
    addMergedRow(null, true);

    // Table Header
    aoa.push([
        'Item',
        'Discriminação do Evento',
        'Incidência Global (%)',
        'Incidência Mensurada (%)',
        ...project.housing_units.map(u => u.name)
    ]);
    
    // Style for macro-item rows (light gray background)
    const categoryStyle = { fill: { patternType: "solid", fgColor: { rgb: "FFF0F0F0" } } };

    // Table Body
    plsData.forEach(category => {
        const categoryFinancials = financials.categoryTotals.find(c => c.id === category.id);
        const categoryIncidence = categoryFinancials ? categoryFinancials.totalIncidence : 0;
        const categoryProgress = categoryFinancials ? categoryFinancials.progress : 0;
        const categoryMeasuredIncidence = (categoryProgress * categoryIncidence) / 100;
        
        // Category row (macro-item)
        const categoryRowData: any[] = [
            `${category.id}.0`, 
            category.name,
            { t: 'n', v: categoryIncidence / 100, z: '0.00%' },
            { t: 'n', v: categoryMeasuredIncidence / 100, z: '0.00%' }
        ];

        // Apply style to each cell in the category row
        const styledCategoryRow = categoryRowData.map(cell => {
            if (typeof cell === 'object' && cell !== null) {
                return { ...cell, s: categoryStyle };
            }
            return { v: cell, s: categoryStyle };
        });

        // Fill remaining cells in the row with the style to cover the full width
        while (styledCategoryRow.length < totalCols) {
            styledCategoryRow.push({ v: '', s: categoryStyle });
        }
        aoa.push(styledCategoryRow);

        // Sub-items rows
        category.subItems.forEach(item => {
            const currentProgressRow = project.progress[item.id] || Array(numUnits).fill(0);
            const avgProgress = getAverageProgress(currentProgressRow, numUnits);
            const itemMeasuredIncidence = (item.incidence * avgProgress) / 100;

            aoa.push([
                item.id,
                item.name,
                { t: 'n', v: item.incidence / 100, z: '0.00%' },
                { t: 'n', v: itemMeasuredIncidence / 100, z: '0.00%' },
                ...currentProgressRow.map(p => ({ t: 'n', v: p / 100, z: '0.00%' })),
            ]);
        });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    
    // Column widths
    ws['!cols'] = [
        { wch: 8 }, 
        { wch: 45 }, 
        { wch: 12 },
        { wch: 15 }, // Coluna de Incidência Mensurada
        ...Array(numUnits).fill({ wch: 10 }),
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'PLS Executados');
    XLSX.writeFile(wb, `PLS_Relatorio_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};


/**
 * Obtém as dimensões de uma imagem a partir de sua representação em base64.
 * @param {string} base64 A string da imagem em base64.
 * @returns {Promise<{ width: number; height: number }>} As dimensões da imagem.
 */
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = (err) => {
            reject(err);
        };
        img.src = base64;
    });
};

/**
 * Exporta um relatório completo e personalizado para um arquivo PDF.
 * @param {Project} project O objeto completo do projeto.
 * @param {ServiceCategory[]} plsData A estrutura de serviços calculada.
 * @param {Financials} financials Os dados financeiros calculados.
 * @param {ReportOptions} options As opções de relatório e layout definidas pelo usuário.
 */
export const exportToPDF = async (project: Project, plsData: ServiceCategory[], financials: Financials, options: ReportOptions) => {
  const doc = new jsPDF({
    orientation: options.orientation || 'p'
  }) as jsPDFWithAutoTable;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let lastY = 0;
  
  const layout = options.layout || {
      primaryColor: '#0284c7', logoBase64: null, headerLogoBase64: null, fontFamily: 'helvetica', headerText: undefined, footerText: undefined
  };
  
  const reportFont = layout.fontFamily?.toLowerCase() || 'helvetica';

  const fonts = { sizes: { h1: 18, h2: 14, h3: 11, body: 9, small: 8 } };
  const colors = {
      primary: layout.primaryColor,
      secondary: '#334155',
      headerBg: '#f0f9ff',
      text: '#0f172a',
      subtleText: '#64748b',
      line: '#e2e8f0',
      progressBg: '#dbeafe',
  };

  const headerLogoToUse = layout.headerLogoBase64 || layout.logoBase64;
  let headerLogoDimensions: { width: number; height: number } | null = null;
  if (headerLogoToUse) {
      try {
          headerLogoDimensions = await getImageDimensions(headerLogoToUse);
      } catch (error) {
          console.error("Error loading header logo for PDF:", error);
      }
  }

  const header = (data: any) => {
    doc.setFont(reportFont, 'normal');
    doc.setFontSize(fonts.sizes.small);
    doc.setTextColor(colors.subtleText);
    
    const headerContentY = 10;
    const lineY = 16;
    const headerText = layout.headerText || project.name;

    if (headerLogoToUse && headerLogoDimensions) {
        const maxHeaderHeight = 5;
        const maxHeaderWidth = 20;
        
        const scale = Math.min(maxHeaderWidth / headerLogoDimensions.width, maxHeaderHeight / headerLogoDimensions.height);

        const headerLogoWidth = headerLogoDimensions.width * scale;
        const headerLogoHeight = headerLogoDimensions.height * scale;
        const logoY = headerContentY - (headerLogoHeight / 2);

        doc.addImage(headerLogoToUse, 'PNG', margin, logoY, headerLogoWidth, headerLogoHeight);
        doc.text(headerText, margin + headerLogoWidth + 4, headerContentY, { baseline: 'middle' });
    } else {
        doc.text(headerText, margin, headerContentY, { baseline: 'middle' });
    }
    
    doc.text(options.title, pageWidth - margin, headerContentY, { align: 'right', baseline: 'middle' });
    doc.setDrawColor(colors.line);
    doc.line(margin, lineY, pageWidth - margin, lineY);
  };
  
  const footer = (data: any) => {
    const pageCount = (doc.internal as any).getNumberOfPages();
    const footerText = layout.footerText || `${project.name} - ${project.address.city || ''}, ${project.address.state || ''}`;
    const generatedAtText = `Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
    doc.setFont(reportFont, 'normal');
    doc.setFontSize(fonts.sizes.small);
    doc.setTextColor(colors.subtleText);
    doc.text(footerText, margin, pageHeight - 10);
    doc.text(generatedAtText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    const text = `Página ${data.pageNumber} de ${pageCount}`;
    doc.text(text, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };
  
  const addTitledTable = (title: string, autoTableOptions: any) => {
    let startY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : 22;
    const titleHeight = 6; 
    const titleMargin = 4;
    
    if (startY + titleHeight + titleMargin > pageHeight - 40) { // Check if title fits
      doc.addPage();
      startY = 22;
      doc.lastAutoTable.finalY = 0;
    }

    doc.setFont(reportFont, 'bold');
    doc.setFontSize(fonts.sizes.h2);
    doc.setTextColor(colors.secondary);
    doc.text(title, margin, startY);

    autoTable(doc, {
      ...autoTableOptions,
      startY: startY + titleHeight + titleMargin,
      margin: { top: 20 },
    });
  };

  // --- COVER PAGE ---
  let coverLogoDimensions: { width: number; height: number } | null = null;
  if (layout.logoBase64) {
      try {
          coverLogoDimensions = await getImageDimensions(layout.logoBase64);
      } catch (error) {
          console.error("Error loading cover logo for PDF:", error);
      }
  }

  if(layout.logoBase64 && coverLogoDimensions) {
    const maxCoverWidth = 50;
    const maxCoverHeight = 35;
    const scale = Math.min(maxCoverWidth / coverLogoDimensions.width, maxCoverHeight / coverLogoDimensions.height);
    const coverLogoWidth = coverLogoDimensions.width * scale;
    const coverLogoHeight = coverLogoDimensions.height * scale;
    const x = (pageWidth - coverLogoWidth) / 2;
    const y = 20;
    doc.addImage(layout.logoBase64, 'PNG', x, y, coverLogoWidth, coverLogoHeight, undefined, 'FAST');
  }
  
  // Title
  doc.setFont(reportFont, 'bold');
  doc.setFontSize(22);
  doc.setTextColor(colors.text);
  doc.text(options.title, pageWidth / 2, 60, { align: 'center' });
  
  // Measurement and Project info above Proponente table
  const currentDate = new Date().toLocaleDateString('pt-BR');
  
  doc.setFont(reportFont, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(colors.secondary);
  
  // Positioning these fields left-aligned with the margin
  doc.text(`Medição: ${options.measurementNumber || '1'}`, margin, 80);
  doc.text(`Data da medição: ${currentDate}`, margin, 86);
  doc.text(`Empreendimento: ${project.name}`, margin, 92);

  const fullAddress = project.address ? `${project.address.street || ''}, ${project.address.city || ''} - ${project.address.state || ''}` : 'N/A';
  autoTable(doc, {
    body: [
      [`Proponente:`, `${project.developer?.name || 'N/A'} - CNPJ: ${project.developer?.cnpj || 'N/A'}`],
      [`Construtora:`, `${project.construction_company?.name || 'N/A'} - CNPJ: ${project.construction_company?.cnpj || 'N/A'}`],
      [`Responsável Técnico:`, `${project.responsible_engineer?.name || 'N/A'} - CREA: ${project.responsible_engineer?.crea || 'N/A'}`],
      [`Endereço da Obra:`, fullAddress],
    ],
    startY: 100,
    theme: 'plain',
    styles: { fontSize: fonts.sizes.body, font: reportFont },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }
  });
  lastY = doc.lastAutoTable.finalY + 10;
  
  const keyMetrics = [
    { title: 'Incidência Mensurada', value: `${financials.totalProgress.toFixed(2)}%`, color: colors.primary },
    { title: 'Executado', value: formatCurrency(financials.totalReleased), color: '#16a34a' },
    { title: 'Custo da Obra', value: formatCurrency(project.cost_of_works), color: colors.text }
  ];
  const cardWidth = (pageWidth - (margin * 2) - 10) / 3;
  keyMetrics.forEach((metric, index) => {
    const x = margin + (index * (cardWidth + 5));
    doc.setDrawColor(colors.line);
    doc.setFillColor(colors.headerBg);
    doc.roundedRect(x, lastY, cardWidth, 20, 2, 2, 'FD');
    doc.setFont(reportFont, 'normal');
    doc.setFontSize(fonts.sizes.small);
    doc.setTextColor(colors.subtleText);
    doc.text(metric.title, x + 5, lastY + 7);
    doc.setFontSize(fonts.sizes.h3);
    doc.setFont(reportFont, 'bold');
    doc.setTextColor(metric.color);
    doc.text(metric.value, x + 5, lastY + 15);
  });
  doc.lastAutoTable.finalY = lastY + 30;

  // --- AI SUMMARY ---
  if (options.aiSummary) {
    const summaryLines = doc.splitTextToSize(options.aiSummary, pageWidth - (margin * 2) - 10);
    const requiredHeight = (summaryLines.length * 4) + 10 + 15;
    if (doc.lastAutoTable.finalY + requiredHeight > pageHeight - 20) {
        doc.addPage();
        doc.lastAutoTable.finalY = 0;
    }
    
    let startY = doc.lastAutoTable.finalY === 0 ? 22 : doc.lastAutoTable.finalY + 15;
    
    doc.setFont(reportFont, 'bold');
    doc.setFontSize(fonts.sizes.h2);
    doc.setTextColor(colors.secondary);
    doc.text('Resumo Executivo (Análise por IA)', margin, startY);
    startY += 6;

    doc.setFont(reportFont, 'normal');
    doc.setFontSize(fonts.sizes.body);
    doc.setTextColor(colors.text);
    doc.setFillColor(colors.headerBg);
    doc.roundedRect(margin, startY, pageWidth - (margin * 2), (summaryLines.length * 4) + 10, 2, 2, 'F');
    doc.text(summaryLines, margin + 5, startY + 7);
    doc.lastAutoTable.finalY = startY + (summaryLines.length * 4) + 10;
  }

  // --- FINANCIAL SUMMARY ---
  if (options.includeFinancialSummary) {
    // Calculate totals
    const totalGlobalIncidence = financials.categoryTotals.reduce((sum, cat) => sum + cat.totalIncidence, 0);
    const totalMeasuredIncidence = financials.categoryTotals.reduce((sum, cat) => sum + ((cat.progress * cat.totalIncidence) / 100), 0);
    const totalReleased = financials.categoryTotals.reduce((sum, cat) => sum + cat.released, 0);
    const totalCost = financials.categoryTotals.reduce((sum, cat) => sum + cat.totalCost, 0);
    
    addTitledTable('Resumo Financeiro por Etapa', {
      head: [['Etapa', 'Incidência Global', 'Incidência Mensurada', 'Progresso', 'Valor Liberado', 'Custo Total']],
      body: financials.categoryTotals.map(cat => {
          const measuredIncidence = (cat.progress * cat.totalIncidence) / 100;
          return [
            { content: `${cat.id}. ${cat.name}` },
            `${cat.totalIncidence.toFixed(2)}%`,
            `${measuredIncidence.toFixed(2)}%`,
            { content: `${cat.progress.toFixed(2)}%`, data: cat.progress },
            formatCurrency(cat.released),
            formatCurrency(cat.totalCost),
          ];
        }
      ),
      foot: [[
        'TOTAL',
        `${totalGlobalIncidence.toFixed(2)}%`,
        `${totalMeasuredIncidence.toFixed(2)}%`,
        '',
        formatCurrency(totalReleased),
        formatCurrency(totalCost)
      ]],
      theme: 'grid',
      headStyles: { fillColor: colors.secondary, fontSize: fonts.sizes.h3, font: reportFont },
      footStyles: { fillColor: colors.secondary, textColor: '#ffffff', fontStyle: 'bold', fontSize: fonts.sizes.body, font: reportFont },
      styles: { fontSize: fonts.sizes.body, cellPadding: 2, valign: 'middle', font: reportFont },
      columnStyles: { 
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { cellWidth: 40, halign: 'left' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      didDrawPage: (data: any) => { header(data); },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
            const percentage = (data.cell.raw as { data: number }).data;
            if (typeof percentage === 'number') {
                const barWidth = data.cell.width - 22;
                const barHeight = 4;
                const x = data.cell.x + 20;
                const y = data.cell.y + (data.cell.height / 2) - 2;
                doc.setFillColor(colors.progressBg);
                doc.rect(x, y, barWidth, barHeight, 'F');
                doc.setFillColor(colors.primary);
                doc.rect(x, y, barWidth * (percentage / 100), barHeight, 'F');
            }
        }
      }
    });
  }

  // --- DETAILED PLS PROGRESS TABLE ---
  if (options.includeProgressTable) {
    const filteredPlsData = plsData.filter(cat => options.selectedCategoryIds.includes(cat.id));
    const tableBody: any[] = [];
    filteredPlsData.forEach(cat => {
      // Calculate Category Measured Incidence Sum
      const catMeasuredIncidence = cat.subItems.reduce((sum, item) => {
         const avgProgress = getAverageProgress(project.progress[item.id] || [], project.housing_units.length);
         return sum + ((item.incidence * avgProgress) / 100);
      }, 0);

      const categoryStyles = { fontStyle: 'bold', fillColor: colors.headerBg, textColor: colors.secondary };
      tableBody.push([
        { content: `${cat.id}. ${cat.name}`, colSpan: 2, styles: categoryStyles },
        { content: `${cat.totalIncidence.toFixed(2)}%`, styles: { ...categoryStyles, halign: 'right' } },
        { content: `${catMeasuredIncidence.toFixed(2)}%`, styles: { ...categoryStyles, halign: 'right' } },
        { content: '', colSpan: 3, styles: categoryStyles },
      ]);

      cat.subItems.forEach(item => {
        const avgProgress = getAverageProgress(project.progress[item.id] || [], project.housing_units.length);
        const measuredIncidence = (item.incidence * avgProgress) / 100;
        
        tableBody.push([
          item.id,
          item.name,
          `${item.incidence.toFixed(2)}%`,
          `${measuredIncidence.toFixed(2)}%`,
          { content: `${avgProgress.toFixed(2)}%`, data: avgProgress },
          formatCurrency(item.cost * (avgProgress / 100)),
          formatCurrency(item.cost),
        ]);
      });
    });

    addTitledTable('Detalhamento de Progresso da PLS', {
      head: [['ID', 'Serviço', 'Incidência Global', 'Incidência Mensurada', 'Prog. Médio', 'Valor Liberado', 'Custo Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: colors.secondary, fontSize: fonts.sizes.body, font: reportFont },
      styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', font: reportFont },
      columnStyles: { 
          0: { cellWidth: 12 }, 
          2: { cellWidth: 20, halign: 'right' }, 
          3: { cellWidth: 20, halign: 'right' }, 
          4: { cellWidth: 35, halign: 'left' },
          5: { cellWidth: 32, halign: 'right' },
          6: { cellWidth: 32, halign: 'right' }
      },
      didDrawPage: (data: any) => { header(data); },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
            const percentage = (data.cell.raw as { data: number }).data;
            if (typeof percentage === 'number') {
                const barWidth = data.cell.width - 22;
                const barHeight = 4;
                const x = data.cell.x + 20;
                const y = data.cell.y + (data.cell.height / 2) - 2;
                doc.setFillColor(colors.progressBg);
                doc.rect(x, y, barWidth, barHeight, 'F');
                doc.setFillColor(colors.primary);
                doc.rect(x, y, barWidth * (percentage / 100), barHeight, 'F');
            }
        }
      }
    });
  }

  // --- DETAILED PROGRESS BY UNIT MATRIX ---
  if (options.includeUnitDetails && project.housing_units.length > 0) {
    const headRow1: any[] = [{ content: 'Serviço', rowSpan: 2, styles: { valign: 'middle' } }];
    const headRow2: any[] = [];

    const topDigitsWithSpans: { label: string; colSpan: number }[] = [];
    project.housing_units.forEach((_, i) => {
        const unitNum = i + 1;
        const topDigit = String(Math.floor((unitNum - 1) / 10));
        let bottomDigit = String((unitNum-1) % 10 + 1);
        if (bottomDigit === '10') bottomDigit = '0';
        
        if (topDigitsWithSpans.length > 0 && topDigitsWithSpans[topDigitsWithSpans.length - 1].label === topDigit) {
            topDigitsWithSpans[topDigitsWithSpans.length - 1].colSpan++;
        } else {
            topDigitsWithSpans.push({ label: topDigit, colSpan: 1 });
        }
        headRow2.push(bottomDigit);
    });
    topDigitsWithSpans.forEach(group => {
        headRow1.push({ content: group.label, colSpan: group.colSpan, styles: { halign: 'center' } });
    });

    const body = plsData
        .filter(cat => options.selectedCategoryIds.includes(cat.id))
        .flatMap(cat =>
            cat.subItems.map(item => [
                `${item.id} ${item.name}`,
                ...project.housing_units.map((_, unitIndex) => {
                    const progress = project.progress[item.id]?.[unitIndex] || 0;
                    return progress === 100 ? 'X' : progress.toFixed(0);
                })
            ])
        );

    const matrixTableOptions = {
      head: [headRow1, headRow2],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: colors.secondary, fontSize: 8, halign: 'center', font: reportFont, lineWidth: 0.1 },
      styles: { fontSize: 7, cellPadding: 1, halign: 'center', font: reportFont, lineWidth: 0.1 },
      columnStyles: { 0: { halign: 'left', cellWidth: 50, fontStyle: 'bold' } },
      didDrawPage: (data: any) => { header(data); },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0 && data.cell.raw === 'X') {
            data.cell.styles.fillColor = [34, 197, 94];
            data.cell.styles.textColor = '#FFFFFF';
            data.cell.styles.fontStyle = 'bold';
        }
      },
    };
    
    // Custom handling for the Unit Matrix table to include a subtitle
    let matrixStartY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 15 : 22;
    const titleHeight = 6; 
    const subtitleHeight = 5;
    const titleMargin = 4;
    
    if (matrixStartY + titleHeight + subtitleHeight + titleMargin > pageHeight - 40) { // Check if title/subtitle fits
      doc.addPage();
      matrixStartY = 22;
      doc.lastAutoTable.finalY = 0;
    }

    doc.setFont(reportFont, 'bold');
    doc.setFontSize(fonts.sizes.h2);
    doc.setTextColor(colors.secondary);
    doc.text('Matriz de Progresso por Unidade', margin, matrixStartY);
    matrixStartY += titleHeight + 2;

    doc.setFont(reportFont, 'normal');
    doc.setFontSize(fonts.sizes.body);
    doc.setTextColor(colors.subtleText);
    doc.text('X = 100%', margin, matrixStartY);
    matrixStartY += titleMargin;

    autoTable(doc, {
      ...matrixTableOptions,
      startY: matrixStartY,
      margin: { top: 20 },
    });
  }

  // --- SIGNATURES ---
  let pageCount = (doc.internal as any).getNumberOfPages();
  doc.setPage(pageCount);

  if (doc.lastAutoTable.finalY > pageHeight - 80) { // Check if signatures fit
      doc.addPage();
      pageCount++;
      doc.setPage(pageCount);
  }

  const signatureY = pageHeight - 60;
  const lineLength = 80;
  const center1 = pageWidth / 4 + margin / 2;
  const center2 = (pageWidth * 3) / 4 - margin / 2;

  doc.setDrawColor(colors.text);
  doc.setFont(reportFont, 'normal');

  doc.line(center1 - lineLength / 2, signatureY, center1 + lineLength / 2, signatureY);
  doc.setFontSize(fonts.sizes.body);
  doc.setTextColor(colors.text);
  doc.text(project.developer?.name || 'N/A', center1, signatureY + 7, { align: 'center' });
  doc.setFontSize(fonts.sizes.small);
  doc.setTextColor(colors.subtleText);
  doc.text('Proponente', center1, signatureY + 12, { align: 'center' });
  
  doc.line(center2 - lineLength / 2, signatureY, center2 + lineLength / 2, signatureY);
  doc.setFontSize(fonts.sizes.body);
  doc.setTextColor(colors.text);
  doc.text(project.responsible_engineer?.name || 'N/A', center2, signatureY + 7, { align: 'center' });
  doc.setFontSize(fonts.sizes.small);
  doc.setTextColor(colors.subtleText);
  doc.text('Responsável Técnico', center2, signatureY + 12, { align: 'center' });

  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      footer({ pageNumber: i, pageCount: pageCount });
  }

  doc.save(`Relatorio_${project.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Exports progress data for a specific unit to a JSON file.
 * @param {Project} project The project object.
 * @param {ServiceCategory[]} plsData The PLS data structure.
 * @param {HousingUnit} unit The unit to export.
 */
export const exportUnitToJSON = (project: Project, plsData: ServiceCategory[], unit: HousingUnit) => {
    const unitIndex = project.housing_units.findIndex(u => u.id === unit.id);
    if (unitIndex === -1) return;

    const data = {
        unit: unit.name,
        project: project.name,
        generated_at: new Date().toISOString(),
        services: [] as any[],
    };

    plsData.forEach(cat => {
        cat.subItems.forEach(item => {
            const progress = project.progress[item.id]?.[unitIndex] || 0;
            if (progress > 0) {
                data.services.push({
                    category: cat.name,
                    id: item.id,
                    name: item.name,
                    progress: progress,
                    status: progress === 100 ? 'Concluído' : 'Em Andamento'
                });
            }
        });
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${project.name.replace(/\s+/g, '_')}_${unit.name.replace(/\s+/g, '_')}_progresso.json`);
};

/**
 * Exports progress data for a specific unit to a CSV file (compatible with Excel).
 * @param {Project} project The project object.
 * @param {ServiceCategory[]} plsData The PLS data structure.
 * @param {HousingUnit} unit The unit to export.
 */
export const exportUnitToCSV = (project: Project, plsData: ServiceCategory[], unit: HousingUnit) => {
    const unitIndex = project.housing_units.findIndex(u => u.id === unit.id);
    if (unitIndex === -1) return;

    const wsData: any[][] = [
        ['Categoria', 'ID', 'Serviço', 'Progresso (%)', 'Status']
    ];

    plsData.forEach(cat => {
        cat.subItems.forEach(item => {
            const progress = project.progress[item.id]?.[unitIndex] || 0;
            if (progress > 0) {
                wsData.push([
                    cat.name,
                    item.id,
                    item.name,
                    progress,
                    progress === 100 ? 'Concluído' : 'Em Andamento'
                ]);
            }
        });
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Progresso");
    XLSX.writeFile(wb, `${project.name.replace(/\s+/g, '_')}_${unit.name.replace(/\s+/g, '_')}_progresso.csv`);
};
