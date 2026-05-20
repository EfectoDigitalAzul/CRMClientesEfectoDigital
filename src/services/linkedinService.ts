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
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let name = '';
  let position = '';
  let company = '';
  let country = '';
  let sector = '';
  let interest = '';
  let contactInfo = '';
  let linkedinUrl = '';

  // 1. Try to find LinkedIn URL
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

  // 4. Clean name from the first line
  let rawName = lines[0] || '';
  // Clean up common LinkedIn suffixes: · 1st, · 1er, Connections, Contact info, etc.
  rawName = rawName.replace(/\s*·\s*(1st|2nd|3rd|1er|2do|3er|Conexión|Contact|Sigue|Following|Enviar|Mensaje).*$/i, '');
  rawName = rawName.replace(/\s*\(.*\)\s*/g, ''); // parentheses e.g. (He/Him)
  rawName = rawName.replace(/,\s*(PMP|PhD|MBA|MSc|Jr|Sr).*$/i, ''); // professional credentials
  rawName = rawName.trim();

  if (rawName && rawName.length < 50 && rawName.split(/\s+/).length >= 1) {
    name = rawName;
  }

  // 5. Look for location or job titles in lines 2–6
  for (let idx = 1; idx < Math.min(lines.length, 6); idx++) {
    const line = lines[idx];

    // Identify location
    if (!country) {
      const locationKeywords = [
        'argentina', 'españa', 'spain', 'méxico', 'mexico', 'colombia', 'chile', 'perú', 'peru', 
        'venezuela', 'uruguay', 'paraguay', 'bolivia', 'ecuador', 'panamá', 'panama', 'costa rica',
        'estados unidos', 'usa', 'united states', 'miami', 'madrid', 'barcelona', 'buenos aires',
        'bogota', 'lima', 'santiago', 'cdmx', 'guadalajara'
      ];
      if (locationKeywords.some(keyword => line.toLowerCase().includes(keyword)) && line.length < 50) {
        country = line.replace(/^\s*UbicaciÃ³n:\s*/i, '').replace(/^\s*Location:\s*/i, '');
        continue;
      }
    }

    // Try splitting with common separators to extract position and company
    const separators = [/\s+at\s+/i, /\s+en\s+/i, /\s*@\s*/, /\s*\|\s*/];
    for (const sep of separators) {
      if (sep.test(line)) {
        const parts = line.split(sep);
        if (parts.length >= 2) {
          const posCand = parts[0].trim();
          const compCand = parts[1].trim();
          if (posCand.length < 70 && compCand.length < 70) {
            position = posCand;
            company = compCand;
            break;
          }
        }
      }
    }
  }

  // Fallbacks if split did not work
  if (!position && lines.length > 1) {
    const lowerLine = lines[1].toLowerCase();
    const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia'].some(k => lowerLine.includes(k));
    if (!isExcluded && lines[1].length < 70) {
      position = lines[1];
    }
  }
  if (!company && lines.length > 2) {
    const lowerLine2 = lines[2].toLowerCase();
    const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia'].some(k => lowerLine2.includes(k));
    if (!isExcluded && lines[2].length < 70) {
      company = lines[2];
    }
  }

  // Final trim and defaults
  if (name) name = name.substring(0, 50).trim();
  if (position) position = position.substring(0, 70).trim();
  if (company) company = company.substring(0, 70).trim();
  if (country) country = country.substring(0, 40).trim();

  if (!name || name.length < 2) {
    name = "Lead de LinkedIn";
  }
  if (!company) {
    company = "Pendiente de verificación";
  }
  if (!position) {
    position = "Perfil Profesional";
  }
  interest = position;

  return {
    name,
    company,
    position,
    country: country || "No especificado",
    sector: sector || "No especificado",
    interest,
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

