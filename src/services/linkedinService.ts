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

export async function scrapeLinkedInProfile(url: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 2;
  
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

    // Increase timeout to 60 seconds for deep search
    return await withTimeout(fetchProfile(), 60000);
  } catch (error: any) {
    // If it's a 429 and we have retries left, wait and retry
    const isRateLimit = error?.message?.includes('429') || 
                       error?.message?.includes('RESOURCE_EXHAUSTED') || 
                       error?.message?.includes('THROTTLED_CLIENT');
                       
    if (isRateLimit && retryCount < MAX_RETRIES) {
      console.warn(`LinkedIn scraping throttled. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      // Wait with exponential backoff: 2s, 4s...
      await wait(Math.pow(2, retryCount + 1) * 1000);
      return scrapeLinkedInProfile(url, retryCount + 1);
    }

    console.error("Error scraping LinkedIn:", error);
    
    // Fallback logic
    const match = url.match(/linkedin\.com\/in\/([^\/?#\s]+)/);
    if (match) {
      const slug = match[1];
      const cleanSlug = slug.replace(/-[a-z0-9]+$/i, '');
      const name = cleanSlug.split(/[-._ ]+/).filter(s => s.length > 1 && !/^\d+$/.test(s)).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
      return {
        name: name || "Lead de LinkedIn",
        company: "Pendiente de verificación",
        country: "No especificado",
        sector: "No especificado",
        interest: "Perfil Profesional",
        contactInfo: ""
      };
    }
    return null;
  }
}

export async function analyzeProfessionalText(text: string): Promise<any> {
  try {
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
  } catch (error) {
    console.error("Error analyzing professional text:", error);
    return null;
  }
}

