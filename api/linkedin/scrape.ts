import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export default async function handler(req: any, res: any) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const slugMatch = url.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
    const slug = slugMatch ? slugMatch[1] : "";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    const parsedData = JSON.parse(response.text || "{}");
    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error("Scrape Vercel Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
