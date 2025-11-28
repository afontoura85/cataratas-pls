
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

  const primaryColor = options.layout?.primaryColor || '#005f9e'; 
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
      const currentWidth = doc.internal.pageSize.width;
      if (headerLogo) {
          const imgProps = doc.getImageProperties(headerLogo);
          // Define a fixed height for the header logo
          const pdfHeight = 6; // Reduced to half size (was 12)
          // Calculate the width based on the aspect ratio to prevent distortion
          const pdfWidth = (imgProps.width * pdfHeight) / imgProps.height;
          
          doc.addImage(headerLogo, 'PNG', margin, 5, pdfWidth, pdfHeight, undefined, 'FAST');
      }
      if (headerText) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(headerText, currentWidth - margin, 10, { align: 'right' });
      }
  }

  const addFooter = (pageNumber: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(100);
      
      const currentWidth = doc.internal.pageSize.width;
      const currentHeight = doc.internal.pageSize.height;

      const leftText = footerText || `${project.name} - ${project.address.city || ''}, ${project.address.state || ''}`;
      const rightText = `Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} | Página ${pageNumber} de ${totalPages}`;
      
      // Footer aligned Left and Right as per reference
      doc.text(leftText, margin, currentHeight - 10, { align: 'left' });
      doc.text(rightText, currentWidth - margin, currentHeight - 10, { align: 'right' });
  }

  // --- Cover Page (Layout Restored to Match Reference) ---
  // Note: We DO NOT call addHeader() here as requested. Page 1 has no top-left logo.
  
  // 1. Logo (Centered)
  if (logo) {
      const imgProps = doc.getImageProperties(logo);
      const imgWidth = 50; // Smaller size for cover logo as per ref
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      doc.addImage(logo, 'PNG', (pageWidth - imgWidth) / 2, cursorY, imgWidth, imgHeight, undefined, 'FAST');
      cursorY += imgHeight + 15;
  } else {
      cursorY += 25;
  }

  // 2. Title (Centered)
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.setFont(fontFamily, 'bold');
  doc.text("Planilha de Levantamento de Serviços - PLS", pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 20;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // 3. Metadata Block (Measurement, Date, Project) - Vertical List
  const metadataX = margin;
  const lineHeight = 7;
  
  doc.setFont(fontFamily, 'bold');
  doc.text(`Medição: ${options.measurementNumber || 1}`, metadataX, cursorY);
  cursorY += lineHeight;
  
  doc.text(`Data da medição: ${new Date().toLocaleDateString('pt-BR')}`, metadataX, cursorY);
  cursorY += lineHeight;
  
  doc.text(`Empreendimento: ${project.name}`, metadataX, cursorY);
  cursorY += 15; // Gap before stakeholders

  // 4. Stakeholders Block (Vertical List)
  // Format: "Label: Value"
  const drawDetailRow = (label: string, value: string) => {
      doc.setFont(fontFamily, 'bold');
      doc.text(label, metadataX, cursorY);
      
      const labelWidth = doc.getTextWidth(label);
      doc.setFont(fontFamily, 'normal');
      
      // Calculate remaining width for value to avoid overflow
      const valueX = metadataX + 45; // Fixed alignment for values
      const splitValue = doc.splitTextToSize(value || 'N/A', pageWidth - margin - valueX);
      doc.text(splitValue, valueX, cursorY);
      
      cursorY += (splitValue.length * lineHeight); 
  };

  drawDetailRow("Proponente:", `${project.developer.name} - CNPJ: ${project.developer.cnpj}`);
  drawDetailRow("Construtora:", `${project.construction_company.name} - CNPJ: ${project.construction_company.cnpj}`);
  drawDetailRow("Responsável Técnico:", `${project.responsible_engineer.name} - CREA: ${project.responsible_engineer.crea}`);
  drawDetailRow("Endereço da Obra:", `${project.address.street}, ${project.address.city} - ${project.address.state}`);

  // 5. Key Metrics (3 Blue Boxes at Bottom) - Ref: Page 1 bottom
  // Position them near the bottom of the page
  const boxesY = pageHeight - 50; 
  const boxHeight = 25;
  const boxWidth = (pageWidth - (margin * 2) - 10) / 3;

  const metrics = [
      { label: 'Incidência Mensurada', value: `${financials.totalProgress.toFixed(2)}%` },
      { label: 'Executado', value: formatCurrency(financials.totalReleased) },
      { label: 'Custo da Obra', value: formatCurrency(project.cost_of_works) },
  ];

  metrics.forEach((metric, index) => {
      const x = margin + (boxWidth + 5) * index;
      
      // Box Background (Light Blue: #eff6ff / 239, 246, 255)
      doc.setFillColor(239, 246, 255); 
      doc.setDrawColor(219, 234, 254); // Border
      doc.roundedRect(x, boxesY, boxWidth, boxHeight, 2, 2, 'FD');
      
      // Label (Small, Gray)
      doc.setFontSize(8);
      doc.setTextColor(100); // Gray
      doc.setFont(fontFamily, 'normal');
      doc.text(metric.label, x + 4, boxesY + 8);
      
      // Value (Large, Blue/Black)
      doc.setFontSize(12);
      if (index === 0) doc.setTextColor(245, 158, 11); // Orange for Incidence
      else if (index === 1) doc.setTextColor(22, 163, 74); // Green for Executed
      else doc.setTextColor(0); // Black for Cost
      
      doc.setFont(fontFamily, 'bold');
      doc.text(metric.value, x + 4, boxesY + 18);
  });

  // --- Content Pages ---
  
  // AI Summary Section (Optional)
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

  // Financial Summary Section (Page 2 Reference)
  if (options.includeFinancialSummary) {
      doc.addPage();
      addHeader();
      cursorY = 25; // Adjusted start Y
      
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont(fontFamily, 'bold');
      doc.text("Resumo Financeiro por Etapa", margin, cursorY);
      cursorY += 5;

      const summaryBody = financials.categoryTotals.map(cat => [
          `${cat.id}. ${cat.name}`,
          `${cat.totalIncidence.toFixed(2)}%`,
          `${cat.measuredIncidence.toFixed(2)}%`,
          '', // Progress Bar column
          formatCurrency(cat.released),
          formatCurrency(cat.totalCost)
      ]);

      const totalGlobalIncidence = financials.categoryTotals.reduce((sum, cat) => sum + cat.totalIncidence, 0);
      const totalMeasuredIncidence = financials.categoryTotals.reduce((sum, cat) => sum + cat.measuredIncidence, 0);
      const totalReleased = financials.categoryTotals.reduce((sum, cat) => sum + cat.released, 0);
      const totalCost = financials.categoryTotals.reduce((sum, cat) => sum + cat.totalCost, 0);
      
      autoTable(doc, {
          startY: cursorY,
          head: [['Etapa', 'Incidência Global', 'Incidência Mensurada', 'Progresso', 'Valor Liberado', 'Custo Total']],
          body: summaryBody,
          foot: [[
              'TOTAL', 
              `${totalGlobalIncidence.toFixed(2)}%`, 
              `${totalMeasuredIncidence.toFixed(2)}%`,
              '',
              formatCurrency(totalReleased), 
              formatCurrency(totalCost)
          ]],
          theme: 'plain', // Cleaner look like reference
          headStyles: { 
              fillColor: [44, 62, 80], 
              textColor: 255,
              fontSize: 8,
              halign: 'left'
          },
          footStyles: { 
              fillColor: [44, 62, 80], 
              textColor: 255, 
              fontStyle: 'bold',
              fontSize: 8
          },
          bodyStyles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
              0: { cellWidth: 'auto' }, // Etapa
              1: { halign: 'center' },
              2: { halign: 'center' },
              3: { cellWidth: 25 },
              4: { halign: 'right' },
              5: { halign: 'right' }
          },
          didDrawCell: (data) => {
              if (data.section === 'body' && data.column.index === 3) {
                  const rowIndex = data.row.index;
                  const cat = financials.categoryTotals[rowIndex];
                  if (cat) {
                      const progressBarWidth = data.cell.width - 6;
                      const progressBarHeight = 3;
                      const x = data.cell.x + 3;
                      const y = data.cell.y + (data.cell.height - progressBarHeight) / 2;
                      
                      doc.setFillColor(230, 230, 230);
                      doc.rect(x, y, progressBarWidth, progressBarHeight, 'F');
                      
                      doc.setFillColor(251, 191, 36); // amber-400
                      const fillWidth = (progressBarWidth * cat.progress) / 100;
                      doc.rect(x, y, fillWidth, progressBarHeight, 'F');
                  }
              }
          }
      });
  }

  // Detailed PLS Table (Page 2-3 Reference)
  if (options.includeProgressTable) {
      // Calculate where summary ended or use a fresh page if needed
      let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : 25;
      
      // Add logic to start new page if space is low
      if (startY > pageHeight - 40) {
          doc.addPage();
          addHeader();
          startY = 25;
      }

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont(fontFamily, 'bold');
      doc.text("Detalhamento de Progresso da PLS", margin, startY);
      startY += 5;

      const filteredPls = plsData.filter(cat => options.selectedCategoryIds.includes(cat.id));
      const tableBody: any[] = [];

      filteredPls.forEach(cat => {
          const categoryMeasuredIncidence = financials.categoryTotals.find(c => c.id === cat.id)?.measuredIncidence || 0;
          const categoryReleased = financials.categoryTotals.find(c => c.id === cat.id)?.released || 0;

          // Category Header Row - Gray Background
          tableBody.push([
              { content: `${cat.id}. ${cat.name}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0 } },
              { content: `${cat.totalIncidence.toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0, halign: 'center' } },
              { content: `${categoryMeasuredIncidence.toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0, halign: 'center' } },
              { content: '', styles: { fillColor: [240, 240, 240] } }, 
              { content: formatCurrency(categoryReleased), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0, halign: 'right' } },
              { content: formatCurrency(cat.totalCost), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0, halign: 'right' } }
          ]);

          cat.subItems.forEach(item => {
              const itemProgress = project.progress[item.id] || [];
              const avgProgress = getAverageProgress(itemProgress, project.housing_units.length);
              const itemMeasuredIncidence = item.incidence * (avgProgress / 100);
              const itemReleasedValue = item.cost * (avgProgress / 100);

              tableBody.push([
                  item.id,
                  item.name,
                  `${item.incidence.toFixed(2)}%`,
                  `${itemMeasuredIncidence.toFixed(2)}%`,
                  `${avgProgress.toFixed(2)}%`, // Hidden by hook
                  formatCurrency(itemReleasedValue),
                  formatCurrency(item.cost)
              ]);
          });
      });

      autoTable(doc, {
          startY: startY,
          head: [['ID', 'Serviço', 'Incidência Global', 'Incidência Mensurada', 'Prog. Médio', 'Valor Liberado', 'Custo Total']],
          body: tableBody,
          theme: 'plain',
          headStyles: { 
              fillColor: [44, 62, 80], 
              textColor: 255,
              fontSize: 7,
              halign: 'center'
          },
          styles: { font: fontFamily, fontSize: 7, cellPadding: 1.5, valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
          columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 18, halign: 'center' },
              3: { cellWidth: 18, halign: 'center' },
              4: { cellWidth: 25, halign: 'center' },
              5: { cellWidth: 22, halign: 'right' },
              6: { cellWidth: 22, halign: 'right' },
          },
          didDrawCell: (data) => {
              // Draw Progress Bar in column 4 (index 4)
              // Logic removed as per request to keep it cleaner
          }
      });
  }

  // --- Matrix of Progress (Page 4-5 Reference) ---
  if (options.includeUnitDetails) {
      doc.addPage('a4', 'landscape'); // Force landscape for Matrix
      addHeader();
      let startY = 25;
      
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont(fontFamily, 'bold');
      doc.text("Matriz de Progresso por Unidade", margin, startY);
      startY += 5;
      
      // Legend
      doc.setFontSize(10);
      doc.setFont(fontFamily, 'normal');
      doc.text("X = 100%", margin, startY);
      startY += 5;

      const filteredPls = plsData.filter(cat => options.selectedCategoryIds.includes(cat.id));
      
      // We will create a dense matrix table
      // Columns: Service Name | Unit 1 | Unit 2 | ...
      // If there are too many units (e.g., > 30), we might need to split tables, but for now we try to fit.
      
      // Limit units displayed if too many to avoid crash, or split tables (advanced). 
      // For this implementation, we will list all units but use very small font.
      const units = project.housing_units;
      
      const head = [['Serviço', ...units.map((u, i) => `${i+1}`)]];
      const body: any[] = [];

      filteredPls.forEach(cat => {
          cat.subItems.forEach(item => {
              const progressRow = project.progress[item.id] || [];
              const rowData = [
                  item.name,
                  ...units.map((_, i) => {
                      const val = progressRow[i] || 0;
                      return val === 100 ? 'X' : val === 0 ? '' : `${val}`;
                  })
              ];
              body.push(rowData);
          });
      });

      autoTable(doc, {
          startY: startY,
          head: head,
          body: body,
          theme: 'grid',
          styles: { 
              fontSize: 5, // Tiny font for matrix
              cellPadding: 1, 
              halign: 'center',
              valign: 'middle'
          },
          headStyles: {
              fillColor: [44, 62, 80],
              fontSize: 5,
              textColor: 255
          },
          columnStyles: {
              0: { halign: 'left', cellWidth: 40 } // Service Name column
          },
          didParseCell: (data) => {
              // Highlight completed cells
              if (data.section === 'body' && data.column.index > 0) {
                  if (data.cell.raw === 'X') {
                      data.cell.styles.fillColor = [220, 252, 231]; // Light green
                      data.cell.styles.fontStyle = 'bold';
                  }
              }
          }
      });
  }

  // --- Signature Page (Page 6 Reference) ---
  doc.addPage('a4', 'landscape'); // Changed to landscape for signatures
  addHeader();
  
  const currentPageWidth = doc.internal.pageSize.width;
  const currentPageHeight = doc.internal.pageSize.height;

  const signatureY = currentPageHeight - 60;
  const signatureLineLength = 80;
  
  const leftX = (currentPageWidth / 2) - (signatureLineLength / 2);
  let currentSigY = signatureY - 40;

  // Proponente Block
  doc.setDrawColor(0);
  doc.line(leftX, currentSigY, leftX + signatureLineLength, currentSigY);
  
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont(fontFamily, 'bold');
  const propName = doc.splitTextToSize(project.developer.name, signatureLineLength + 10);
  doc.text(propName, currentPageWidth / 2, currentSigY + 5, { align: 'center' });
  
  doc.setFont(fontFamily, 'normal');
  doc.text("Proponente", currentPageWidth / 2, currentSigY + 5 + (propName.length * 5), { align: 'center' });

  // Resp Técnico Block
  currentSigY = signatureY + 20;
  doc.line(leftX, currentSigY, leftX + signatureLineLength, currentSigY);
  
  doc.setFont(fontFamily, 'bold');
  const engName = doc.splitTextToSize(project.responsible_engineer.name, signatureLineLength + 10);
  doc.text(engName, currentPageWidth / 2, currentSigY + 5, { align: 'center' });
  
  doc.setFont(fontFamily, 'normal');
  doc.text("Responsável Técnico", currentPageWidth / 2, currentSigY + 5 + (engName.length * 5), { align: 'center' });


  // Page Numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      if (i > 1) { 
         addFooter(i, pageCount);
      }
  }

  doc.save(`Relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
};
