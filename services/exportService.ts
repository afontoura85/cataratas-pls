
/**
 * @file Serviço responsável por exportar os dados do relatório selecionado para diferentes formatos de arquivo.
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
 * Inclui fórmulas do Excel para cálculos automáticos ao editar a planilha.
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

    // 4. Project Name
    addMergedRow(project.name);

    // 5. Proponente
    const proponenteText = `Proponente: ${project.developer?.name || 'N/A'} - CNPJ: ${project.developer?.cnpj || 'N/A'}`;
    addMergedRow(proponenteText);

    // 6. Construtora
    const construtoraText = `Construtora: ${project.construction_company?.name || 'N/A'} - CNPJ: ${project.construction_company?.cnpj || 'N/A'}`;
    addMergedRow(construtoraText);
    
    // 7. Resp Técnico
    const respTecnicoText = `Responsável Técnico: ${project.responsible_engineer?.name || 'N/A'} - CREA: ${project.responsible_engineer?.crea || 'N/A'}`;
    addMergedRow(respTecnicoText);

    // 8. Address
    const fullAddress = project.address ? `${project.address.street || ''}, ${project.address.city || ''} - ${project.address.state || ''}` : 'N/A';
    addMergedRow(`Endereço da Obra: ${fullAddress}`);

    // 9. Empty
    addMergedRow(null, true);

    // 10. Incidência Mensurada (Placeholder, will update with formula later)
    // We store the row index to update it after generating the table body
    const incMeasRowIndex = currentRow;
    addMergedRow(`Incidência Mensurada: ${financials.totalProgress.toFixed(2)}%`);

    // 11. Executado (Placeholder, will update with formula later)
    const executedRowIndex = currentRow;
    addMergedRow(`Executado: ${formatCurrency(financials.totalReleased)}`);

    // 12. Custo da Obra
    addMergedRow(`Custo da Obra: ${formatCurrency(project.cost_of_works)}`);

    // 13. Empty
    addMergedRow(null, true);

    // Table Header
    aoa.push([
        'Item',
        'Discriminação do Evento',
        'Incidência Global (%)',
        'Incidência Mensurada (%)',
        ...project.housing_units.map(u => u.name)
    ]);
    
    // Calculate where data starts (current AOA length is the header row, so data starts at length)
    // In Excel 1-based indexing, the first data row is aoa.length + 1
    const dataStartRow = aoa.length + 1;

    // Style for macro-item rows (light gray background)
    const categoryStyle = { fill: { patternType: "solid", fgColor: { rgb: "FFF0F0F0" } } };
    // Style for Total row (Bold)
    const totalStyle = { font: { bold: true } };

    // Array to store the exact Excel row numbers of the category (macro-item) rows
    const categoryRowIndices: number[] = [];

    // Table Body with Formulas
    plsData.forEach(category => {
        // Calculate rows for formulas (XLSX uses 1-based indexing for formulas)
        const categoryExcelRow = aoa.length + 1;
        categoryRowIndices.push(categoryExcelRow);

        const numSubItems = category.subItems.length;
        
        // Define range for sub-items
        const subItemsStartRow = categoryExcelRow + 1;
        const subItemsEndRow = categoryExcelRow + numSubItems;

        // FORMULAS FOR CATEGORY ROW
        // Col C (Incidence Global): Sum of sub-items column C
        const catGlobalIncFormula = numSubItems > 0 
            ? `SUM(C${subItemsStartRow}:C${subItemsEndRow})` 
            : undefined;
        
        // Col D (Measured Inc): Sum of sub-items column D multiplied by Global Incidence * 10
        const catMeasuredIncFormula = numSubItems > 0
            ? `SUM(D${subItemsStartRow}:D${subItemsEndRow})*C${categoryExcelRow}*10`
            : undefined;

        // Category row (macro-item)
        const categoryRowData: any[] = [
            `${category.id}.0`, 
            category.name,
            // If we have subitems, use SUM formula, otherwise use value
            catGlobalIncFormula 
                ? { t: 'n', f: catGlobalIncFormula, z: '0.00%' } 
                : { t: 'n', v: category.totalIncidence / 100, z: '0.00%' },
            catMeasuredIncFormula
                ? { t: 'n', f: catMeasuredIncFormula, z: '0.00%' }
                : { t: 'n', v: 0, z: '0.00%' } // Initial value 0 if no items
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
        category.subItems.forEach((item, index) => {
            const currentProgressRow = project.progress[item.id] || Array(numUnits).fill(0);
            
            // FORMULA FOR SUB-ITEM MEASURED INCIDENCE
            // Col D = Col C (Incidence) * AVERAGE(Col E : Col Last)
            // Excel Row for this item: categoryExcelRow + 1 + index
            const itemExcelRow = categoryExcelRow + 1 + index;
            
            let itemMeasuredFormula = undefined;
            if (numUnits > 0) {
                const firstUnitCol = XLSX.utils.encode_col(4); // Column E (index 4)
                const lastUnitCol = XLSX.utils.encode_col(4 + numUnits - 1);
                // Formula: =C{row} * AVERAGE(E{row}:LastUnit{row})
                itemMeasuredFormula = `C${itemExcelRow}*AVERAGE(${firstUnitCol}${itemExcelRow}:${lastUnitCol}${itemExcelRow})`;
            }

            aoa.push([
                item.id,
                item.name,
                { t: 'n', v: item.incidence / 100, z: '0.00%' },
                itemMeasuredFormula 
                    ? { t: 'n', f: itemMeasuredFormula, z: '0.00%' } 
                    : { t: 'n', v: 0, z: '0.00%' },
                ...currentProgressRow.map(p => ({ t: 'n', v: p / 100, z: '0.00%' })),
            ]);
        });
    });

    // UPDATE HEADER FORMULAS & ADD TOTAL ROW
    // Construct formula strings for TOTAL row: =SUM(C15+C25+...)
    // This assumes standard Excel addition of specific cells.
    const globalIncidenceSumFormula = categoryRowIndices.length > 0 
        ? `SUM(${categoryRowIndices.map(row => `C${row}`).join('+')})` 
        : '0';
        
    const measuredIncidenceSumFormula = categoryRowIndices.length > 0 
        ? `SUM(${categoryRowIndices.map(row => `D${row}`).join('+')})` 
        : '0';

    // The total row is the next row index
    const totalRowIndex = aoa.length + 1;

    // Add TOTAL Row
    const totalRow = [
        { v: 'TOTAL', s: totalStyle },
        { v: '', s: totalStyle },
        { t: 'n', f: globalIncidenceSumFormula, z: '0.00%', s: totalStyle }, // Col C
        { t: 'n', f: measuredIncidenceSumFormula, z: '0.00%', s: totalStyle }, // Col D
        // Empty cells for unit columns, but styled
        ...Array(numUnits).fill({ v: '', s: totalStyle })
    ];
    aoa.push(totalRow);
    
    // Update Incidência Mensurada Cell with Formula in Header (e.g., C61 where 61 is the last row)
    // Formula: ="Incidência Mensurada: " & TEXT(D_TotalRow, "0.00%")
    const headerIncMeasFormula = `="Incidência Mensurada: " & TEXT(D${totalRowIndex}, "0.00%")`;
    aoa[incMeasRowIndex] = [{ t: 's', f: headerIncMeasFormula }];

    // Update Executado Cell with Formula in Header
    // Formula: ="Executado: " & TEXT(D_TotalRow * Custo_Obra, "R$ #.##0,00")
    // We need to find the cell for cost of works. It's row 12 (index 11).
    // But since row 12 is merged and contains text "Custo da Obra: R$ ...", we should probably parse it or use raw value.
    // However, for formula consistency, we can just use the value directly in the formula since it's static in the header.
    // Ideally we would put the raw cost in a cell and reference it, but let's hardcode the value for now to be safe with the merges.
    const costOfWorksVal = project.cost_of_works;
    const headerExecutedFormula = `="Executado: " & TEXT(D${totalRowIndex}*${costOfWorksVal}, "R$ #.##0,00")`;
    aoa[executedRowIndex] = [{ t: 's', f: headerExecutedFormula }];


    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;

    // Set column widths
    const wscols = [
        { wch: 10 }, // Item
        { wch: 50 }, // Discriminação
        { wch: 20 }, // Incidência Global
        { wch: 20 }, // Incidência Mensurada
        ...Array(numUnits).fill({ wch: 8 }) // Units
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, 'PLS');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    triggerDownload(blob, `PLS_${project.name.replace(/\s+/g, '_')}_${options.measurementNumber}.xlsx`);
};

/**
 * Exporta o progresso de uma única unidade para um arquivo JSON.
 * @param {Project} project O projeto completo.
 * @param {ServiceCategory[]} plsData Dados da PLS.
 * @param {HousingUnit} unit A unidade a ser exportada.
 */
