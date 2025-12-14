/**
 * @file Este serviço atua como um cliente centralizado para todas as interações com a API Google Gemini.
 * Ele fornece funções para várias tarefas baseadas em IA, como análise de imagens, extração de dados de documentos,
 * raciocínio avançado e pesquisa com base na web. Também lida com a lógica comum para processamento de arquivos e tratamento de erros.
 */
import { GoogleGenAI, GroundingChunk, GenerateContentResponse } from "@google/genai";
import { Project, Financials, ServiceCategory, PlsCategoryTemplate, ScheduleStage, ReportOptions } from "../types";
import * as XLSX from 'xlsx';

const API_KEY = import.meta.env.VITE_API_KEY;
if (!API_KEY) {
    // Em um aplicativo real, você lidaria com isso de forma mais elegante.
    // Para este ambiente, assumimos que a API_KEY está definida.
    console.warn("API_KEY is not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

/**
 * Lida com erros da API Gemini e retorna uma mensagem amigável para o usuário.
 * @param {unknown} error O erro capturado do bloco try-catch.
 * @returns {string} Uma string com a mensagem de erro formatada e pronta para exibição.
 */
const handleGeminiError = (error: unknown): string => {
    console.error("Gemini API Error:", error);
    if (error instanceof Error) {
        if (error.message.includes("Model isn't available right now")) {
            return "O modelo de IA está temporariamente indisponível. Por favor, aguarde um minuto e tente novamente.";
        }
        if (error.message.includes("API key not valid")) {
            return "Chave de API inválida. Verifique suas configurações no arquivo config.ts.";
        }
        return error.message;
    }
    return "Ocorreu um erro desconhecido ao comunicar com a IA.";
};

/**
 * Converte um objeto File em um formato de parte generativa para a API Gemini (dados em base64).
 * @param {File} file O arquivo a ser convertido.
 * @returns {Promise<{ inlineData: { data: string; mimeType: string } }>} Uma promessa que resolve com o objeto de dados em linha.
 */
const fileToGenerativePart = (file: File) => {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                return reject(new Error("Failed to read file as data URL."));
            }
            // O resultado inclui o prefixo do URL de dados (ex: "data:image/jpeg;base64,"),
            // que precisamos remover para obter apenas a string base64.
            const base64Data = reader.result.split(',')[1];
            if (!base64Data) {
                return reject(new Error("Could not extract base64 data from file."));
            }
            resolve({
                inlineData: { data: base64Data, mimeType: file.type },
            });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

/**
 * Extrai o conteúdo de texto de um arquivo Excel (.xls, .xlsx) como uma string CSV.
 * @param {File} file O arquivo Excel a ser processado.
 * @returns {Promise<string>} Uma promessa que resolve com o conteúdo do arquivo como texto CSV.
 */
const excelFileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    return reject(new Error("Não foi possível ler o arquivo."));
                }
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                resolve(csv);
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                reject(new Error("Falha ao analisar o arquivo Excel."));
            }
        };

        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject(new Error("Ocorreu um erro ao ler o arquivo."));
        };
    });
};

/**
 * Prepara o conteúdo de um arquivo para ser enviado à API Gemini, seja como texto (de Excel) ou como dados binários (imagem/PDF).
 * @param {File} file O arquivo a ser preparado.
 * @returns {Promise<{ isText: true, content: string } | { isText: false, content: { parts: any[] } }>} Um objeto discriminado que indica se o conteúdo é texto ou binário.
 * @throws {Error} Lança um erro se o tipo de arquivo não for suportado.
 */
async function getFileContentForGemini(file: File): Promise<{ isText: true, content: string } | { isText: false, content: { parts: any[] } }> {
    if (file.type.includes('spreadsheetml') || file.type.includes('ms-excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        const textData = await excelFileToText(file);
        return { isText: true, content: textData };
    }
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const filePart = await fileToGenerativePart(file);
        return { isText: false, content: { parts: [filePart, { text: '' }] } };
    }
    throw new Error(`Tipo de arquivo não suportado: ${file.type || 'desconhecido'}. Por favor, envie uma imagem, PDF ou arquivo Excel.`);
}

