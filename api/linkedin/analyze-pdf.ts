import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
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

  const { base64Data } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: "Base64 data is required" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
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
        ]
      },
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

    const parsedData = JSON.parse(response.text || "{}");
    return res.status(200).json(parsedData);
  } catch (error: any) {
    console.error("PDF Analysis Vercel Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
