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

export function parseTextHeuristically(text: string): any {
  if (!text || !text.trim()) return null;
  
  // Clean double carriage returns and split into lines
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let name = '';
  let position = '';
  let company = '';
  let country = '';
  let sector = '';
  let interest = '';
  let contactInfo = '';
  let linkedinUrl = '';

  // 1. Try to find LinkedIn URL anywhere in the text
  const urlMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[^\s\"\'\<\>\,\;\(\)\#]+/i);
  if (urlMatch) {
    linkedinUrl = urlMatch[0];
  }

  // 2. Try to find Emails
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    contactInfo = emailMatch[0];
  }

  // 3. Try to find Phone numbers
  const phoneMatch = text.match(/(\+\d{1,4}[ \t]*)?[0-9]{3,4}[ \t]*[0-9]{3,4}[ \t]*[0-9]{3,6}/);
  if (phoneMatch && !contactInfo) {
    contactInfo = phoneMatch[0];
  }

  // Helpers for cleaning connection level indicators or other LinkedIn noise
  const cleanConnectionNoise = (str: string): string => {
    return str
      .replace(/\b(?:1st|2nd|3rd|1er|2do|3er|1\.º|2\.º|3\.º)\b/gi, '')
      .replace(/\b(?:conexi[oó]n|connections|connection|following|seguidores|mutual|contacto|contact|info|enviar|mensaje)\b/gi, '')
      .replace(/^\s*[·|•-]\s*/, '')
      .replace(/\s*[·|•-]\s*$/, '')
      .trim();
  };

  // Helper to split a line into Position and Company
  const extractPositionAndCompany = (lineText: string): { position: string; company: string } | null => {
    if (!lineText) return null;
    
    // First, split by major structural separators
    const structuralParts = lineText.split(/\s*(?:\||[-–—•\t])\s*/).map(p => p.trim()).filter(Boolean);
    const candidate = structuralParts[0] || '';
    
    // Next, check if the candidate contains sub-separators like "en", "at", "de", "@"
    const subSeps = [
      /\s+(?:en|at|de|in|of)\s+/i,
      /\s*@\s*/
    ];
    
    for (const sep of subSeps) {
      if (sep.test(candidate)) {
        const parts = candidate.split(sep).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return {
            position: parts[0],
            company: parts[1]
          };
        }
      }
    }
    
    // Fallback: If we have multiple structural parts, the first is likely position and the second is company
    if (structuralParts.length >= 2) {
      const posCand = structuralParts[0];
      const compCand = structuralParts[1];
      if (posCand.length > 2 && posCand.length < 60 && compCand.length > 2 && compCand.length < 60) {
        // Exclude descriptive text as company name
        const isDescriptive = ['liderando', 'ayudando', 'conduciendo', 'crecimiento', 'ventas', 'especialista'].some(w => compCand.toLowerCase().includes(w));
        if (!isDescriptive) {
          return {
            position: posCand,
            company: compCand
          };
        }
      }
    }
    
    return null;
  };

  // Helper to extract country and city
  const extractCountryAndCity = (lineText: string): string | null => {
    if (!lineText) return null;
    
    const locationKeywords = [
      { names: ['argentina', 'buenos aires', 'córdoba', 'cordoba', 'rosario', 'mendoza', 'tucumán', 'tucuman', 'la plata', 'mar del plata', 'salta', 'santa fe'], display: 'Argentina' },
      { names: ['españa', 'spain', 'madrid', 'barcelona', 'valencia', 'sevilla', 'zaragoza', 'málaga', 'malaga', 'bilbao', 'murcia', 'palma', 'las palmas', 'alicante', 'vigo', 'gijón', 'gijon'], display: 'España' },
      { names: ['méxico', 'mexico', 'cdmx', 'guadalajara', 'monterrey', 'puebla', 'tijuana', 'querétaro', 'queretaro', 'cancún', 'cancun', 'mérida', 'merida', 'león', 'leon'], display: 'México' },
      { names: ['colombia', 'bogotá', 'bogota', 'medellín', 'medellin', 'cali', 'barranquilla', 'cartagena', 'bucaramanga', 'pereira'], display: 'Colombia' },
      { names: ['chile', 'santiago', 'valparaíso', 'valparaiso', 'concepción', 'concepcion', 'viña del mar', 'laserena'], display: 'Chile' },
      { names: ['perú', 'peru', 'lima', 'arequipa', 'trujillo', 'chiclayo'], display: 'Perú' },
      { names: ['venezuela', 'caracas', 'maracaibo', 'valencia', 'barquisimeto'], display: 'Venezuela' },
      { names: ['uruguay', 'montevideo', 'punta del este'], display: 'Uruguay' },
      { names: ['paraguay', 'asunción', 'asuncion', 'ciudad del este'], display: 'Paraguay' },
      { names: ['bolivia', 'la paz', 'sucre', 'santa cruz', 'cochabamba'], display: 'Bolivia' },
      { names: ['ecuador', 'quito', 'guayaquil', 'cuenca', 'manta'], display: 'Ecuador' },
      { names: ['panamá', 'panama'], display: 'Panamá' },
      { names: ['costa rica', 'san josé', 'san jose', 'alajuela'], display: 'Costa Rica' },
      { names: ['dominicana', 'república dominicana', 'republica dominicana', 'santo domingo', 'santiago de los caballeros'], display: 'República Dominicana' },
      { names: ['puerto rico', 'san juan', 'ponce'], display: 'Puerto Rico' },
      { names: ['guatemala', 'ciudad de guatemala'], display: 'Guatemala' },
      { names: ['honduras', 'tegucigalpa', 'san pedro sula'], display: 'Honduras' },
      { names: ['el salvador', 'salvador', 'san salvador'], display: 'El Salvador' },
      { names: ['nicaragua', 'managua'], display: 'Nicaragua' },
      { names: ['cuba', 'la habana', 'habana'], display: 'Cuba' },
      { names: ['estados unidos', 'usa', 'united states', 'ee.uu', 'eeuu', 'florida', 'miami', 'new york', 'california', 'los angeles', 'texas', 'houston', 'chicago'], display: 'Estados Unidos' },
      { names: ['brasil', 'brazil', 'sao paulo', 'são paulo', 'rio de janeiro', 'brasilia', 'brazilian'], display: 'Brasil' },
      { names: ['portugal', 'lisboa', 'lisbon', 'porto'], display: 'Portugal' },
      { names: ['italia', 'italy', 'roma', 'rome', 'milano', 'milan'], display: 'Italia' },
      { names: ['francia', 'france', 'paris', 'parís', 'lyon', 'marseille'], display: 'Francia' },
      { names: ['alemania', 'germany', 'berlin', 'berlín', 'munich', 'múnich', 'frankfurt', 'hamburg'], display: 'Alemania' },
      { names: ['london', 'londres', 'united kingdom', 'reino unido', 'uk', 'scotland', 'escocia', 'manchester'], display: 'Reino Unido' },
      { names: ['suecia', 'sweden', 'stockholm', 'estocolmo'], display: 'Suecia' },
      { names: ['suiza', 'switzerland', 'geneva', 'ginebra', 'zurich', 'zúrich'], display: 'Suiza' },
      { names: ['canadá', 'canada', 'toronto', 'montreal', 'vancouver'], display: 'Canadá' }
    ];

    const lowerLine = lineText.toLowerCase();
    for (const item of locationKeywords) {
      if (item.names.some(n => lowerLine.includes(n))) {
        let cleaned = cleanConnectionNoise(lineText);
        // Filter out extraneous text after details separator
        if (cleaned.includes('·')) {
          cleaned = cleaned.split('·')[0].trim();
        }
        return cleaned; // e.g. "Santo Domingo, República Dominicana" or "República Dominicana"
      }
    }
    
    // Check if it looks explicitly like a location line
    const locationClues = ['ubicación', 'location', 'área de', 'area de', 'área metropolitana', 'greater', 'provincia', 'departamento'];
    if (locationClues.some(clue => lowerLine.includes(clue)) && lineText.length < 80) {
      let cleaned = cleanConnectionNoise(lineText)
        .replace(/^\s*Ubicaci[oó]n:\s*/i, '')
        .replace(/^\s*Location:\s*/i, '')
        .trim();
      if (cleaned.includes('·')) {
        cleaned = cleaned.split('·')[0].trim();
      }
      return cleaned;
    }
    
    return null;
  };

  // Skip noise and UI garbage lines to find the true Name line
  const cleanLines: string[] = [];
  const uiKeywordsToSkip = [
    'cerrar sesión', 'cerrar sesion', 'volver a linkedin', 'ver perfil', 'sign in', 'skip to', 'atrás', 'back', 
    'linkedin', 'buscar', 'search', 'guardar', 'save', 'compartir', 'share', 'más...', 'more...',
    'notificaciones', 'empleos', 'mi red', 'mensajes', 'inicio', 'enviar un mensaje', 'enviar mensaje',
    'conectar', 'connect', 'sigue a', 'siguiendo', 'unirse', 'join', 'registrarse', 'register', 'página principal',
    'pagina principal', 'tú', 'you'
  ];
  
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const lower = trimmed.toLowerCase();
    
    const isUiLabel = uiKeywordsToSkip.some(k => lower === k || lower.startsWith(k + ' ') || lower.startsWith(k + '…') || lower.startsWith(k + '...'));
    if (trimmed && !isUiLabel && trimmed.length > 1) {
      cleanLines.push(trimmed);
    }
  }

  // 4. Extract Name
  const firstLine = cleanLines[0] || '';
  if (firstLine.includes('·') || firstLine.includes('|') || firstLine.includes('—') || firstLine.includes('–')) {
    const mainParts = firstLine.split(/[·|—–]/).map(p => p.trim()).filter(Boolean);
    if (mainParts.length >= 1) {
      name = mainParts[0];
    }
  } else {
    name = firstLine;
  }
  
  if (name) {
    name = cleanConnectionNoise(name)
      .replace(/\s*\(.*\)\s*/g, '') // remove parentheses e.g. (He/Him)
      .replace(/,\s*(?:PMP|PhD|MBA|MSc|Jr|Sr).*$/i, '') // remove credentials
      .trim();
  }

  if (!name || name.length < 2) {
    name = "Lead de LinkedIn";
  }

  // Helper patterns
  const isDateOrDurationLine = (lineText: string): boolean => {
    const lower = lineText.toLowerCase();
    const hasYear = /\b(19|20)\d{2}\b/.test(lower);
    const hasPresent = ['presente', 'present', 'actual', 'actualidad', 'actualmente'].some(w => lower.includes(w));
    const hasMonth = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ].some(m => lower.includes(m));
    const hasDuration = ['año', 'aaa', 'mes', 'yr', 'mont', 'mos', 'mth'].some(d => lower.includes(d));
    return (hasYear || hasPresent) || (hasMonth && hasDuration);
  };

  const titleKeywords = [
    'ceo', 'cto', 'cfo', 'coo', 'vp', 'vicepresident', 'founder', 'fundador', 'co-founder', 'cofundador', 
    'director', 'directora', 'manager', 'gerente', 'lead', 'lider', 'líder', 'head', 'jefe', 'jefa',
    'developer', 'programador', 'programadora', 'engineer', 'ingeniero', 'ingeniera', 'analista', 'analyst',
    'specialist', 'especialista', 'consultant', 'consultor', 'consultora', 'designer', 'diseñador', 'diseñadora',
    'architect', 'arquitecto', 'arquitecta', 'coordinator', 'coordinador', 'coordinadora', 'partner', 'socio', 'socia',
    'growth', 'sales', 'ventas', 'marketing', 'comercial', 'account', 'customer', 'success', 'sistemas', 'it',
    'desarrollador', 'desarrolladora', 'ux', 'ui', 'product', 'producto'
  ];

  const containsTitleKeyword = (lineValue: string): boolean => {
    const normalized = lineValue.toLowerCase();
    return titleKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(normalized);
    });
  };

  // 5. Look for the "Experiencia" / "Experience" Section
  let expIdx = -1;
  for (let i = 0; i < cleanLines.length; i++) {
    const norm = cleanLines[i].toLowerCase();
    if (norm === 'experiencia' || norm === 'experience' || norm === 'trayectoria laboral' || norm === 'historial laboral' || norm === 'background') {
      expIdx = i;
      break;
    }
  }

  if (expIdx !== -1) {
    const subLines = cleanLines.slice(expIdx + 1, expIdx + 12);
    
    // First pass: look for combined lines like "Puesto en Empresa" or "Puesto @ Empresa"
    for (let i = 0; i < Math.min(subLines.length, 4); i++) {
      const pc = extractPositionAndCompany(subLines[i]);
      if (pc) {
        position = pc.position;
        company = pc.company;
        // Search next lines for country
        for (let j = i + 1; j < Math.min(subLines.length, i + 3); j++) {
          const loc = extractCountryAndCity(subLines[j]);
          if (loc && !isDateOrDurationLine(subLines[j])) {
            country = loc;
            break;
          }
        }
        break;
      }
    }
    
    // If not found as combined line, search for a date/duration anchor line
    if (!position || !company) {
      let dateLineIdx = -1;
      for (let i = 0; i < Math.min(subLines.length, 6); i++) {
        if (isDateOrDurationLine(subLines[i])) {
          dateLineIdx = i;
          break;
        }
      }
      
      if (dateLineIdx >= 1) {
        const candy1 = subLines[dateLineIdx - 1]; // One line above (potential Company or Position)
        const candy2 = dateLineIdx >= 2 ? subLines[dateLineIdx - 2] : ''; // Two lines above (potential Position or Company)
        
        const cleanCandidate = (str: string): string => {
          if (!str) return '';
          let res = cleanConnectionNoise(str);
          if (res.includes('·')) res = res.split('·')[0];
          if (res.includes('|')) res = res.split('|')[0];
          if (res.includes('-')) {
            const parts = res.split('-');
            if (parts[0].trim().length > 1) {
              res = parts[0];
            }
          }
          return res.trim();
        };

        const rawComp = cleanCandidate(candy1);
        const rawPos = cleanCandidate(candy2);
        
        if (rawComp && rawPos) {
          if (containsTitleKeyword(rawComp) && !containsTitleKeyword(rawPos)) {
            position = rawComp;
            company = rawPos;
          } else {
            position = rawPos;
            company = rawComp;
          }
        } else if (rawComp) {
          if (containsTitleKeyword(rawComp)) {
            position = rawComp;
          } else {
            company = rawComp;
          }
        }
        
        // Extract country/location right after the date line
        if (dateLineIdx + 1 < subLines.length) {
          const loc = extractCountryAndCity(subLines[dateLineIdx + 1]);
          if (loc && !isDateOrDurationLine(subLines[dateLineIdx + 1])) {
            country = loc;
          }
        }
      } else {
        // Fallback under Experience header
        if (subLines.length >= 2) {
          const l0 = cleanConnectionNoise(subLines[0]);
          const l1 = cleanConnectionNoise(subLines[1]);
          if (l0 && l1) {
            position = l0;
            company = l1;
          }
        }
      }
    }
  }

  // 6. Header fallback logic if Experience section was not present or didn't yield enough data
  if (!position || !company || !country) {
    for (let idx = 1; idx < Math.min(cleanLines.length, 12); idx++) {
      const line = cleanConnectionNoise(cleanLines[idx]);
      if (!line) continue;

      if (!country) {
        const loc = extractCountryAndCity(line);
        if (loc) {
          country = loc;
        }
      }

      if (!position || !company) {
        const pcResult = extractPositionAndCompany(line);
        if (pcResult) {
          if (!position) position = pcResult.position;
          if (!company) company = pcResult.company;
        }
      }
    }

    // Safety fallback for country: check ALL original raw lines in case one was filtered out as UI clutter
    if (!country) {
      for (const rawLine of lines) {
        const loc = extractCountryAndCity(rawLine);
        if (loc) {
          country = loc;
          break;
        }
      }
    }

    // Subsequent level header fallbacks
    if (!position && cleanLines.length > 1) {
      for (let idx = 1; idx < Math.min(cleanLines.length, 4); idx++) {
        const line = cleanConnectionNoise(cleanLines[idx]);
        const lower = line.toLowerCase();
        const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia', 'ver m', 'ubicación'].some(k => lower.includes(k));
        if (!isExcluded && line.length > 3 && line.length < 70) {
          position = line;
          break;
        }
      }
    }

    if (!company && cleanLines.length > 2) {
      for (let idx = 2; idx < Math.min(cleanLines.length, 5); idx++) {
        const line = cleanConnectionNoise(cleanLines[idx]);
        const lower = line.toLowerCase();
        const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia', 'ver m', 'ubicación'].some(k => lower.includes(k));
        if (!isExcluded && line.length > 2 && line.length < 60 && line !== position) {
          company = line;
          break;
        }
      }
    }
  }

  // Final text processing and standardization
  if (position) {
    const lowerPos = position.toLowerCase();
    if (lowerPos === 'co fou' || lowerPos === 'co-fou' || lowerPos === 'co founder' || lowerPos === 'co-founder') {
      position = "Co-Founder";
    } else if (lowerPos === 'ceo') {
      position = "CEO";
    } else if (lowerPos === 'cto') {
      position = "CTO";
    }
  }

  if (!position) {
    position = "Perfil Profesional";
  }
  interest = position;

  if (!company) {
    company = "Pendiente de verificación";
  }

  return {
    name: name.substring(0, 50),
    company: company.substring(0, 70),
    position: position.substring(0, 70),
    country: (country || "No especificado").substring(0, 40),
    sector: sector || "No especificado",
    interest: interest.substring(0, 100),
    contactInfo: contactInfo || "",
    linkedinUrl
  };
}