/**
 * Analisa uma imagem de um canteiro de obras para sugerir o progresso dos serviços.
 * @param {File} image O arquivo de imagem do canteiro de obras.
 * @param {{ id: string; name: string }[]} items Uma lista de itens de serviço a serem procurados na imagem para dar contexto à IA.
 * @returns {Promise<string>} Uma promessa que resolve com o texto de análise da IA ou uma mensagem de erro.
 */
export const analyzeImage = async (image: File, items: { id: string; name: string }[]): Promise<string> => {
    try {
        const imagePart = await fileToGenerativePart(image);
        const itemList = items.map(item => `- ${item.name} (id: ${item.id})`).join('\n');
        const prompt = `Analyze this construction site photo. Based on the visible elements, which of the following construction stages appear to be complete or in progress? Please list the completed stages and provide a brief justification for each. Be concise. \n\nConstruction Stages:\n${itemList}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
        });

        return response.text;
    } catch (error) {
        return handleGeminiError(error);
    }
};

/**
 * Fornece consultoria especializada sobre o projeto com base nos dados de progresso e em uma pergunta do usuário.
 * Utiliza um modelo mais avançado (gemini-2.5-pro) com `thinkingBudget` para raciocínio complexo.
 * @param {any} plsData Os dados da estrutura da PLS.
 * @param {any} progress A matriz de progresso atual.
 * @param {string} query A pergunta complexa do usuário.
 * @returns {Promise<string>} Uma promessa que resolve com o conselho detalhado da IA ou uma mensagem de erro.
 */
export const getComplexAdvice = async (plsData: any, progress: any, query: string): Promise<string> => {
    try {
        const context = `
            You are an expert construction project manager and financial advisor for projects financed by CAIXA in Brazil.
            Analyze the following project progress data and answer the user's complex question.
            Provide detailed, actionable advice.

            Project Data (Budget Items and Incidence): 
            ${JSON.stringify(plsData, null, 2)}

            Current Progress Matrix (% complete per unit):
            ${JSON.stringify(progress, null, 2)}

            User Question: "${query}"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: context,
            config: {
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });

        return response.text;
    } catch (error) {
        return handleGeminiError(error);
    }
};

/**
 * Realiza uma pesquisa na web usando o Google Search para responder a uma pergunta com informações atualizadas.
 * @param {string} query A pergunta a ser pesquisada.
 * @returns {Promise<{text: string; sources: GroundingChunk[]}>} Uma promessa que resolve com o texto da resposta e as fontes da web.
 */
export const getGroundedResearch = async (query: string): Promise<{ text: string; sources: GroundingChunk[] }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        return { text: response.text, sources };

    } catch (error) {
        return { text: handleGeminiError(error), sources: [] };
    }
};

/**
 * Extrai texto de uma imagem (OCR) com base em um prompt opcional do usuário.
 * @param {File} image O arquivo de imagem a ser processado.
 * @param {string} userPrompt Instruções específicas do usuário para a extração (ex: formato de saída).
 * @returns {Promise<string>} Uma promessa que resolve com o texto extraído ou uma mensagem de erro.
 */
export const extractTextFromImage = async (image: File, userPrompt: string): Promise<string> => {
    try {
        const imagePart = await fileToGenerativePart(image);

        let prompt = "You are an expert OCR tool. Your task is to extract text from the provided image accurately.";
        if (userPrompt) {
            prompt += `\n\nThe user has provided specific instructions: "${userPrompt}". Follow these instructions to extract and format the required information. If the user asks for a specific format like JSON, provide the output in that format.`
        } else {
            prompt += "\n\nTranscribe all the text you can see in the image."
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
        });

        return response.text;

    } catch (error) {
        return handleGeminiError(error);
    }
};

/**
 * Limpa e analisa uma string JSON potencialmente mal formatada da resposta da API.
 * Remove os marcadores de bloco de código markdown (```json ... ```).
 * @param {string} text A string de texto a ser analisada.
 * @returns {any} O objeto JSON analisado ou nulo em caso de falha.
 */
const cleanAndParseJson = (text: string): any => {
    const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
        console.error("Raw response text:", text);
        return null;
    }
}

/**
 * Tipos de dados que se espera extrair de um documento FRE.
 */
