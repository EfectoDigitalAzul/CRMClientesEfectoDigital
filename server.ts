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

// Meta Ads Marketing API Insights Route
app.post("/api/meta/insights", async (req, res) => {
  const { accountId, accessToken, year, month } = req.body;
  if (!accountId) {
    return res.status(400).json({ error: "accountId es requerido" });
  }

  const token = accessToken || process.env.META_ACCESS_TOKEN;
  if (!token) {
    return res.status(400).json({ error: "Meta Access Token no proporcionado. Configúralo en los ajustes de Pauta." });
  }

  const cleanAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const targetYear = parseInt(year, 10) || new Date().getFullYear();
  const targetMonth = parseInt(month, 10) || (new Date().getMonth() + 1);

  const pad = (n: number) => String(n).padStart(2, '0');
  const m = pad(targetMonth);
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const monthStart = `${targetYear}-${m}-01`;
  const monthEnd = `${targetYear}-${m}-${pad(daysInMonth)}`;

  // Define week boundaries
  const weekRanges = {
    week1: { startDay: 1, endDay: 7, startStr: `${targetYear}-${m}-01`, endStr: `${targetYear}-${m}-07` },
    week2: { startDay: 8, endDay: 14, startStr: `${targetYear}-${m}-08`, endStr: `${targetYear}-${m}-14` },
    week3: { startDay: 15, endDay: 21, startStr: `${targetYear}-${m}-15`, endStr: `${targetYear}-${m}-21` },
    week4: { startDay: 22, endDay: daysInMonth, startStr: `${targetYear}-${m}-22`, endStr: `${targetYear}-${m}-${pad(daysInMonth)}` },
  };

  // If the entire month is in the future
  if (monthStart > todayStr) {
    return res.json({
      success: true,
      cleanAccountId,
      isFutureMonth: true,
      period: { since: monthStart, until: monthEnd },
      totalSpend: 0,
      totalLeads: 0,
      weeks: {
        week1: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
        week2: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
        week3: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
        week4: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: true, daysCount: 0 },
      }
    });
  }

  // Until date should never be in the future for Meta API
  const effectiveUntil = monthEnd > todayStr ? todayStr : monthEnd;

  try {
    // Query Meta Graph API with daily breakdown (time_increment=1)
    // We query both campaign-level and account-level for precision
    const campaignUrl = `https://graph.facebook.com/v19.0/${cleanAccountId}/insights?time_range={"since":"${monthStart}","until":"${effectiveUntil}"}&time_increment=1&level=campaign&fields=campaign_id,campaign_name,objective,spend,actions,cost_per_action_type&limit=1000&access_token=${encodeURIComponent(token)}`;
    const accountUrl = `https://graph.facebook.com/v19.0/${cleanAccountId}/insights?time_range={"since":"${monthStart}","until":"${effectiveUntil}"}&time_increment=1&fields=spend,actions,cost_per_action_type&limit=1000&access_token=${encodeURIComponent(token)}`;

    const [campaignRes, accountRes] = await Promise.all([
      fetch(campaignUrl),
      fetch(accountUrl)
    ]);

    const campaignData = await campaignRes.json();
    const accountData = await accountRes.json();

    if (accountData.error && campaignData.error) {
      const err = accountData.error || campaignData.error;
      console.error("Meta Graph API returned error:", err);
      return res.status(400).json({ 
        error: `Meta Ads API: ${err.message || 'Error de autenticación o cuenta no encontrada'} (Código ${err.code || 'Desconocido'})` 
      });
    }

    const weeksResult: Record<string, {
      formSpend: number;
      formLeads: number;
      wppSpend: number;
      wppLeads: number;
      totalSpend: number;
      isFuture: boolean;
      daysProcessed: Set<string>;
    }> = {
      week1: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week1.startStr > todayStr, daysProcessed: new Set() },
      week2: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week2.startStr > todayStr, daysProcessed: new Set() },
      week3: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week3.startStr > todayStr, daysProcessed: new Set() },
      week4: { formSpend: 0, formLeads: 0, wppSpend: 0, wppLeads: 0, totalSpend: 0, isFuture: weekRanges.week4.startStr > todayStr, daysProcessed: new Set() },
    };

    const getWeekKeyForDay = (day: number) => {
      if (day >= 1 && day <= 7) return 'week1';
      if (day >= 8 && day <= 14) return 'week2';
      if (day >= 15 && day <= 21) return 'week3';
      return 'week4';
    };

    const campaignItems: any[] = Array.isArray(campaignData.data) ? campaignData.data : [];
    const accountItems: any[] = Array.isArray(accountData.data) ? accountData.data : [];

    if (campaignItems.length > 0) {
      for (const item of campaignItems) {
        const dateStr = item.date_start;
        if (!dateStr || dateStr > todayStr) continue;

        const dayNum = parseInt(dateStr.split('-')[2], 10);
        const weekKey = getWeekKeyForDay(dayNum);
        const week = weeksResult[weekKey];
        if (week.isFuture) continue;

        const spend = parseFloat(item.spend || '0') || 0;
        const campaignName = (item.campaign_name || '').toLowerCase();
        const objective = (item.objective || '').toUpperCase();

        const isWpp = campaignName.includes('wpp') || 
                      campaignName.includes('whatsapp') || 
                      campaignName.includes('msg') || 
                      campaignName.includes('mensaj') ||
                      campaignName.includes('chat') ||
                      objective === 'OUTCOME_ENGAGEMENT' ||
                      objective === 'MESSAGES';

        let formLeads = 0;
        let wppLeads = 0;

        if (Array.isArray(item.actions)) {
          for (const act of item.actions) {
            const type = act.action_type || '';
            const val = parseInt(act.value || '0', 10) || 0;

            if (type === 'lead' || type === 'onsite_conversion.lead_grouped' || type === 'leadgen_grouped' || type === 'offsite_conversion.fb_pixel_lead' || type === 'contact') {
              if (type === 'lead' || (type === 'onsite_conversion.lead_grouped' && formLeads === 0)) {
                formLeads += val;
              }
            } else if (type.includes('messaging') || type === 'onsite_conversion.messaging_conversation_started_7d' || type === 'onsite_conversion.total_messaging_connection' || type.includes('whatsapp') || type === 'messages') {
              if (type === 'onsite_conversion.messaging_conversation_started_7d' || (type.includes('messaging') && wppLeads === 0)) {
                wppLeads += val;
              }
            }
          }
        }

        if (isWpp) {
          week.wppSpend += spend;
          week.wppLeads += (wppLeads || formLeads);
        } else {
          week.formSpend += spend;
          week.formLeads += (formLeads || (wppLeads && !isWpp ? wppLeads : 0));
        }

        week.totalSpend += spend;
        week.daysProcessed.add(dateStr);
      }
    } else if (accountItems.length > 0) {
      for (const item of accountItems) {
        const dateStr = item.date_start;
        if (!dateStr || dateStr > todayStr) continue;

        const dayNum = parseInt(dateStr.split('-')[2], 10);
        const weekKey = getWeekKeyForDay(dayNum);
        const week = weeksResult[weekKey];
        if (week.isFuture) continue;

        const spend = parseFloat(item.spend || '0') || 0;
        let formLeads = 0;
        let wppLeads = 0;

        if (Array.isArray(item.actions)) {
          for (const act of item.actions) {
            const type = act.action_type || '';
            const val = parseInt(act.value || '0', 10) || 0;

            if (type === 'lead' || type === 'onsite_conversion.lead_grouped' || type === 'leadgen_grouped') {
              formLeads = Math.max(formLeads, val);
            } else if (type.includes('messaging') || type === 'onsite_conversion.messaging_conversation_started_7d') {
              wppLeads = Math.max(wppLeads, val);
            }
          }
        }

        if (wppLeads > 0 && formLeads === 0) {
          week.wppSpend += spend;
          week.wppLeads += wppLeads;
        } else {
          week.formSpend += spend;
          week.formLeads += formLeads;
          week.wppLeads += wppLeads;
        }

        week.totalSpend += spend;
        week.daysProcessed.add(dateStr);
      }
    }

    const cleanWeeks: Record<string, any> = {};
    let grandTotalSpend = 0;
    let grandTotalLeads = 0;

    for (const [key, w] of Object.entries(weeksResult)) {
      const roundedFormSpend = Math.round(w.formSpend * 100) / 100;
      const roundedWppSpend = Math.round(w.wppSpend * 100) / 100;
      cleanWeeks[key] = {
        formSpend: w.isFuture ? 0 : roundedFormSpend,
        formLeads: w.isFuture ? 0 : w.formLeads,
        wppSpend: w.isFuture ? 0 : roundedWppSpend,
        wppLeads: w.isFuture ? 0 : w.wppLeads,
        isFuture: w.isFuture,
        totalSpend: w.isFuture ? 0 : Math.round((roundedFormSpend + roundedWppSpend) * 100) / 100,
        daysCount: w.daysProcessed.size,
      };
      if (!w.isFuture) {
        grandTotalSpend += cleanWeeks[key].totalSpend;
        grandTotalLeads += (cleanWeeks[key].formLeads + cleanWeeks[key].wppLeads);
      }
    }

    res.json({
      success: true,
      cleanAccountId,
      period: { since: monthStart, until: effectiveUntil },
      totalSpend: Math.round(grandTotalSpend * 100) / 100,
      totalLeads: grandTotalLeads,
      weeks: cleanWeeks,
      itemsCount: campaignItems.length || accountItems.length,
    });
  } catch (error: any) {
    console.error("Meta Insights Server Error:", error);
    res.status(500).json({ error: error.message || "Error al conectar con la API de Meta Ads" });
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
