import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, ArrowLeft, Plus, Trash2, Search, Phone, Mail, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { contactsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

function ContactCard({ contact, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: contact.name, phone: contact.phone || "", email: contact.email || "" });

  const save = () => {
    onUpdate(contact.id, form);
    setEditing(false);
  };

  return (
    <div className="p-4 rounded-2xl bg-card border border-border/50">
      {editing ? (
        <div className="space-y-2">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded-xl h-9 text-sm" />
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-xl h-9 text-sm" />
          <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl h-9 text-sm" />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="flex-1 rounded-xl"><X className="w-3.5 h-3.5" /></Button>
            <Button size="sm" onClick={save} className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"><Check className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-accent">{contact.name?.[0]?.toUpperCase() || "?"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-sm">{contact.name}</p>
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mt-0.5">
                <Phone className="w-3 h-3" />{contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent mt-0.5">
                <Mail className="w-3 h-3" />{contact.email}
              </a>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-accent"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(contact.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Contacts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "" });


  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", uid],
    queryFn: () => contactsService.list(uid, { orderField: "name", dir: "asc" }),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: (data) => contactsService.create(uid, { ...data, updatedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", uid] });
      setShowNew(false);
      setNewForm({ name: "", phone: "", email: "" });
      toast.success("Contact saved");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => contactsService.update(uid, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts", uid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => contactsService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", uid] });
      toast.success("Contact deleted");
    },
  });

  const filtered = contacts.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-display font-bold">Contacts</h1>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}
          className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
          <Plus className="w-4 h-4" />New
        </Button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
          className="pl-10 bg-muted/50 border-0 rounded-xl" />
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-card border border-border mb-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold">New Contact</h3>
            <Input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="Full name" className="rounded-xl" autoFocus />
            <Input value={newForm.phone} onChange={e => setNewForm({ ...newForm, phone: e.target.value })} placeholder="Phone number" className="rounded-xl" />
            <Input value={newForm.email} onChange={e => setNewForm({ ...newForm, email: e.target.value })} placeholder="Email address" className="rounded-xl" />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate(newForm)} disabled={!newForm.name.trim()}
                className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold mb-1">No contacts yet</h3>
          <p className="text-sm text-muted-foreground">Contacts are extracted from recordings or added manually.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onDelete={(id) => deleteMutation.mutate(id)}
              onUpdate={(id, data) => updateMutation.mutate({ id, data })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
