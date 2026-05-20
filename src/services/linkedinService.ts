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

  // Helpers for cleaning the connection level indicators or other LinkedIn noise
  const cleanConnectionNoise = (str: string): string => {
    return str
      .replace(/\b(1st|2nd|3rd|1er|2do|3er|1\.º|2\.º|3\.º)\b/gi, '')
      .replace(/\b(conexi[oó]n|connections|connection|following|seguidores|mutual|contacto|contact|info|enviar|mensaje)\b/gi, '')
      .replace(/^\s*·\s*/, '')
      .replace(/\s*·\s*$/, '')
      .trim();
  };

  // 4. Try parsing the FIRST LINE
  const firstLine = lines[0] || '';
  
  // If first line contains separators (·, |, -, —)
  if (firstLine.includes('·') || firstLine.includes('|') || firstLine.includes('—') || firstLine.includes('–')) {
    const mainParts = firstLine.split(/[·|—–]/).map(p => p.trim()).filter(Boolean);
    if (mainParts.length >= 1) {
      name = mainParts[0];
      name = name.replace(/\s*\(.*\)\s*/g, ''); // remove parental parentheses e.g. (He/Him)
      name = name.replace(/,\s*(PMP|PhD|MBA|MSc|Jr|Sr).*$/i, ''); // remove titles
      
      // Look at the second part for connection indicator & position / company
      if (mainParts.length >= 2) {
        let secondPart = cleanConnectionNoise(mainParts[1]);
        if (secondPart) {
          // Check for sub-separators en/at/@/de
          const subSeps = [/\s+en\s+/i, /\s+at\s+/i, /\s*@\s*/, /\s+de\s+/i, /\s+of\s+/i];
          let matchedSub = false;
          for (const sep of subSeps) {
            if (sep.test(secondPart)) {
              const subParts = secondPart.split(sep);
              if (subParts.length >= 2) {
                position = subParts[0].trim();
                company = subParts[1].trim();
                matchedSub = true;
                break;
              }
            }
          }
          if (!matchedSub) {
            position = secondPart;
          }
        }
      }
      
      // Look at third part if present (often has company or location)
      if (mainParts.length >= 3 && !company) {
        const thirdPart = cleanConnectionNoise(mainParts[2]);
        if (thirdPart && thirdPart.length < 50) {
          company = thirdPart;
        }
      }
    }
  } else {
    // If first line is simple, check if it contains "en" or "at" or "de"
    const simpleSeps = [/\s+en\s+/i, /\s+at\s+/i, /\s*@\s*/, /\s*\|\s*/, /\s+de\s+/i];
    let matchedSimple = false;
    for (const sep of simpleSeps) {
      if (sep.test(firstLine)) {
        const parts = firstLine.split(sep);
        if (parts.length >= 2 && parts[0].split(/\s+/).length <= 4) {
          name = parts[0].trim();
          position = parts[1].trim();
          matchedSimple = true;
          break;
        }
      }
    }
    if (!matchedSimple) {
      name = firstLine;
    }
  }

  // 5. Look for country, position, and company in subsequent lines
  const locationKeywords = [
    'argentina', 'españa', 'spain', 'méxico', 'mexico', 'colombia', 'chile', 'perú', 'peru', 
    'venezuela', 'uruguay', 'paraguay', 'bolivia', 'ecuador', 'panamá', 'panama', 'costa rica',
    'estados unidos', 'usa', 'united states', 'miami', 'madrid', 'barcelona', 'buenos aires',
    'bogota', 'lima', 'santiago', 'cdmx', 'guadalajara', 'london', 'londres'
  ];

  for (let idx = 1; idx < Math.min(lines.length, 6); idx++) {
    const rawLine = lines[idx];
    const line = cleanConnectionNoise(rawLine);
    if (!line) continue;

    // A. Identify Location
    if (!country) {
      if (locationKeywords.some(keyword => line.toLowerCase().includes(keyword)) && line.length < 60) {
        country = line.replace(/^\s*Ubicaci[oó]n:\s*/i, '').replace(/^\s*Location:\s*/i, '');
        continue;
      }
    }

    // B. Identify Position & Company if not already filled
    if (!position || !company) {
      const separators = [/\s+en\s+/i, /\s+at\s+/i, /\s*@\s*/, /\s*\|\s*/, /\s+de\s+/i];
      let matchedLine = false;
      for (const sep of separators) {
        if (sep.test(line)) {
          const parts = line.split(sep);
          if (parts.length >= 2) {
            const posCand = parts[0].trim();
            const compCand = parts[1].trim();
            if (posCand.length > 2 && posCand.length < 80 && compCand.length > 2 && compCand.length < 80) {
              if (!position) position = posCand;
              if (!company) company = compCand;
              matchedLine = true;
              break;
            }
          }
        }
      }

      // If no separator matched, use line as position or company
      if (!matchedLine && line.length < 70) {
        const lowerLine = line.toLowerCase();
        const isExcluded = ['conexiones', 'mutual', 'followers', 'seguidores', 'contacto', 'contact', 'about', 'experiencia', 'ver m[aá]s'].some(k => lowerLine.includes(k));
        if (!isExcluded) {
          if (!position) {
            position = line;
          } else if (!company && line !== position) {
            company = line;
          }
        }
      }
    }
  }

  // Form sanitization and friendly defaults
  if (name) {
    name = cleanConnectionNoise(name);
    // Remove trailing single special chars or connection leftovers
    name = name.replace(/\s*·\s*$/, '').trim();
  }
  if (!name || name.length < 2) {
    name = "Lead de LinkedIn";
  }

  // Humanize short forms in title
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

