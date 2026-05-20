import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json({ limit: '20mb' }));

// API Routes
app.post("/api/linkedin/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const slugMatch = url.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
    const slug = slugMatch ? slugMatch[1] : "";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza exhaustivamente este perfil de LinkedIn: ${url} (Slug: ${slug})
      
      TAREA: 
      1. Identifica el NOMBRE COMPLETO de la persona.
      2. Identifica su CARGO o PUESTO ACTUAL (búscalo como el trabajo o puesto de la experiencia laboral más reciente o activa).
      3. Identifica la EMPRESA o COMPAÑÍA actual para la que trabaja (búscala como la empresa de la experiencia laboral activa, vigente o más reciente).
      4. Identifica su SECTOR o INDUSTRIA (por ejemplo, Tecnología, Software, Marketing, etc.).
      5. Identifica su UBICACIÓN o PAÍS (búscalo en la cabecera del perfil o en su ubicación de residencia actual, ej: "Argentina" o "Madrid, España").
      
      REGLAS:
      - Prioriza la sección de "Experiencia" o "Experience" para determinar la empresa y cargo actuales.
      - La empresa y cargo actuales suelen ser los que no tienen fecha de finalización, están marcados como "Actual", "Present", "Presente" o "Actualidad", o son el primer elemento en su historial de trabajo.
      - Si el nombre no es evidente, utiliza el slug (${slug}) para deducirlo o busca en Google el perfil.
      - El campo "country" debe ser el País o Ciudad de residencia (ej: "Argentina", "España", "México"). Asegúrate de extraerlo con precisión de la cabecera del perfil.
      - En "interest", resume brevemente su perfil profesional basado en su cargo actual.`,
      config: {
        systemInstruction: "Eres un experto en inteligencia comercial B2B. Tu objetivo es desglosar perfiles de LinkedIn para obtener datos de prospección precisos. Eres meticuloso y siempre buscas el trabajo activo actual como la empresa y cargo actuales del prospecto.",
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
          required: ["name", "company", "country", "position"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Scrape Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/linkedin/analyze-text", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Text is required" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extrae la información profesional de este texto copiado de un currículum o perfil de LinkedIn.
      
      TEXTO DE PERFIL/CV:
      """
      ${text}
      """
      
      IMPORTANTE: La empresa (company) y el cargo (position) deben ser la EMPRESA ACTUAL y el CARGO ACTUAL de la persona, es decir, su experiencia laboral más reciente o vigente (que suele decir "Actual", "Present", "Presente", "Actualidad", o no tener año de finalización). No extraigas puestos anteriores o antiguos.
      
      UBICACIÓN: El campo "country" debe ser el País o Ciudad/País de residencia actual de la persona (ej: "Argentina", "España", "México", "Santiago, Chile") extraído de la cabecera o de las primeras líneas.
      
      Si el texto contiene enlaces o URLs de LinkedIn, extráelos si es posible.
      
      VALORES REQUERIDOS (Devuelve estrictamente JSON con este esquema):
      {
        "name": "Nombre completo de la persona",
        "company": "Empresa o compañía actual (la más reciente/activa en su experiencia laboral)",
        "sector": "Industria o sector (ej: Tecnología, Marketing, Finanzas, etc.)",
        "country": "Ubicación actual de residencia (País o Ciudad/País)",
        "interest": "Resumen rápido o cargo profesional principal actual",
        "position": "Cargo o título actual específico (el más reciente/activo en su experiencia laboral)",
        "contactInfo": "Email o teléfono si aparece"
      }`,
      config: {
        systemInstruction: "Eres un experto en reclutamiento y prospección B2B. Tu objetivo es extraer datos precisos de perfiles de LinkedIn o currículums pegados como texto, priorizando siempre la experiencia o puesto activo más reciente.",
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
          required: ["name", "company", "country", "position"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Text Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/linkedin/analyze-pdf", async (req, res) => {
  const { base64Data } = req.body;
  if (!base64Data) return res.status(400).json({ error: "Base64 data is required" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
          
          IMPORTANTE: La empresa (company) y el cargo (position) deben ser la EMPRESA ACTUAL y el CARGO ACTUAL de la persona, es decir, su experiencia laboral más reciente o vigente (que suele decir "Actual", "Present", "Presente", "Actualidad", o no tener año de finalización). No extraigas puestos anteriores o antiguos.
          
          UBICACIÓN: El campo "country" debe ser el País o Ciudad/País de residencia actual de la persona.
          
          VALORES REQUERIDOS (Devuelve estrictamente JSON):
          {
            "name": "Nombre completo",
            "company": "Empresa o compañía actual (la más reciente/activa)",
            "sector": "Industria",
            "country": "Ubicación actual (País o Ciudad/País)",
            "interest": "Resumen profesional o cargo actual",
            "position": "Cargo o puesto actual específico (el más reciente/activo)",
            "contactInfo": "Email o teléfono si aparece en el currículum"
          }`
          }
        ]
      },
      config: {
        systemInstruction: "Eres un experto en reclutamiento y prospección B2B. Tu objetivo es extraer datos precisos de perfiles de LinkedIn en formato PDF, priorizando siempre la experiencia más reciente o puesto activo.",
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
          required: ["name", "company", "country", "position"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("PDF Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
