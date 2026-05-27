import React, { useState } from 'react';
import { Client, PitchTemplate } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { 
  FileText, Plus, Search, Copy, Check, Edit, Trash2, 
  Sparkles, FileCode, CheckCircle, Info, RefreshCw, X
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ClientTemplatesProps {
  client: Client;
  isDemoMode?: boolean;
}

const CATEGORY_LABELS: Record<PitchTemplate['category'], { label: string; color: string; icon: string }> = {
  pitch: { label: '🚀 Primer Contacto / Pitch', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', icon: '🚀' },
  followup: { label: '🔄 Seguimiento', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: '🔄' },
  objection: { label: '🛑 Manejo de Objeción', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: '🛑' },
  other: { label: '📝 Nota Rápida / Otro', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: '📝' },
};

const DEMO_PRESETS: Omit<PitchTemplate, 'id'>[] = [
  {
    title: 'Pitch Inicial de Prospección',
    category: 'pitch',
    content: 'Hola [Nombre]! Vi tu perfil liderando en [Sector] y me llamó mucho la atención tu enfoque. Quería hacerte una pregunta muy directa: ¿están aceptando nuevos clientes en [Empresa] actualmente o se encuentran al límite de su capacidad? Un saludo!'
  },
  {
    title: 'Seguimiento Corto (Día +3)',
    category: 'followup',
    content: 'Hola [Nombre]! Sé que andas a mil, pero quería dejarte este breve recordatorio para que no se pierda. ¿Lograste pegarle un ojo a mi mensaje de arriba? ¡Que tengas un excelente día!'
  },
  {
    title: 'Seguimiento de Valor (Día +7)',
    category: 'followup',
    content: 'Hola [Nombre], ¿cómo va todo? Quería compartirte un caso de estudio rápido sobre cómo ayudamos a una empresa similar en el sector [Sector] a automatizar un 35% de su calificación comercial sin perder calidez en el trato. Me pareció sumamente aplicable a tu estructura en [Empresa]. ¿Te gustaría que te comparta el enlace corto?'
  },
  {
    title: 'Objeción: "No tengo presupuesto"',
    category: 'objection',
    content: 'Entiendo perfectamente, [Nombre]. En momentos de cuidado de caja la cautela es clave. Te propongo lo siguiente: coordinemos una videollamada auditiva muy breve (10 mins) sin ningún tipo de compromiso comercial. Te muestro de dónde estamos captando el tráfico y evaluamos de frente si es viable duplicar el retorno o no. De lo contrario, queda el contacto para el futuro. ¿Hará sentido vernos brevemente esta semana?'
  },
  {
    title: 'Recordatorio / Confirmación de Reunión',
    category: 'other',
    content: 'Hola [Nombre]! Todo en orden para nuestro encuentro de mañana a las [Hora]. Nos conectamos directamente mediante este enlace: [Link]. Por favor anticípame si surge algún imprevisto. ¡Nos vemos en sala!'
  }
];

export default function ClientTemplates({ client, isDemoMode = false }: ClientTemplatesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Create / Edit modal or inline form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PitchTemplate | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<PitchTemplate['category']>('pitch');
  const [formContent, setFormContent] = useState('');

  const templates = client.pitchTemplates || [];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('¡Copiado al portapapeles!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveTemplatesToDb = async (newTemplates: PitchTemplate[]) => {
    try {
      if (isDemoMode) {
        const stored = localStorage.getItem('demo-clients');
        if (stored) {
          const allClients: Client[] = JSON.parse(stored);
          const updated = allClients.map(c => c.id === client.id ? { ...c, pitchTemplates: newTemplates } : c);
          localStorage.setItem('demo-clients', JSON.stringify(updated));
          // Dispatch event to sync state reactively in App
          window.dispatchEvent(new CustomEvent('demo-clients-updated'));
        }
      } else {
        await updateDoc(doc(db, 'clients', client.id), {
          pitchTemplates: newTemplates
        });
      }
      toast.success('Plantillas guardadas con éxito');
    } catch (err) {
      console.error('Error al guardar plantillas:', err);
      toast.error('Ocurrió un error al guardar los cambios');
    }
  };

  const handleLoadPresets = async () => {
    const formattedPresets: PitchTemplate[] = DEMO_PRESETS.map((preset, idx) => ({
      ...preset,
      id: `preset-${Date.now()}-${idx}`
    }));
    await saveTemplatesToDb([...templates, ...formattedPresets]);
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormCategory('pitch');
    setFormContent('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (template: PitchTemplate) => {
    setEditingTemplate(template);
    setFormTitle(template.title);
    setFormCategory(template.category);
    setFormContent(template.content);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error('El título y contenido no pueden estar vacíos');
      return;
    }

    let updatedList: PitchTemplate[];

    if (editingTemplate) {
      // Edit mode
      updatedList = templates.map(t => t.id === editingTemplate.id ? {
        ...t,
        title: formTitle.trim(),
        category: formCategory,
        content: formContent.trim()
      } : t);
    } else {
      // Create mode
      const newTemplate: PitchTemplate = {
        id: `template-${Date.now()}`,
        title: formTitle.trim(),
        category: formCategory,
        content: formContent.trim()
      };
      updatedList = [...templates, newTemplate];
    }

    await saveTemplatesToDb(updatedList);
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) return;
    const updated = templates.filter(t => t.id !== id);
    await saveTemplatesToDb(updated);
  };

  const filtered = templates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/60 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2">
            <Sparkles size={18} className="text-primary animate-pulse" />
            Plantillas de Prospección / Pitches
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Crea y gestiona tus propios mensajes rápidos, pitches de contacto, secuencias de seguimiento y tratamiento de objeciones para este cliente.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {templates.length === 0 && (
            <Button 
              variant="outline" 
              onClick={handleLoadPresets}
              className="gap-2 text-xs font-bold h-9"
            >
              <RefreshCw size={14} />
              Cargar Ejemplos
            </Button>
          )}
          <Button 
            onClick={handleOpenCreate}
            className="gap-2 text-xs font-black uppercase tracking-wider h-9 bg-primary"
          >
            <Plus size={14} />
            Crear Plantilla
          </Button>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-card/75 backdrop-blur-sm border border-border rounded-2xl p-5 shadow-inner mt-2 space-y-4 animate-fade-in">
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <h3 className="text-xs font-black uppercase text-foreground">
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla Personalizada'}
            </h3>
            <button 
              onClick={() => setIsFormOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Título identificador</Label>
                <Input 
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ej: Seguimiento Día +3 Corto"
                  className="h-9 text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Categoría</Label>
                <select 
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as PitchTemplate['category'])}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs font-bold text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="pitch">🚀 Primer Contacto / Pitch</option>
                  <option value="followup">🔄 Seguimiento</option>
                  <option value="objection">🛑 Manejo de Objeción</option>
                  <option value="other">📝 Nota Rápida / Otro</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Mensaje / Contenido</Label>
                <span className="text-[9px] font-medium text-muted-foreground">
                  Pro-tip: Usa tags de marcador entre corchetes como <code className="bg-muted px-1 rounded text-primary font-bold">[Nombre]</code> o <code className="bg-muted px-1 rounded text-primary font-bold">[Empresa]</code>
                </span>
              </div>
              <textarea 
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                placeholder="Escribe el cuerpo del mensaje..."
                rows={4}
                className="w-full rounded-md border border-border bg-background p-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsFormOpen(false)}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="text-xs font-bold h-8 px-5"
              >
                {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden flex flex-col space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar plantilla por título o contenido..."
              className="pl-9 h-9 text-xs bg-card"
            />
          </div>
          <div className="flex flex-wrap gap-1 bg-card p-1 rounded-lg border border-border/50">
            <button 
              onClick={() => setActiveCategory('all')} 
              className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${activeCategory === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Todos
            </button>
            {Object.entries(CATEGORY_LABELS).map(([cat, info]) => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)} 
                className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {info.icon} {info.label.split(' / ')[0].replace(/🚀 |🔄 |🛑 |📝 /, '')}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-card rounded-2xl border border-dashed border-border py-16">
              <FileCode size={40} className="text-muted-foreground/40 mb-3 animate-pulse" />
              <h3 className="text-sm font-bold text-foreground">No se encontraron plantillas</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                {searchTerm || activeCategory !== 'all' 
                  ? 'Prueba modificando tus filtros o criterio de búsqueda para encontrar los templates.'
                  : 'Aún no hay plantillas configuradas para este cliente. ¡Comienza cargando los ejemplos guiados en un solo clic!'}
              </p>
              {templates.length === 0 && (
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleLoadPresets} variant="outline" className="text-xs gap-1.5 h-8">
                    <RefreshCw size={12} /> Cargar Ejemplos
                  </Button>
                  <Button onClick={handleOpenCreate} className="text-xs gap-1.5 h-8">
                    <Plus size={12} /> Crear Plantilla
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(t => {
                const info = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.other;
                return (
                  <div 
                    key={t.id}
                    className="group bg-card hover:bg-card/90 border border-border/80 hover:border-border/100 rounded-xl p-4 flex flex-col justify-between shadow-sm transition-all hover:shadow duration-200"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[9px] font-bold tracking-widest uppercase border px-2 py-0.5 rounded-full ${info.color}`}>
                          {info.label}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenEdit(t)}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                            title="Editar"
                          >
                            <Edit size={12} />
                          </button>
                          <button 
                            onClick={() => handleDelete(t.id)}
                            className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      
                      <h4 className="text-xs font-bold text-foreground truncate select-none">
                        {t.title}
                      </h4>
                      
                      <p className="text-xs text-muted-foreground/95 bg-muted/40 p-3 rounded-lg border border-border/40 font-medium whitespace-pre-wrap leading-relaxed min-h-[60px] max-h-[140px] overflow-y-auto">
                        {t.content}
                      </p>
                    </div>

                    <div className="flex justify-end pt-3 mt-2 border-t border-border/30">
                      <Button 
                        onClick={() => handleCopy(t.id, t.content)}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-bold text-primary hover:text-primary-foreground hover:bg-primary gap-1 px-2.5"
                      >
                        {copiedId === t.id ? (
                          <>
                            <Check size={12} className="text-emerald-500" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copiar Mensaje</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
