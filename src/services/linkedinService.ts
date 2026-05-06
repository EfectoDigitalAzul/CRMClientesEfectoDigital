import { GoogleGenAI, Type } from "@google/genai";

// Safe retrieval of API key
const getApiKey = () => {
  try {
    // @ts-ignore
    const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (viteKey) return viteKey;
    
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      const pKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (pKey) return pKey;
    }
  } catch (e) {
    console.warn("Error accessing environment variables:", e);
  }
  return "";
};

const apiKey = getApiKey();
if (!apiKey) {
  console.warn("⚠️ Clave de IA no detectada. Las funciones de extracción no funcionarán. Asegúrate de configurar VITE_GEMINI_API_KEY.");
}

const ai = new GoogleGenAI({ 
  apiKey: apiKey || "" 
});

// Timeout helper
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
};

// Exponential backoff helper
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function scrapeLinkedInProfile(url: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 2;
  
  if (!apiKey) {
    console.error("No se puede extraer: GEMINI_API_KEY faltante");
    return null;
  }
  
  try {
    const fetchProfile = async () => {
      // Extraemos el slug para ayudar a la búsqueda
      const slugMatch = url.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
      const slug = slugMatch ? slugMatch[1] : "";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza exhaustivamente este perfil de LinkedIn: ${url} (Slug: ${slug})
        
        TAREA: 
        1. Identifica el NOMBRE COMPLETO de la persona.
        2. Identifica su CARGO o PUESTO ACTUAL (búscalo como la ÚLTIMA experiencia que figura en el perfil, la más reciente).
        3. Identifica la EMPRESA actual para la que trabaja (búscala como la ÚLTIMA que figura en su listado de experiencia).
        4. Identifica su SECTOR o INDUSTRIA.
        5. Identifica su UBICACIÓN (País/Ciudad).
        
        REGLAS:
        - Prioriza la sección de "Experiencia" para determinar la empresa y cargo actuales.
        - La empresa y cargo actuales suelen ser los que no tienen fecha de finalización o están marcados como "Actual".
        - Si el nombre no es evidente, utiliza el slug (${slug}) para deducirlo o busca en Google el perfil.
        - En "Interés", resume brevemente su perfil profesional basado en su cargo actual.`,
        config: {
          systemInstruction: "Eres un experto en inteligencia comercial B2B. Tu objetivo es desglosar perfiles de LinkedIn para obtener datos de prospección precisos. Eres meticuloso y siempre buscas la última experiencia laboral listada como la empresa actual.",
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre completo" },
              company: { type: Type.STRING, description: "Empresa actual" },
              sector: { type: Type.STRING, description: "Industria" },
              country: { type: Type.STRING, description: "Ubicación" },
              interest: { type: Type.STRING, description: "Resumen de cargo/rol profesional" },
              position: { type: Type.STRING, description: "Cargo específico" },
              contactInfo: { type: Type.STRING, description: "URL de LinkedIn u otro dato si lo encuentras" }
            },
            required: ["name", "company"]
          }
        }
      });

      const text = response.text;
      if (!text) return null;
      
      try {
        return JSON.parse(text);
      } catch (e) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonContent = text.substring(firstBrace, lastBrace + 1);
          return JSON.parse(jsonContent);
        }
        throw e;
      }
    };

    // Increase timeout to 60 seconds for deep search
    return await withTimeout(fetchProfile(), 60000);
  } catch (error: any) {
    // If it's a 429 and we have retries left, wait and retry
    const isRateLimit = error?.message?.includes('429') || 
                       error?.message?.includes('RESOURCE_EXHAUSTED') || 
                       error?.message?.includes('THROTTLED_CLIENT');
                       
    if (isRateLimit && retryCount < MAX_RETRIES) {
      console.warn(`LinkedIn scraping throttled. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      // Wait with exponential backoff: 2s, 4s...
      await wait(Math.pow(2, retryCount + 1) * 1000);
      return scrapeLinkedInProfile(url, retryCount + 1);
    }

    console.error("Error scraping LinkedIn:", error);
    
    // Fallback logic if AI fails, timeouts, or URL is basic
    const match = url.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
    if (match) {
      const slug = match[1];
      const cleanSlug = slug.replace(/-[a-z0-9]+$/i, '');
      const name = cleanSlug.split(/[-._ ]+/).filter(s => s.length > 1 && !/^\d+$/.test(s)).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
      return {
        name: name || "Lead de LinkedIn",
        company: "Pendiente de verificación",
        country: "No especificado",
        sector: "No especificado",
        interest: "Perfil Profesional",
        contactInfo: ""
      };
    }
    return null;
  }
}

export async function analyzeLinkedInPDF(base64Data: string): Promise<any> {
  if (!apiKey) {
    console.error("No se puede analizar PDF: GEMINI_API_KEY faltante");
    return null;
  }

  try {
    console.log("Iniciando análisis de PDF con Gemini 1.5 Flash...");
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data
          }
        },
        {
          text: `Extrae la información profesional de este currículum o perfil de LinkedIn en PDF.
          
          IMPORTANTE: La empresa y el cargo deben ser los ÚLTIMOS que aparezcan en su listado de experiencia laboral (la experiencia más reciente o actual).
          
          VALORES REQUERIDOS (Devuelve estrictamente JSON):
          {
            "name": "Nombre completo",
            "company": "Empresa actual (última en su experiencia)",
            "sector": "Industria",
            "country": "Ubicación (País/Ciudad)",
            "interest": "Breve resumen profesional o cargo",
            "position": "Cargo actual específico (último en su experiencia)",
            "contactInfo": "Email o teléfono si aparece"
          }`
        }
      ],
      config: {
        systemInstruction: "Eres un experto en reclutamiento y prospección B2B. Tu objetivo es extraer datos precisos de perfiles de LinkedIn en formato PDF, priorizando siempre la experiencia más reciente.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            company: { type: Type.STRING },
            sector: { type: Type.STRING },
            country: { type: Type.STRING },
            interest: { type: Type.STRING },
            position: { type: Type.STRING },
            contactInfo: { type: Type.STRING }
          },
          required: ["name", "company"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    
    console.log("Respuesta de Gemini recibida, procesando...");
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn("Error parseando JSON directo, intentando extracción...", e);
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonContent = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonContent);
      }
      throw e;
    }
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    return null;
  }
}
