import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Lead, Meeting } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Sparkles, Loader2, TrendingUp, AlertCircle, Target } from 'lucide-react';

interface AIInsightsProps {
  leads: Lead[];
  meetings: Meeting[];
}

export const DashboardAIInsights = ({ leads, meetings }: AIInsightsProps) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY;
    if (!apiKey) {
      // Mock insights for demo purposes
      setTimeout(() => {
        setInsight(`🚀 **Oportunidad Detectada**: Tienes 5 leads en 'Qualified' con más de 3 días sin actividad. Prioriza el contacto hoy para evitar que se enfríen.
        
📊 **Tendencia de Conversión**: Tu tasa de cierre en el sector 'Software/IT' es un 15% superior al promedio. Enfoca tus campañas de prospección en este nicho.

📅 **Optimización de Agenda**: El 80% de tus reuniones exitosas ocurren los martes y jueves por la mañana. Intenta concentrar tus cierres en esos slots.`);
        setLoading(false);
      }, 1500);
      return;
    }

    setLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const statsSummary = {
        totalLeads: leads.length,
        statusDistribution: leads.reduce((acc: any, lead) => {
          acc[lead.status] = (acc[lead.status] || 0) + 1;
          return acc;
        }, {}),
        topSector: leads.reduce((acc: any, lead) => {
          const s = lead.sector || 'N/A';
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {}),
        meetingsCount: meetings.length,
        conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === 'closed-won').length / leads.length) * 100).toFixed(1) : 0
      };

      const prompt = `Actúa como un experto en ventas y análisis de datos. Analiza las siguientes estadísticas de CRM y genera 3 puntos clave accionables (insights) para el usuario. 
      Los puntos deben ser breves, directos y en español.
      
      Estadísticas:
      - Total Leads: ${statsSummary.totalLeads}
      - Distribución: ${JSON.stringify(statsSummary.statusDistribution)}
      - Tasa Conversión: ${statsSummary.conversionRate}%
      - Reuniones: ${statsSummary.meetingsCount}
      
      Formato de salida: 3 bullets cortos con un emoji al inicio.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setInsight(response.text());
    } catch (error) {
      console.error("Error generating insights:", error);
      setInsight("No pudimos generar sugerencias en este momento. Inténtalo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leads.length > 0) {
      generateInsights();
    }
  }, [leads.length]);

  return (
    <Card className="border border-primary/20 bg-primary/5 rounded-xl shadow-none overflow-hidden h-full">
      <CardHeader className="border-b border-primary/10 px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-5" />
          <CardTitle className="text-base font-extrabold text-primary">Inteligencia de Datos</CardTitle>
        </div>
        {loading && <Loader2 className="animate-spin size-4 text-primary" />}
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-primary/10 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-primary/10 rounded animate-pulse w-full"></div>
            <div className="h-4 bg-primary/10 rounded animate-pulse w-2/3"></div>
          </div>
        ) : insight ? (
          <div className="text-sm font-medium text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {insight}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Analizando tu flujo para encontrar oportunidades...</p>
        )}
      </CardContent>
    </Card>
  );
};