export type ExtractedFreData = {
    projectName: string;
    costOfWorks: number;
    totalEnterpriseCost: number;
    vgv: number;
    developerName: string;
    developerCnpj: string;
    constructionCompanyName: string;
    constructionCompanyCnpj: string;
    addressStreet: string;
    addressCity: string;
    addressState: string;
    addressZip: string;
    engineerName: string;
    engineerCrea: string;
    engineerEmail: string;
    units: number;
};

/**
 * Tipos de dados que se espera extrair de um arquivo de cronograma.
 */
export type ExtractedScheduleData = {
    projectDetails: ExtractedFreData;
    scheduleDetails: {
        duration_months: number;
        schedule: ScheduleStage[];
    };
};

/**
 * Extrai dados estruturados de um documento FRE (Ficha Resumo do Empreendimento).
 * @param {File} file O arquivo do documento (imagem, PDF ou Excel).
 * @returns {Promise<ExtractedFreData | null>} Uma promessa que resolve com os dados extraídos em formato JSON, ou nulo em caso de falha na análise.
 * @throws {Error} Lança um erro se a chamada da API ou o processamento do arquivo falhar.
 */
export const extractDataFromFRE = async (file: File): Promise<ExtractedFreData | null> => {
    try {
        const promptData = await getFileContentForGemini(file);

        const prompt = `
        You are an expert data extractor specializing in Brazilian civil engineering documents.
        Analyze the provided document, which is a FRE (Ficha Resumo do Empreendimento) from CAIXA.
        Your task is to meticulously extract the following information and return it ONLY as a single, clean JSON object. Do not include any explanatory text, markdown formatting, or anything else outside the JSON structure.

        When parsing numbers (costs, VGV):
        1. Remove currency symbols (e.g., "R$").
        2. Remove thousands separators (e.g., ".").
        3. Use a period "." as the decimal separator. For example, "R$ 12.177.921,44" becomes 12177921.44.

        Fields to extract:
        - projectName: Find the value for "Nome do Empreendimento".
        - costOfWorks: Find the numerical value for "Custo total das obras".
        - totalEnterpriseCost: Find the numerical value for "Custo total de empreendimento".
        - vgv: Find the numerical value for "VGV - Valor global de vendas".
        - developerName: Find the name of the "Incorporador".
        - developerCnpj: Find the "CPF/CNPJ" of the "Incorporador".
        - constructionCompanyName: Find the name of the "Construtora".
        - constructionCompanyCnpj: Find the "CPF/CNPJ" of the "Construtora". This might also be labeled as "Proponente".
        - addressStreet: Combine the values from "Endereço do Empreendimento (conforme Matrícula)" and "Complemento".
        - addressCity: Find the value for "Município".
        - addressState: Find the value for "UF".
        - addressZip: Find the value for "CEP".
        - engineerName: Find the full name of the "Responsável técnico".
        - engineerCrea: Find the "CAU/CREA" of the "Responsável técnico". Do not include the label "CREA".
        - engineerEmail: Find the "E-mail" of the "Responsável técnico".
        - units: Find the total number of residential units (e.g., "Casas" or "Apartamentos").

        Example JSON output for the "Condomínio Recanto do Iguaçu" document:
        {
          "projectName": "Condomínio Recanto do Iguaçu",
          "costOfWorks": 12177921.44,
          "totalEnterpriseCost": 15279188.69,
          "vgv": 17280000.00,
          "developerName": "Cataratas Construtora e Incorporadora de Imoveis SPE Ltda",
          "developerCnpj": "54.791.422/0001-51",
          "constructionCompanyName": "Incorporadora Vivaz Ltda",
          "constructionCompanyCnpj": "38.475.667/0001-13",
          "addressStreet": "Rua Carnaúba, s/n, Lote 0856 Quadra 11",
          "addressCity": "Foz do Iguaçu",
          "addressState": "PR",
          "addressZip": "85854-726",
          "engineerName": "Yana Langner Fontoura",
          "engineerCrea": "SP 5070239233/D",
          "engineerEmail": "engcivil.yana@gmail.com",
          "units": 64
        }
        `;

        let response: GenerateContentResponse;

        // FIX: Replaced check on `isText` with a `typeof` check on the `content` property
        // to ensure correct type narrowing by TypeScript, which was failing with the previous check.
        if (typeof promptData.content !== 'string') {
            const filePart = promptData.content.parts[0];
            const textPart = { text: prompt };
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [filePart, textPart] },
            });
        } else {
            const fullPrompt = `Data from Excel/CSV:\n\n${promptData.content}\n\n---\n\n${prompt}`;
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
            });
        }

        return cleanAndParseJson(response.text);

    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};

