import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Trash2, ArrowLeft, CheckSquare, Square, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { shoppingListsService } from "@/lib/firestoreService";
import { useCurrentUid } from \"@/hooks/useCurrentUid\";
import { format } from "date-fns";

export default function ShoppingLists() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [expanded, setExpanded] = useState({});
  const [newItem, setNewItem] = useState("");
  const [addingToList, setAddingToList] = useState(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["shoppingLists", uid],
    queryFn: () => shoppingListsService.list(uid),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: (data) => shoppingListsService.create(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists", uid] });
      setShowNewList(false);
      setNewListTitle("");
      toast.success("List created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => shoppingListsService.update(uid, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shoppingLists", uid] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => shoppingListsService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingLists", uid] });
      toast.success("List deleted");
    },
  });

  const toggleItem = (list, itemIdx) => {
    const updated = list.items.map((item, i) =>
      i === itemIdx ? { ...item, checked: !item.checked } : item
    );
    updateMutation.mutate({ id: list.id, data: { items: updated } });
  };

  const addItem = (list) => {
    if (!newItem.trim()) return;
    const updated = [...(list.items || []), { name: newItem.trim(), checked: false }];
    updateMutation.mutate({ id: list.id, data: { items: updated } });
    setNewItem("");
    setAddingToList(null);
  };

  const removeItem = (list, itemIdx) => {
    const updated = list.items.filter((_, i) => i !== itemIdx);
    updateMutation.mutate({ id: list.id, data: { items: updated } });
  };

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-display font-bold">Shopping Lists</h1>
        </div>
        <Button size="sm" onClick={() => setShowNewList(true)}
          className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
          <Plus className="w-4 h-4" />New
        </Button>
      </div>

      {/* New List Form */}
      <AnimatePresence>
        {showNewList && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-card border border-border mb-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold">New Shopping List</h3>
            <Input value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)}
              placeholder="List name..." className="rounded-xl" autoFocus
              onKeyDown={(e) => e.key === "Enter" && createMutation.mutate({ title: newListTitle || "Shopping List", items: [] })} />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNewList(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" onClick={() => createMutation.mutate({ title: newListTitle || "Shopping List", items: [] })}
                className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Create</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold mb-1">No shopping lists yet</h3>
          <p className="text-sm text-muted-foreground">Lists are created automatically from your notes, or manually here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => {
            const checked = (list.items || []).filter(i => i.checked).length;
            const total = (list.items || []).length;
            const isOpen = expanded[list.id];
            return (
              <div key={list.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <button
                  onClick={() => setExpanded(e => ({ ...e, [list.id]: !e[list.id] }))}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <ShoppingCart className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm truncate">{list.title || "Shopping List"}</p>
                    <p className="text-xs text-muted-foreground">{checked}/{total} items · {list.createdAt?.toDate ? format(list.createdAt.toDate(), "MMM d") : ""}</p>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(list.id); }}
                    className="text-muted-foreground hover:text-destructive ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-1 border-t border-border/40 pt-3">
                        {(list.items || []).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 py-1.5">
                            <button onClick={() => toggleItem(list, idx)}>
                              {item.checked
                                ? <CheckSquare className="w-4 h-4 text-accent" />
                                : <Square className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                              {item.name}
                            </span>
                            <button onClick={() => removeItem(list, idx)} className="text-muted-foreground/50 hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        {addingToList === list.id ? (
                          <div className="flex gap-2 mt-2">
                            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)}
                              placeholder="Add item..." className="rounded-xl h-9 text-sm flex-1" autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") addItem(list); if (e.key === "Escape") setAddingToList(null); }} />
                            <Button size="sm" onClick={() => addItem(list)} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">Add</Button>
                          </div>
                        ) : (
                          <button onClick={() => setAddingToList(list.id)}
                            className="flex items-center gap-1.5 text-xs text-accent mt-2 hover:text-accent/80">
                            <Plus className="w-3.5 h-3.5" />Add item
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