export async function scrapeLinkedInProfile(url: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 8000; // 8 seconds fast timeout for app snappiness
  
  try {
    const fetchProfile = async () => {
      const response = await fetch("/api/linkedin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    };

    return await withTimeout(fetchProfile(), TIMEOUT_MS);
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || 
                       error?.message?.includes('RESOURCE_EXHAUSTED') || 
                       error?.message?.includes('THROTTLED_CLIENT');
                       
    if (isRateLimit && retryCount < MAX_RETRIES) {
      console.warn(`LinkedIn scraping throttled. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await wait(Math.pow(2, retryCount + 1) * 1000);
      return scrapeLinkedInProfile(url, retryCount + 1);
    }

    console.error("Error scraping LinkedIn, executing premium local fallback:", error);
    
    // Premium URL fallback parsing logic
    const match = url.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
    if (match) {
      const slug = match[1];
      const cleanSlug = slug.replace(/-[a-z0-9]+$/i, '');
      const name = cleanSlug
        .split(/[-._ ]+/)
        .filter(s => s.length > 1 && !/^\d+$/.test(s))
        .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(' ');
        
      return {
        name: name || "Lead de LinkedIn",
        company: "Pendiente de verificación",
        country: "No especificado",
        sector: "No especificado",
        interest: "Perfil Profesional",
        position: "Perfil Profesional",
        contactInfo: "",
        linkedinUrl: url
      };
    }
    return null;
  }
}

export async function analyzeProfessionalText(text: string): Promise<any> {
  const TIMEOUT_MS = 8000; // 8 seconds fast timeout
  
  try {
    const fetchAnalysis = async () => {
      const response = await fetch("/api/linkedin/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    };

    return await withTimeout(fetchAnalysis(), TIMEOUT_MS);
  } catch (error) {
    console.error("Google AI analysis failed/timed out, falling back to local heuristic extraction:", error);
    // Instant heuristic fallback so it always succeeds!
    return parseTextHeuristically(text);
  }
}

