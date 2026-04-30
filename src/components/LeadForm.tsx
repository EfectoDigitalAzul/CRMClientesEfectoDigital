import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { LeadStatus, Client } from '../types';
import { scrapeLinkedInProfile, analyzeLinkedInPDF } from '../services/linkedinService';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from './ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Linkedin, Sparkles, Loader2, UserCheck, UserCog, Calendar, FileText, Upload } from 'lucide-react';

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDemoMode?: boolean;
  clientId: string;
}

export default function LeadForm({ open, onOpenChange, isDemoMode, clientId }: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [parsingPdf, setParsingPdf] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    country: '',
    interest: '',
    contactInfo: '',
    sector: '',
    position: '',
    tag: '',
    stage: 'setter' as 'setter' | 'commercial',
  });

  useEffect(() => {
    const fetchClientTags = async () => {
      if (!clientId) return;
      
      try {
        if (isDemoMode) {
          const stored = localStorage.getItem('demo-clients');
          if (stored) {
            const clients = JSON.parse(stored) as Client[];
            const client = clients.find(c => c.id === clientId);
            if (client?.availableTags) {
              setAvailableTags(client.availableTags);
            }
          }
        } else {
          const clientSnap = await getDoc(doc(db, 'clients', clientId));
          if (clientSnap.exists()) {
            const data = clientSnap.data() as Client;
            if (data.availableTags) {
              setAvailableTags(data.availableTags);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching client tags:", error);
      }
    };

    if (open) {
      fetchClientTags();
    }
  }, [clientId, open, isDemoMode]);

  const handleScrape = async () => {
    if (!linkedinUrl) {
      toast.error("Ingresa una URL de LinkedIn primero");
      return;
    }
    
    if (!linkedinUrl.includes('linkedin.com/in/')) {
      toast.error("La URL debe ser de un perfil de LinkedIn (linkedin.com/in/...)");
      return;
    }

    setScraping(true);
    try {
      const data = await scrapeLinkedInProfile(linkedinUrl);
      if (data) {
        setFormData(prev => ({
          ...prev,
          name: data.name && data.name !== 'No especificado' && data.name !== 'Nombre' ? data.name : prev.name,
          company: data.company && data.company !== 'No especificado' && data.company !== 'Empresa' ? data.company : prev.company,
          country: data.country && data.country !== 'No especificado' && data.country !== 'País' ? data.country : prev.country,
          sector: data.sector && data.sector !== 'No especificado' && data.sector !== 'Industria' ? data.sector : prev.sector,
          position: data.position && data.position !== 'No especificado' && data.position !== 'Cargo' ? data.position : prev.position,
          interest: data.interest && data.interest !== 'No especificado' ? data.interest : prev.interest,
          contactInfo: data.contactInfo && data.contactInfo !== 'No especificado' ? data.contactInfo : prev.contactInfo,
        }));
        toast.success("Información extraída correctamente");
      } else {
        toast.error("No se pudo extraer información automáticamente");
      }
    } catch (error) {
      toast.error("Error al conectar con el servicio de extracción");
    } finally {
      setScraping(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error("Por favor sube un archivo PDF");
      return;
    }

    setParsingPdf(true);
    const toastId = toast.loading("Analizando PDF...");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const data = await analyzeLinkedInPDF(base64);
        
        if (data) {
          setFormData(prev => ({
            ...prev,
            name: data.name || prev.name,
            company: data.company || prev.company,
            country: data.country || prev.country,
            sector: data.sector || prev.sector,
            position: data.position || prev.position,
            interest: data.interest || prev.interest,
            contactInfo: data.contactInfo || prev.contactInfo,
          }));
          toast.success("Información extraída del PDF", { id: toastId });
        } else {
          toast.error("No se pudo analizar el PDF", { id: toastId });
        }
        setParsingPdf(false);
      };
      reader.onerror = () => {
        toast.error("Error al leer el archivo", { id: toastId });
        setParsingPdf(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("PDF Parsing error:", error);
      toast.error("Error al procesar el PDF", { id: toastId });
      setParsingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contactInfo) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const dateForFirstFollowUp = new Date(now);
      dateForFirstFollowUp.setDate(now.getDate() + 7);

      const newLead = {
        clientId,
        name: formData.name || 'Sin nombre',
        company: formData.company || 'Sin empresa',
        country: formData.country || 'No especificado',
        interest: formData.interest || 'No especificado',
        contactInfo: formData.contactInfo,
        sector: formData.sector || 'No especificado',
        position: formData.position || 'No especificado',
        tag: formData.tag || '',
        linkedinUrl: linkedinUrl || '',
        status: 'new' as LeadStatus,
        stage: formData.stage,
        assignedSetterId: auth.currentUser?.uid || 'demo-user',
        followUps: [],
        meetings: [],
        nextFollowUpDate: dateForFirstFollowUp.toISOString(),
        followUpSequence: 0,
        lastAction: 'Lead creado - Primer seguimiento programado en 7 días',
        isActive: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      if (isDemoMode) {
        // En modo demo, guardamos en localStorage para que aparezca en la lista
        const demoLeads = JSON.parse(localStorage.getItem('demo-leads') || JSON.stringify([]));
        const leadWithId = { ...newLead, id: Math.random().toString(36).substr(2, 9) };
        demoLeads.unshift(leadWithId);
        localStorage.setItem('demo-leads', JSON.stringify(demoLeads));
        window.dispatchEvent(new Event('demo-leads-updated'));
        
        console.log("Guardado en LocalStorage (Modo Demo):", leadWithId);
        await new Promise(resolve => setTimeout(resolve, 800)); // Simular latencia
      } else {
        await addDoc(collection(db, 'leads'), newLead);
      }
      
      toast.success("Lead creado correctamente" + (isDemoMode ? " (Simulado)" : ""));
      onOpenChange(false);
      setLinkedinUrl('');
      setFormData({
        name: '',
        company: '',
        country: '',
        interest: '',
        contactInfo: '',
        sector: '',
        position: '',
        tag: '',
        stage: 'setter',
      });
    } catch (error) {
      toast.error("Error al crear el lead");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Agregar Nuevo Lead</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4 border-b border-border/50 mb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="flex items-center gap-2 text-primary font-bold">
                <Linkedin size={16} />
                Auto-completar URL
              </Label>
              <div className="flex gap-2">
                <Input 
                  id="linkedin" 
                  value={linkedinUrl} 
                  onChange={(e) => setLinkedinUrl(e.target.value)} 
                  placeholder="https://www.linkedin.com/in/usuario/"
                  className="bg-muted border-border"
                />
                <Button 
                  type="button" 
                  onClick={handleScrape} 
                  disabled={scraping || !linkedinUrl}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 shrink-0"
                >
                  {scraping ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-primary font-bold">
                <FileText size={16} />
                Subir PDF Perfil
              </Label>
              <div className="relative">
                <Input 
                  type="file" 
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  disabled={parsingPdf}
                  className="bg-muted border-border cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {parsingPdf && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <Loader2 className="animate-spin text-primary" size={18} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic text-center">
            Usa la URL o sube el PDF del perfil para que la IA complete los datos automáticamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-medium">Nombre Completo *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                placeholder="Ej: Juan Pérez"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company" className="text-foreground font-medium">Empresa</Label>
              <Input 
                id="company" 
                value={formData.company} 
                onChange={(e) => setFormData({ ...formData, company: e.target.value })} 
                placeholder="Ej: Tech Solutions"
                className="bg-muted border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactInfo" className="text-foreground font-medium">Email o Teléfono *</Label>
              <Input 
                id="contactInfo" 
                value={formData.contactInfo} 
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, contactInfo: val });
                  // If user pastes a linkedin URL here, auto-fill the URL field above
                  if (val.includes('linkedin.com/in/') && !linkedinUrl) {
                    setLinkedinUrl(val);
                  }
                }} 
                placeholder="juan@ejemplo.com"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country" className="text-foreground font-medium">País</Label>
              <Input 
                id="country" 
                value={formData.country} 
                onChange={(e) => setFormData({ ...formData, country: e.target.value })} 
                placeholder="Ej: Argentina"
                className="bg-muted border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest" className="text-foreground font-medium">Interés / Necesidad</Label>
            <Input 
              id="interest" 
              value={formData.interest} 
              onChange={(e) => setFormData({ ...formData, interest: e.target.value })} 
              placeholder="Ej: Software de gestión"
              className="bg-muted border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage" className="text-foreground font-medium">¿Quién lo sigue?</Label>
              <Select 
                value={formData.stage} 
                onValueChange={(value: any) => setFormData({ ...formData, stage: value })}
              >
                <SelectTrigger id="stage" className="w-full h-10 bg-muted border-border">
                  <SelectValue placeholder="Seleccionar etapa" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="setter">
                    <div className="flex items-center gap-2">
                      <UserCheck size={14} className="text-blue-400" />
                      <span>Fase Setter</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="commercial">
                    <div className="flex items-center gap-2">
                      <UserCog size={14} className="text-purple-400" />
                      <span>Fase Comercial</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag" className="text-foreground font-medium">Tag / Origen</Label>
              {availableTags.length > 0 ? (
                <Select 
                  value={formData.tag} 
                  onValueChange={(value) => setFormData({ ...formData, tag: value })}
                >
                  <SelectTrigger id="tag" className="w-full h-10 bg-muted border-border">
                    <SelectValue placeholder="Seleccionar Tag" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {availableTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                    <SelectItem value="other">Otro / Manual...</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input 
                  id="tag" 
                  value={formData.tag} 
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })} 
                  placeholder="Ej: Perfil LinkedIn"
                  className="bg-muted border-border"
                />
              )}
              {formData.tag === 'other' && (
                <Input 
                  className="mt-2 bg-muted border-border"
                  value={formData.tag === 'other' ? '' : formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })} 
                  placeholder="Escribir tag manualmente..."
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sector" className="text-foreground font-medium">Sector</Label>
              <Input 
                id="sector" 
                value={formData.sector} 
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })} 
                placeholder="Ej: Tecnología"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position" className="text-foreground font-medium">Cargo / Puesto</Label>
              <Input 
                id="position" 
                value={formData.position} 
                onChange={(e) => setFormData({ ...formData, position: e.target.value })} 
                placeholder="Ej: CEO"
                className="bg-muted border-border"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border hover:bg-muted font-bold text-foreground">Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {loading ? "Guardando..." : "Guardar Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