/**
 * Extrai dados estruturados de um documento de Cronograma Físico-Financeiro.
 * @param {File} file O arquivo do documento (imagem, PDF ou Excel).
 * @returns {Promise<ExtractedScheduleData | null>} Uma promessa que resolve com os dados do projeto e do cronograma em formato JSON, ou nulo.
 * @throws {Error} Lança um erro se a chamada da API ou o processamento do arquivo falhar.
 */
export const extractDataFromScheduleFile = async (file: File): Promise<ExtractedScheduleData | null> => {
    try {
        const promptData = await getFileContentForGemini(file);

        const prompt = `
            You are an expert data extractor specializing in Brazilian civil engineering documents.
            Analyze the provided document, which is a "Cronograma Físico-Financeiro Global" from CAIXA.
            Your task is to meticulously extract both project details and the stage-by-stage schedule.
            Return the data ONLY as a single, clean JSON object with two main keys: "projectDetails" and "scheduleDetails".
            Do not include any explanatory text, markdown, or anything else outside the JSON structure.

            When parsing numbers (costs, percentages):
            1. Remove currency symbols ("R$") and percentage signs ("%").
            2. Remove thousands separators (".").
            3. Use a period "." as the decimal separator.

            **1. Project Details to extract into the "projectDetails" object:**
            - For any field NOT explicitly present in this document, return null. Do not infer it.
            - projectName: Find "Nome do Empreendimento".
            - costOfWorks: Find the total value for "Edificações". This is a critical value from this document.
            - totalEnterpriseCost: Find "Custo total de empreendimento".
            - vgv: Find "VGV".
            - developerName: Find the name of the "Incorporador".
            - developerCnpj: Find the "CPF/CNPJ" of the "Incorporador".
            - constructionCompanyName: Find the name of the "Construtora".
            - constructionCompanyCnpj: Find the "CPF/CNPJ" of the "Construtora".
            - addressStreet: Combine "Endereço do Empreendimento" and "Complemento".
            - addressCity: Find "Município".
            - addressState: Find "UF".
            - addressZip: Find "CEP".
            - engineerName: Find the name of the "Responsável técnico".
            - engineerCrea: Find the "CREA/CAU" of the "Responsável técnico".
            - engineerEmail: Find the "E-mail" of the "Responsável técnico".
            - units: Find the total number of "Unidades".

            **2. Schedule Details to extract into the "scheduleDetails" object:**
            - duration_months: Determine the total number of stages ("Etapa").
            - schedule: An array of objects for each stage.
              - stage: The stage number ("Etapa").
              - physical_progress_stage: "% da etapa" under "Evolução física da obra".
              - physical_progress_accumulated: "% acumulado" under "Evolução física da obra".
              - financial_release_stage: "% da etapa" under "% de liberação financeira".
              - financial_release_accumulated: "% acumulado" under "% de liberação financeira".

            Example JSON output:
            {
              "projectDetails": {
                "projectName": "Condomínio Recanto do Iguaçu",
                "costOfWorks": 12177921.44,
                "totalEnterpriseCost": null,
                "vgv": null,
                "developerName": null,
                "developerCnpj": null,
                "constructionCompanyName": null,
                "constructionCompanyCnpj": "38.475.667/0001-13",
                "addressStreet": "Rua Carnaúba, s/n, Lote 0856 Quadra 11",
                "addressCity": "Foz do Iguaçu",
                "addressState": "PR",
                "addressZip": "85854-726",
                "engineerName": "Yana Langner Fontoura",
                "engineerCrea": "SP 5070239233/D",
                "engineerEmail": null,
                "units": null
              },
              "scheduleDetails": {
                "duration_months": 18,
                "schedule": [
                  { "stage": 1, "physical_progress_stage": 6.00, "physical_progress_accumulated": 6.00, "financial_release_stage": 6.00, "financial_release_accumulated": 6.00 }
                ]
              }
            }
        `;

        let response: GenerateContentResponse;

        // FIX: Replaced check on `isText` with a `typeof` check on the `content` property
        // to ensure correct type narrowing by TypeScript, which was failing with the previous check.
        if (typeof promptData.content !== 'string') {
            const filePart = promptData.content.parts[0];
            const textPart = { text: prompt };
            response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [filePart, textPart] },
            });
        } else {
            const fullPrompt = `Analyze the following CSV data:\n\n${promptData.content}\n\nAnd follow these instructions:\n${prompt}`;
            response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: fullPrompt,
            });
        }

        return cleanAndParseJson(response.text);

    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};