export const exportUnitToJSON = (project: Project, plsData: ServiceCategory[], unit: HousingUnit) => {
    const unitIndex = project.housing_units.findIndex(u => u.id === unit.id);
    if (unitIndex === -1) return;

    const exportData = {
        project: project.name,
        unit: unit.name,
        generatedAt: new Date().toISOString(),
        progress: [] as any[]
    };

    plsData.forEach(category => {
        category.subItems.forEach(item => {
            const progress = project.progress[item.id]?.[unitIndex] || 0;
            if (progress > 0) {
                exportData.progress.push({
                    category: category.name,
                    service: item.name,
                    progress: progress
                });
            }
        });
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `Relatorio_${unit.name.replace(/\s+/g, '_')}.json`);
};

/**
 * Exporta o progresso de uma única unidade para um arquivo CSV (Excel).
 * @param {Project} project O projeto completo.
 * @param {ServiceCategory[]} plsData Dados da PLS.
 * @param {HousingUnit} unit A unidade a ser exportada.
 */
export const exportUnitToCSV = (project: Project, plsData: ServiceCategory[], unit: HousingUnit) => {
    const unitIndex = project.housing_units.findIndex(u => u.id === unit.id);
    if (unitIndex === -1) return;

    const aoa = [
        ['Projeto', project.name],
        ['Unidade', unit.name],
        ['Data', new Date().toLocaleDateString('pt-BR')],
        [],
        ['Categoria', 'Serviço', 'Progresso (%)']
    ];

    plsData.forEach(category => {
        category.subItems.forEach(item => {
            const progress = project.progress[item.id]?.[unitIndex] || 0;
            if (progress > 0) {
                aoa.push([category.name, item.name, `${progress}%`]);
            }
        });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Unidade");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    triggerDownload(blob, `Relatorio_${unit.name.replace(/\s+/g, '_')}.xlsx`);
};

/**
 * Exporta os dados do relatório selecionado para um arquivo PDF.
 * @param {Project} project O objeto completo do projeto.
 * @param {ServiceCategory[]} plsData A estrutura de serviços calculada.
 * @param {Financials} financials Os dados financeiros calculados.
 * @param {ReportOptions} options As opções de relatório definidas pelo usuário.
 */
export const exportToPDF = async (project: Project, plsData: ServiceCategory[], financials: Financials, options: ReportOptions) => {
  const doc = new jsPDF({
    orientation: options.orientation === 'l' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithAutoTable;

  const primaryColor = options.layout?.primaryColor || '#005f9e'; // Default blue
  const textColor = '#333333';
  const logo = options.layout?.logoBase64;
  const headerLogo = options.layout?.headerLogoBase64;
  const headerText = options.layout?.headerText;
  const footerText = options.layout?.footerText;
  const fontFamily = options.layout?.fontFamily || 'helvetica';

  doc.setFont(fontFamily);

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  let cursorY = margin;

  // --- Helper Functions ---
  const addHeader = () => {
      if (headerLogo) {
          doc.addImage(headerLogo, 'PNG', margin, 5, 20, 10, undefined, 'FAST');
      }
      if (headerText) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(headerText, pageWidth - margin, 10, { align: 'right' });
      }
  }

  const addFooter = (pageNumber: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(100);
      let footerString = `Página ${pageNumber} de ${totalPages}`;
      if (footerText) {
          footerString = `${footerText} | ${footerString}`;
      }
      doc.text(footerString, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // --- Cover Page ---
  addHeader();
  cursorY += 40;

  if (logo) {
      const imgProps = doc.getImageProperties(logo);
      const imgWidth = 60;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      doc.addImage(logo, 'PNG', (pageWidth - imgWidth) / 2, cursorY, imgWidth, imgHeight, undefined, 'FAST');
      cursorY += imgHeight + 20;
  } else {
      // Placeholder if no logo
      cursorY += 40;
  }

  doc.setFontSize(24);
  doc.setTextColor(primaryColor);
  doc.text(options.title, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 15;

  doc.setFontSize(14);
  doc.setTextColor(textColor);
  doc.text(project.name, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 10;

  doc.setFontSize(12);
  doc.setTextColor(100);
  
  // Medição e Data em linhas separadas
  doc.text(`Medição: ${options.measurementNumber || 1}`, margin, cursorY);
  cursorY += 6;
  doc.text(`Data da medição: ${new Date().toLocaleDateString('pt-BR')}`, margin, cursorY);
  cursorY += 6;
  doc.text(`Empreendimento: ${project.name}`, margin, cursorY);
  
  cursorY += 15;

  // Project Details Table on Cover
  if (options.includeProjectDetails) {
      autoTable(doc, {
          startY: 100, // Adjusted startY to fit the new lines
          head: [['Detalhe', 'Informação']],
          body: [
              ['Proponente', `${project.developer.name}\nCNPJ: ${project.developer.cnpj}`],
              ['Construtora', `${project.construction_company.name}\nCNPJ: ${project.construction_company.cnpj}`],
              ['Responsável Técnico', `${project.responsible_engineer.name}\nCREA: ${project.responsible_engineer.crea}`],
              ['Endereço', `${project.address.street}, ${project.address.city} - ${project.address.state}`],
              ['Custo Total da Obra', formatCurrency(project.cost_of_works)],
          ],
          theme: 'striped' as const, // Explicitly cast to literal type
          headStyles: { fillColor: primaryColor },
          styles: { font: fontFamily },
          columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 50 },
          },
      });
  }
  
  // --- Key Metrics on Cover ---
  // Position metrics below the table
  const finalY = doc.lastAutoTable.finalY + 15;
  const metrics = [
      { label: 'Incidência Mensurada', value: `${financials.totalProgress.toFixed(2)}%` }, // Changed label
      { label: 'Valor Liberado', value: formatCurrency(financials.totalReleased) },
      { label: 'Saldo a Medir', value: formatCurrency(financials.balanceToMeasure) },
  ];

  const boxWidth = (pageWidth - (margin * 2) - 10) / 3;
  metrics.forEach((metric, index) => {
      const x = margin + (boxWidth + 5) * index;
      doc.setFillColor(245, 245, 245);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(x, finalY, boxWidth, 25, 3, 3, 'FD');
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(metric.label, x + boxWidth / 2, finalY + 8, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(primaryColor);
      doc.setFont(fontFamily, 'bold');
      doc.text(metric.value, x + boxWidth / 2, finalY + 18, { align: 'center' });
      doc.setFont(fontFamily, 'normal');
  });

  // --- Content Pages ---
  
  // AI Summary Section
  if (options.aiSummary) {
      doc.addPage();
      addHeader();
      cursorY = 30;
      doc.setFontSize(16);
      doc.setTextColor(primaryColor);
      doc.text("Resumo Executivo (IA)", margin, cursorY);
      cursorY += 10;
      
      doc.setFontSize(11);
      doc.setTextColor(textColor);
      const splitSummary = doc.splitTextToSize(options.aiSummary, pageWidth - (margin * 2));
      doc.text(splitSummary, margin, cursorY);
  }

  // Financial Summary Section
  if (options.includeFinancialSummary) {
      doc.addPage();
      addHeader();
      cursorY = 30;
      doc.setFontSize(16);
      doc.setTextColor(primaryColor);
      doc.text("Resumo Financeiro por Etapa", margin, cursorY);
      cursorY += 10;

      // Prepare data for the table
      const summaryBody = financials.categoryTotals.map(cat => [
          `${cat.id}. ${cat.name}`,
          `${cat.totalIncidence.toFixed(2)}%`,
          `${cat.measuredIncidence.toFixed(2)}%`, // New column data
          '', // Placeholder for Progress Bar
          formatCurrency(cat.released),
          formatCurrency(cat.totalCost)
      ]);

      // Calculate totals for footer
      const totalGlobalIncidence = financials.categoryTotals.reduce((sum, cat) => sum + cat.totalIncidence, 0);
      // Measured Incidence is summed directly from the categories' measured incidences
      const totalMeasuredIncidence = financials.categoryTotals.reduce((sum, cat) => sum + cat.measuredIncidence, 0);
      const totalReleased = financials.categoryTotals.reduce((sum, cat) => sum + cat.released, 0);
      const totalCost = financials.categoryTotals.reduce((sum, cat) => sum + cat.totalCost, 0);
      
      // Calculate total progress percentage based on financial values to match
      // Total Progress = (Total Released / Total Cost) * 100
      // This ensures 100% accurate correlation with the monetary values.
      // const totalProgressPercentage = totalCost > 0 ? (totalReleased / totalCost) * 100 : 0;

      autoTable(doc, {
          startY: cursorY,
          head: [['Etapa', 'Incidência Global', 'Incidência Mensurada', 'Progresso', 'Valor Liberado', 'Custo Total']], // Renamed header
          body: summaryBody,
          foot: [[
              'TOTAL', 
              `${totalGlobalIncidence.toFixed(2)}%`, 
              `${totalMeasuredIncidence.toFixed(2)}%`,
              '', // Progresso column is empty in footer
              formatCurrency(totalReleased), 
              formatCurrency(totalCost)
          ]],
          theme: 'striped' as const,
          headStyles: { fillColor: primaryColor },
          footStyles: { fillColor: primaryColor, fontStyle: 'bold' as const }, // Style the footer
          styles: { font: fontFamily, fontSize: 9, cellPadding: 3, valign: 'middle' },
          columnStyles: {
              0: { cellWidth: options.orientation === 'l' ? 80 : 60 },
              3: { cellWidth: 30 }
          },
          didDrawCell: (data) => {
              if (data.section === 'body' && data.column.index === 3) {
                  const rowIndex = data.row.index;
                  const cat = financials.categoryTotals[rowIndex];
                  if (cat) {
                      const progressBarWidth = data.cell.width - 6;
                      const progressBarHeight = 4;
                      const x = data.cell.x + 3;
                      const y = data.cell.y + (data.cell.height - progressBarHeight) / 2;
                      
                      // Background
                      doc.setFillColor(230, 230, 230);
                      doc.rect(x, y, progressBarWidth, progressBarHeight, 'F');
                      
                      // Progress
                      doc.setFillColor(251, 191, 36); // amber-400
                      const fillWidth = (progressBarWidth * cat.progress) / 100;
                      doc.rect(x, y, fillWidth, progressBarHeight, 'F');
                      
                      // Text
                      doc.setFontSize(7);
                      doc.setTextColor(100);
                      doc.text(`${cat.progress.toFixed(2)}%`, x + progressBarWidth + 2, y + 3, { align: 'left' }); // Move text to right if needed, or overlay
                  }
              }
          }
      });
  }

  // Detailed PLS Table
  if (options.includeProgressTable) {
      doc.addPage();
      addHeader();
      cursorY = 30;
      doc.setFontSize(16);
      doc.setTextColor(primaryColor);
      doc.text("Detalhamento de Progresso da PLS", margin, cursorY);
      cursorY += 10;

      const filteredPls = plsData.filter(cat => options.selectedCategoryIds.includes(cat.id));
      const tableBody: any[] = [];

      filteredPls.forEach(cat => {
          // Calculate the sum of measured incidence for the category sub-items
          // This must match the logic in ProjectContext (weighted sum of subitems)
          const categoryMeasuredIncidence = financials.categoryTotals.find(c => c.id === cat.id)?.measuredIncidence || 0;

          tableBody.push([
              { content: `${cat.id}. ${cat.name}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
              { content: `${cat.totalIncidence.toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
              { content: `${categoryMeasuredIncidence.toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, // Measured Incidence Sum
              { content: '', colSpan: 3, styles: { fillColor: [240, 240, 240] } } // Reduced colSpan from 4 to 3
          ]);

          cat.subItems.forEach(item => {
              const itemProgress = project.progress[item.id] || [];
              const avgProgress = getAverageProgress(itemProgress, project.housing_units.length);
              
              // Calculate Measured Incidence for the item
              // Formula: Item Incidence * (Average Progress / 100)
              const itemMeasuredIncidence = item.incidence * (avgProgress / 100);

              tableBody.push([
                  item.id,
                  item.name,
                  `${item.incidence.toFixed(2)}%`,
                  `${itemMeasuredIncidence.toFixed(2)}%`, // New Column Value
                  '', // Progress Bar
                  `${avgProgress.toFixed(2)}%`,
                  formatCurrency(item.cost)
              ]);
          });
      });

      autoTable(doc, {
          startY: cursorY,
          head: [['Item', 'Serviço', 'Incidência Global', 'Incidência Mensurada', 'Progresso Visual', '% Médio', 'Valor Total']], // Renamed header
          body: tableBody,
          theme: 'grid' as const,
          headStyles: { fillColor: primaryColor },
          styles: { font: fontFamily, fontSize: 8, cellPadding: 2 },
          columnStyles: {
              0: { cellWidth: 15 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 25, halign: 'right' as const },
              3: { cellWidth: 25, halign: 'right' as const }, // New column style
              4: { cellWidth: 30 },
              5: { cellWidth: 15, halign: 'right' as const },
              6: { cellWidth: 25, halign: 'right' as const },
          },
          didDrawCell: (data) => {
              if (data.section === 'body' && data.column.index === 4) {
                  const cellText = data.cell.raw;
                  // Only draw if it's NOT a category header (which has empty string here but we check type)
                  // Category rows have colSpan, so index 4 might not exist or be different.
                  // We check if the row has an ID in col 0 (sub-item)
                  const isSubItem = data.row.cells[0].raw.toString().includes('.');
                  
                  if (isSubItem && typeof cellText === 'string') {
                      const avgProgress = parseFloat(data.row.cells[5].raw.toString().replace('%', ''));
                      
                      if (!isNaN(avgProgress)) {
                          const progressBarWidth = data.cell.width - 4;
                          const progressBarHeight = 3;
                          const x = data.cell.x + 2;
                          const y = data.cell.y + (data.cell.height - progressBarHeight) / 2;
                          
                          doc.setFillColor(230, 230, 230);
                          doc.rect(x, y, progressBarWidth, progressBarHeight, 'F');
                          
                          doc.setFillColor(primaryColor);
                          const fillWidth = (progressBarWidth * avgProgress) / 100;
                          doc.rect(x, y, fillWidth, progressBarHeight, 'F');
                      }
                  }
              }
          }
      });
  }

  // Page Numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      if (i > 1) { // Skip footer on cover page if desired, or keep it. Let's keep it for consistency but maybe skip cover?
         // Actually, typically cover doesn't have page number.
         addFooter(i, pageCount);
      }
  }

  doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
};
