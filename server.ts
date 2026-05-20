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
  apiKey: process.env.GEMINI_API_KEY,
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
      model: "gemini-3.5-flash",
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

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Scrape Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/linkedin/analyze-pdf", async (req, res) => {
  const { base64Data } = req.body;
  if (!base64Data) return res.status(400).json({ error: "Base64 data is required" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