/**
 * Extrai a estrutura da PLS (categorias, sub-itens, incidências) de um documento de orçamento.
 * Primeiro, realiza OCR se necessário, e depois analisa o texto para construir a estrutura JSON.
 * @param {File} file O arquivo do documento de orçamento (imagem, PDF ou Excel).
 * @returns {Promise<PlsCategoryTemplate[] | null>} Uma promessa que resolve com a estrutura da PLS em formato JSON, ou nulo.
 * @throws {Error} Lança um erro se a chamada da API ou o processamento do arquivo falhar.
 */
export const extractPlsFromBudgetFile = async (file: File): Promise<PlsCategoryTemplate[] | null> => {
    try {
        const promptData = await getFileContentForGemini(file);
        let textContent: string;

        // FIX: Replaced check on `isText` with a `typeof` check on the `content` property
        // to ensure correct type narrowing by TypeScript, which was failing with the previous check.
        if (typeof promptData.content !== 'string') {
            const imagePart = promptData.content.parts[0];
            const textPart = { text: "Extract all text from this document." };
            const ocrResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
            });
            textContent = ocrResponse.text;
        } else {
            textContent = promptData.content;
        }

        if (!textContent.trim()) {
            throw new Error("No text could be extracted from the file.");
        }

        const prompt = `
            You are an expert in Brazilian civil construction budgeting.
            Analyze the provided text from a construction budget document, likely an "Orçamento Sintético - Habitação".
            Your task is to extract the main service categories and their direct sub-items.

            The document contains a table with columns like "Item", "Serviço", and "Incidência". The "Incidência" is a pre-calculated percentage. You **must** use this value directly. **Do not perform any calculations.**

            Structure the output ONLY as a clean JSON array of categories, adhering strictly to the PlsCategoryTemplate interface.

            - Each main category (e.g., item '1', '2', '3') becomes a root object in the array.
            - **Rule for Sub-Items**: If a main category (e.g., '1 SERVIÇOS PRELIMINARES GERAIS') has numbered sub-items (e.g., '1.1', '1.2'), then ONLY include those sub-items in the \`subItems\` array. **However**, if a main category (e.g., '3 SUPRAESTRUTURA') has an 'Incidência' but NO numbered sub-items beneath it, you **must create a single sub-item for it**. Use the main category's name for this new sub-item (e.g., name: 'Supraestrutura') and assign it an ID of 'X.1' where X is the main category number (e.g., '3.1').

            For each object, extract the following:
            - Category object:
              - 'id': The main item number (e.g., "1").
              - 'name': The full service name (e.g., "SERVIÇOS PRELIMINARES GERAIS").
              - 'subItems': An array of its sub-item objects.
            - Sub-item object:
              - 'id': The sub-item number (e.g., "1.1").
              - 'name': The full service name for the sub-item.
              - 'incidence': The numerical value from the "Incidência" column, parsed as a number. For example, "6,46%" becomes 6.46.
              - 'unit': A default unit value. Use 'vb' for services that are a collection of items, 'un' for single units, 'mes' for monthly services, and 'etapa' for entire stages. If unsure, use 'vb'.

            **Crucial Instructions:**
            - The final output must be **only** a valid JSON array. Do not include any explanatory text or markdown formatting.
            - Ensure all numbers are parsed correctly (use '.' as a decimal separator, treat ',' as decimal in source text).
            - **Do not include items with 0.00% incidence.**

            Example JSON format based on an "Orçamento Sintético":
            [
              {
                "id": "1",
                "name": "SERVIÇOS PRELIMINARES GERAIS",
                "subItems": [
                  { "id": "1.1", "name": "serviços técnicos (projetos, orçamentos, levant. topog., sondagem, licenças e PCMAT)", "incidence": 0.57, "unit": "vb" },
                  { "id": "1.2", "name": "instalações e canteiros (barracão, cercamento e placa da obra)", "incidence": 0.69, "unit": "vb" },
                  { "id": "1.3", "name": "ligações provisórias (água, energia, telefone e esgoto)", "incidence": 0.04, "unit": "vb" },
                  { "id": "1.4", "name": "manutenção canteiro/consumo", "incidence": 1.25, "unit": "mes" },
                  { "id": "1.5", "name": "transportes máquinas e equipamentos", "incidence": 0.89, "unit": "vb" },
                  { "id": "1.6", "name": "controle tecnológico", "incidence": 0.08, "unit": "vb" },
                  { "id": "1.7", "name": "gestão de resíduos", "incidence": 0.05, "unit": "vb" },
                  { "id": "1.8", "name": "gestão da qualidade", "incidence": 0.05, "unit": "vb" },
                  { "id": "1.10", "name": "administração local (engenheiros, mestres, etc.)", "incidence": 2.84, "unit": "mes" }
                ]
              },
              {
                "id": "2",
                "name": "FUNDAÇÕES E CONTENÇÕES",
                "subItems": [
                   { "id": "2.1", "name": "Fundações", "incidence": 7.36, "unit": "etapa" }
                ]
              },
              {
                "id": "3",
                "name": "SUPRAESTRUTURA",
                "subItems": [
                  { "id": "3.1", "name": "Supraestrutura", "incidence": 14.15, "unit": "etapa" }
                ]
              }
            ]

            Budget Text to Analyze:
            ---
            ${textContent}
            ---
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });

        return cleanAndParseJson(response.text);

    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};

/**
 * Gera um resumo executivo para um relatório de progresso usando IA.
 * Sintetiza os principais dados do projeto e financeiros em um texto coeso.
 * @param {Project} project O objeto do projeto.
 * @param {Financials} financials O resumo financeiro calculado.
 * @param {ServiceCategory[]} plsData Os dados da PLS.
 * @param {ReportOptions} options As opções de relatório selecionadas pelo usuário.
 * @returns {Promise<string>} Uma promessa que resolve com o texto do resumo ou uma mensagem de erro.
 */
export const generateReportSummary = async (
    project: Project,
    financials: Financials,
    plsData: ServiceCategory[],
    options: ReportOptions
): Promise<string> => {
    try {
        const filteredPlsData = plsData.filter(cat => options.selectedCategoryIds.includes(cat.id));

        const prompt = `
            Você é um analista sênior de projetos de construção civil. Com base nos dados a seguir, escreva um resumo executivo conciso para um relatório de progresso.
            O resumo deve ser em português do Brasil.
            Destaque o progresso geral, as principais métricas financeiras (custo total, valor liberado, saldo restante), identifique quaisquer categorias que estejam significativamente adiantadas ou atrasadas em relação ao seu peso no orçamento, e sugira pontos de atenção para o próximo período.

            **Detalhes do Projeto:**
            - Nome: ${project.name}
            - Unidades: ${project.housing_units.length}
            - Custo Total das Obras: R$ ${project.cost_of_works.toLocaleString('pt-BR')}
            - Custo Total do Empreendimento: R$ ${project.total_enterprise_cost.toLocaleString('pt-BR')}
            - VGV: R$ ${project.vgv.toLocaleString('pt-BR')}

            **Resumo Financeiro:**
            - Progresso Total do Projeto: ${financials.totalProgress.toFixed(2)}%
            - Valor Liberado (Medido): R$ ${financials.totalReleased.toLocaleString('pt-BR')}
            - Saldo a Medir: R$ ${financials.balanceToMeasure.toLocaleString('pt-BR')}

            **Progresso por Etapa (Incluídas no Relatório):**
            ${filteredPlsData.map(cat => `
            - **${cat.name}**:
              - Custo Total da Etapa: R$ ${cat.totalCost.toLocaleString('pt-BR')}
              - Progresso da Etapa: ${financials.categoryTotals.find(c => c.id === cat.id)?.progress.toFixed(2) ?? 'N/A'}%
              - Valor Liberado na Etapa: R$ ${financials.categoryTotals.find(c => c.id === cat.id)?.released.toLocaleString('pt-BR') ?? 'N/A'}
            `).join('')}

            Forneça o resumo como um bloco de texto único, usando parágrafos para estruturação. Seja profissional e direto ao ponto.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        return handleGeminiError(error);
    }
};