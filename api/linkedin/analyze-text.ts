import { GoogleGenAI, Type } from "@google/genai";

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

  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Vercel Applet Error: GEMINI_API_KEY is not defined in environment variables. Falling back to client-side heuristics.");
    return res.status(500).json({ error: "GEMINI_API_KEY_MISSING", message: "Por favor configure la clave de API de Gemini" });
  }

  // Initialize Gemini with verified key
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extrae la información profesional de este texto copiado de un currículum o perfil de LinkedIn.
      
      TEXTO DE PERFIL/CV:
      """
      ${text}
      """
      
      IMPORTANTE: La empresa y el cargo deben ser los ÚLTIMOS que aparezcan en su listado de experiencia laboral (la experiencia más reciente o actual). Si el texto contiene enlaces o URLs de LinkedIn, extráelos si es posible.
      
      VALORES REQUERIDOS (Devuelve estrictamente JSON con este esquema):
      {
        "name": "Nombre completo de la persona",
        "company": "Empresa actual (última en su experiencia)",
        "sector": "Industria o sector",
        "country": "Ubicación (País/Ciudad)",
        "interest": "Breve resumen profesional o cargo",
        "position": "Cargo actual específico (último en su experiencia)",
        "contactInfo": "Email o teléfono si aparece"
      }`,
      config: {
        systemInstruction: "Eres un experto en reclutamiento y prospección B2B. Tu objetivo es extraer datos precisos de perfiles de LinkedIn o currúcums pegados como texto, priorizando siempre la experiencia más reciente.",
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
    console.error("Text Analysis Vercel Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
