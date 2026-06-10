import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, StickyNote, Tag, Users, Sparkles, Pin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { notesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

const intentColors = {
  shopping: "bg-success/10 text-success border-success/20",
  meeting: "bg-accent/10 text-accent border-accent/20",
  task: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  reminder: "bg-chart-5/10 text-chart-5 border-chart-5/20",
  decision: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  promise: "bg-destructive/10 text-destructive border-destructive/20",
  general: "bg-muted text-muted-foreground border-border",
};

export default function Notes() {
  const uid = useCurrentUid();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", uid],
    queryFn: () => notesService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const filtered = notes.filter((note) => {
    const q = search.toLowerCase();
    return (
      !q ||
      note.title?.toLowerCase().includes(q) ||
      note.content?.toLowerCase().includes(q) ||
      note.tags?.some((t) => t.toLowerCase().includes(q)) ||
      note.ai_summary?.toLowerCase().includes(q)
    );
  });

  const pinned = filtered.filter((n) => n.is_pinned);
  const unpinned = filtered.filter((n) => !n.is_pinned);

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold">Notes</h1>
        <Button onClick={() => navigate("/notes/new")} size="sm"
          className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
          <Plus className="w-4 h-4" />New
        </Button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search notes, tags, people..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted/50 border-0 rounded-xl" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <StickyNote className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold mb-1">No notes yet</h3>
          <p className="text-sm text-muted-foreground">Create your first note and let AI organize it</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Pin className="w-3 h-3 text-accent" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pinned</span>
              </div>
              {pinned.map((note, i) => <NoteCard key={note.id} note={note} index={i} />)}
            </div>
          )}
          <AnimatePresence>
            {unpinned.map((note, i) => <NoteCard key={note.id} note={note} index={i} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, index }) {
  const createdAt = note.createdAt?.toDate?.() || (note.created_date ? new Date(note.created_date) : null);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <Link to={`/notes/${note.id}`}
        className="block p-4 rounded-2xl bg-card border border-border/50 hover:border-accent/30 transition-all">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-heading font-semibold text-sm truncate flex-1 min-w-0">{note.title || "Untitled Note"}</h3>
          {note.detected_intent && note.detected_intent !== "general" && (
            <Badge variant="outline" className={`text-[10px] ml-2 shrink-0 ${intentColors[note.detected_intent]}`}>
              {note.detected_intent}
            </Badge>
          )}
        </div>

        {note.ai_summary && (
          <div className="flex items-start gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-accent mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground line-clamp-2">{note.ai_summary}</p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {note.tags?.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              <Tag className="w-2.5 h-2.5 mr-0.5" />{tag}
            </Badge>
          ))}
          {note.related_people?.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              <Users className="w-2.5 h-2.5 mr-0.5" />{note.related_people.length}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {createdAt ? format(createdAt, "MMM d") : ""}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
