import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { LeadStatus, Client, Lead } from '../types';
import { scrapeLinkedInProfile, analyzeProfessionalText } from '../services/linkedinService';
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
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Linkedin, Sparkles, Loader2, UserCheck, UserCog, Calendar, FileText, Upload, AlertCircle } from 'lucide-react';

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDemoMode?: boolean;
  clientId: string;
  leads?: Lead[];
  onViewLead?: (lead: Lead) => void;
}

export default function LeadForm({ open, onOpenChange, isDemoMode, clientId, leads = [], onViewLead }: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [parsingText, setParsingText] = useState(false);
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

  const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
  const [showDuplicateComparison, setShowDuplicateComparison] = useState(false);

  // Check duplicate whenever relevant fields change
  useEffect(() => {
    if (!open || !clientId || leads.length === 0) {
      setDuplicateLead(null);
      return;
    }

    const cleanUrl = (url: string) => {
      if (!url) return '';
      return url.toLowerCase().trim()
        .replace(/https?:\/\/(www\.)?/, '')
        .replace(/\/$/, '')
        .split('?')[0];
    };

    const targetUrl = cleanUrl(linkedinUrl);
    const targetName = (formData.name || '').trim().toLowerCase();
    const targetCompany = (formData.company || '').trim().toLowerCase();

    if (!targetUrl && !targetName) {
      setDuplicateLead(null);
      return;
    }

    const match = leads.find(l => {
      if (l.clientId !== clientId) return false;
      
      // 1. URL match (highest confidence)
      if (targetUrl && l.linkedinUrl) {
        if (cleanUrl(l.linkedinUrl) === targetUrl) return true;
      }

      // 2. Name & Company match (medium confidence)
      if (targetName && l.name && targetCompany && l.company) {
        const lName = l.name.trim().toLowerCase();
        const lCompany = l.company.trim().toLowerCase();
        // Exact name and company match
        if (lName === targetName && lCompany === targetCompany) return true;
      }

      return false;
    });

    if (match) {
      setDuplicateLead(match);
    } else {
      setDuplicateLead(null);
      setShowDuplicateComparison(false);
    }
  }, [linkedinUrl, formData.name, formData.company, leads, clientId, open]);

  const handleMergeAndEnrich = async () => {
    if (!duplicateLead) return;
    setLoading(true);
    try {
      const updates: any = {};
      
      const cleanField = (formVal: string, existVal: string) => {
        if (formVal && formVal !== 'No especificado' && formVal !== 'Sin nombre' && formVal !== 'Sin empresa' && formVal !== existVal) {
          return formVal;
        }
        return undefined;
      };

      const updatedName = cleanField(formData.name, duplicateLead.name);
      if (updatedName) updates.name = updatedName;

      const updatedCompany = cleanField(formData.company, duplicateLead.company);
      if (updatedCompany) updates.company = updatedCompany;

      const updatedCountry = cleanField(formData.country, duplicateLead.country || '');
      if (updatedCountry) updates.country = updatedCountry;

      const updatedSector = cleanField(formData.sector, duplicateLead.sector || '');
      if (updatedSector) updates.sector = updatedSector;

      const updatedPosition = cleanField(formData.position, duplicateLead.position || '');
      if (updatedPosition) updates.position = updatedPosition;

      const updatedInterest = cleanField(formData.interest, duplicateLead.interest || '');
      if (updatedInterest) updates.interest = updatedInterest;

      const updatedContactInfo = cleanField(formData.contactInfo, duplicateLead.contactInfo || '');
      if (updatedContactInfo) updates.contactInfo = updatedContactInfo;

      const updatedTag = cleanField(formData.tag, duplicateLead.tag || '');
      if (updatedTag) updates.tag = updatedTag;

      if (linkedinUrl && linkedinUrl !== duplicateLead.linkedinUrl) {
        updates.linkedinUrl = linkedinUrl;
      }

      if (Object.keys(updates).length > 0) {
        const timestamp = new Date().toISOString();
        const mergedData = {
          ...updates,
          updatedAt: timestamp,
          lastAction: `Lead fusionado y enriquecido desde formulario (${Object.keys(updates).join(', ')})`
        };

        if (isDemoMode) {
          const stored = localStorage.getItem('demo-leads');
          if (stored) {
            const allLeads = JSON.parse(stored) as Lead[];
            const updated = allLeads.map(l => l.id === duplicateLead.id ? { ...l, ...mergedData } : l);
            localStorage.setItem('demo-leads', JSON.stringify(updated));
            window.dispatchEvent(new Event('demo-leads-updated'));
          }
        } else {
          await updateDoc(doc(db, 'leads', duplicateLead.id), mergedData);
        }
        toast.success("¡Lead fusionado y enriquecido con éxito!");
      } else {
        toast.info("No hay nuevos datos para fusionar.");
      }
      
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
      console.error(error);
      toast.error("Error al fusionar lead");
    } finally {
      setLoading(false);
    }
  };

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

  const handleAnalyzeText = async () => {
    if (!pastedText || !pastedText.trim()) {
      toast.error("Por favor pega algo de texto primero");
      return;
    }

    setParsingText(true);
    const toastId = toast.loading("Analizando texto con IA...");

    try {
      const data = await analyzeProfessionalText(pastedText);
      
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
        
        // Extract URL from pasted text if it's there
        if (!linkedinUrl) {
          const urlMatch = pastedText.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[^\s\"\'\<\>\,\;\(\)\#]+/i);
          if (urlMatch) {
            setLinkedinUrl(urlMatch[0]);
            toast.success("¡URL de LinkedIn extraída y datos auto-completados!", { id: toastId });
          } else {
            toast.success("Información extraída correctamente del texto", { id: toastId });
          }
        } else {
          toast.success("Información extraída correctamente del texto", { id: toastId });
        }
        
        setPastedText(''); // Clear the textarea
      } else {
        toast.error("No se pudo extraer información del texto", { id: toastId });
      }
    } catch (error) {
      console.error("Text parsing error:", error);
      toast.error("Error al procesar el texto", { id: toastId });
    } finally {
      setParsingText(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.contactInfo?.trim()) {
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
        
        <div className="space-y-4 py-3 border-b border-border/50 mb-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="linkedin" className="flex items-center gap-2 text-primary font-bold text-xs">
                <Linkedin size={14} />
                Auto-completar desde URL de LinkedIn
              </Label>
              <div className="flex gap-2">
                <Input 
                  id="linkedin" 
                  maxLength={300}
                  value={linkedinUrl} 
                  onChange={(e) => setLinkedinUrl(e.target.value)} 
                  placeholder="https://www.linkedin.com/in/usuario/"
                  className="bg-muted border-border h-9 text-xs"
                />
                <Button 
                  type="button" 
                  onClick={handleScrape} 
                  disabled={scraping || !linkedinUrl}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 shrink-0 h-9 px-3 text-xs"
                >
                  {scraping ? <Loader2 className="animate-spin" size={14} /> : <div className="flex items-center gap-1"><Sparkles size={14} /><span>Autollenar</span></div>}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pastedText" className="flex items-center gap-2 text-primary font-bold text-xs">
                <FileText size={14} />
                Pegar Perfil / CV Completo (Múltiples Líneas)
              </Label>
              <div className="flex gap-2 items-start">
                <div className="flex-grow">
                  <Textarea 
                    id="pastedText"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Pega todo el texto copiado de LinkedIn o CV aquí..."
                    className="bg-muted border-border min-h-[60px] max-h-[120px] text-xs py-1.5"
                    disabled={parsingText}
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={handleAnalyzeText} 
                  disabled={parsingText || !pastedText.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 shrink-0 h-9 px-3 text-xs self-end"
                >
                  {parsingText ? <Loader2 className="animate-spin" size={14} /> : <div className="flex items-center gap-1"><Sparkles size={14} /><span>Procesar</span></div>}
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic text-center">
            Pega el enlace de LinkedIn para autollenar, o copia todo el texto de su perfil (Ctrl+A y Ctrl+C en su perfil) y pégalo arriba para que la IA complete el formulario.
          </p>
        </div>

        {duplicateLead && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-500 space-y-3 mx-1 my-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-sm font-black tracking-tight">⚠️ Posible Lead Duplicado Detectado</span>
                  <button 
                    type="button"
                    onClick={() => setShowDuplicateComparison(!showDuplicateComparison)}
                    className="underline text-[10px] font-black uppercase text-amber-500 hover:text-amber-400"
                  >
                    {showDuplicateComparison ? 'Ocultar Detalle' : 'Ver Comparación'}
                  </button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed col-span-2">
                  Ya existe un contacto registrado como <strong className="text-foreground font-semibold">{duplicateLead.name}</strong> ({duplicateLead.company}) en la base de datos de este cliente.
                </p>
              </div>
            </div>

            {showDuplicateComparison && (
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-amber-500/10">
                <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="font-extrabold uppercase text-[9px] text-muted-foreground tracking-widest pb-1 border-b border-white/5">Existente en CRM</div>
                  <div className="space-y-1 text-muted-foreground text-[11px]">
                    <p><span className="font-semibold text-foreground">Nombre:</span> {duplicateLead.name}</p>
                    <p><span className="font-semibold text-foreground">Empresa:</span> {duplicateLead.company}</p>
                    <p><span className="font-semibold text-foreground">País:</span> {duplicateLead.country || '--'}</p>
                    <p><span className="font-semibold text-foreground">Puesto:</span> {duplicateLead.position || '--'}</p>
                    <p><span className="font-semibold text-foreground">Sector:</span> {duplicateLead.sector || '--'}</p>
                    <p><span className="font-semibold text-foreground">Contacto:</span> {duplicateLead.contactInfo || '--'}</p>
                  </div>
                </div>
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 space-y-2">
                  <div className="font-extrabold uppercase text-[9px] text-primary tracking-widest pb-1 border-b border-primary/10">Datos Nuevos</div>
                  <div className="space-y-1 text-muted-foreground text-[11px]">
                    <p><span className="font-semibold text-foreground">Nombre:</span> <span className={formData.name && formData.name !== duplicateLead.name ? "text-primary font-bold" : ""}>{formData.name || 'Sin nombre'}</span></p>
                    <p><span className="font-semibold text-foreground">Empresa:</span> <span className={formData.company && formData.company !== duplicateLead.company ? "text-primary font-bold" : ""}>{formData.company || 'Sin empresa'}</span></p>
                    <p><span className="font-semibold text-foreground">País:</span> <span className={formData.country && formData.country !== duplicateLead.country ? "text-primary font-bold" : ""}>{formData.country || 'No especificado'}</span></p>
                    <p><span className="font-semibold text-foreground">Puesto:</span> <span className={formData.position && formData.position !== duplicateLead.position ? "text-primary font-bold" : ""}>{formData.position || 'No especificado'}</span></p>
                    <p><span className="font-semibold text-foreground">Sector:</span> <span className={formData.sector && formData.sector !== duplicateLead.sector ? "text-primary font-bold" : ""}>{formData.sector || 'No especificado'}</span></p>
                    <p><span className="font-semibold text-foreground">Contacto:</span> <span className={formData.contactInfo && formData.contactInfo !== duplicateLead.contactInfo ? "text-primary font-bold" : ""}>{formData.contactInfo || 'No especificado'}</span></p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1 border-t border-amber-500/10">
              {onViewLead && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    onOpenChange(false);
                    onViewLead(duplicateLead);
                  }} 
                  className="h-8 text-[11px] font-bold px-3 hover:bg-muted border-amber-500/25 text-foreground"
                >
                  👁️ Ver Lead Existente
                </Button>
              )}
              <Button 
                type="button" 
                onClick={handleMergeAndEnrich} 
                className="h-8 text-[11px] font-bold px-3 bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/10"
              >
                🔄 Fusionar y Completar
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-medium">Nombre Completo *</Label>
              <Input 
                id="name" 
                maxLength={100}
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
                maxLength={100}
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
                maxLength={200}
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
                maxLength={60}
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
              maxLength={200}
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
