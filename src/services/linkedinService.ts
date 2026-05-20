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
      { names: ['argentina'], display: 'Argentina' },
      { names: ['españa', 'spain'], display: 'España' },
      { names: ['méxico', 'mexico', 'cdmx'], display: 'México' },
      { names: ['colombia'], display: 'Colombia' },
      { names: ['chile'], display: 'Chile' },
      { names: ['perú', 'peru'], display: 'Perú' },
      { names: ['venezuela'], display: 'Venezuela' },
      { names: ['uruguay'], display: 'Uruguay' },
      { names: ['paraguay'], display: 'Paraguay' },
      { names: ['bolivia'], display: 'Bolivia' },
      { names: ['ecuador'], display: 'Ecuador' },
      { names: ['panamá', 'panama'], display: 'Panamá' },
      { names: ['costa rica'], display: 'Costa Rica' },
      { names: ['dominicana', 'república dominicana', 'republica dominicana', 'santo domingo'], display: 'República Dominicana' },
      { names: ['puerto rico'], display: 'Puerto Rico' },
      { names: ['guatemala'], display: 'Guatemala' },
      { names: ['honduras'], display: 'Honduras' },
      { names: ['el salvador', 'salvador'], display: 'El Salvador' },
      { names: ['nicaragua'], display: 'Nicaragua' },
      { names: ['cuba'], display: 'Cuba' },
      { names: ['estados unidos', 'usa', 'united states', 'ee.uu', 'eeuu', 'florida', 'miami', 'new york', 'california'], display: 'Estados Unidos' },
      { names: ['brasil', 'brazil'], display: 'Brasil' },
      { names: ['portugal'], display: 'Portugal' },
      { names: ['italia', 'italy'], display: 'Italia' },
      { names: ['francia', 'france'], display: 'Francia' },
      { names: ['alemania', 'germany'], display: 'Alemania' },
      { names: ['london', 'londres', 'united kingdom', 'reino unido', 'uk'], display: 'Reino Unido' },
      { names: ['suecia', 'sweden'], display: 'Suecia' },
      { names: ['suiza', 'switzerland'], display: 'Suiza' },
      { names: ['canadá', 'canada'], display: 'Canadá' }
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

  // 4. Try parsing the Name (always on the first line)
  const firstLine = lines[0] || '';
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

  // 5. Run smart analysis lines 1..6
  for (let idx = 1; idx < Math.min(lines.length, 6); idx++) {
    const rawLine = lines[idx];
    const line = cleanConnectionNoise(rawLine);
    if (!line) continue;

    // A. Search Location
    if (!country) {
      const locationMatch = extractCountryAndCity(line);
      if (locationMatch) {
        country = locationMatch;
        continue;
      }
    }

    // B. Search Position & Company
    if (!position || !company) {
      const pcResult = extractPositionAndCompany(line);
      if (pcResult) {
        if (!position) position = pcResult.position;
        if (!company) company = pcResult.company;
      }
    }
  }

  // Fallbacks for Position and Company if they are still empty but we have subsequent lines
  if (!position && lines.length > 1) {
    for (let idx = 1; idx < Math.min(lines.length, 4); idx++) {
      const line = cleanConnectionNoise(lines[idx]);
      const lower = line.toLowerCase();
      const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia', 'ver m', 'ubicación'].some(k => lower.includes(k));
      if (!isExcluded && line.length > 3 && line.length < 70) {
        position = line;
        break;
      }
    }
  }

  if (!company && lines.length > 2) {
    for (let idx = 2; idx < Math.min(lines.length, 5); idx++) {
      const line = cleanConnectionNoise(lines[idx]);
      const lower = line.toLowerCase();
      const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia', 'ver m', 'ubicación'].some(k => lower.includes(k));
      if (!isExcluded && line.length > 2 && line.length < 60 && line !== position) {
        company = line;
        break;
      }
    }
  }

  // Standardize position keywords
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

