import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DollarSign, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { expensesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { format } from "date-fns";

const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD"];

export default function Expenses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", currency: "GBP" });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", uid],
    queryFn: () => expensesService.list(uid),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: (data) => expensesService.create(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", uid] });
      setShowNew(false);
      setForm({ description: "", amount: "", currency: "GBP" });
      toast.success("Expense logged");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => expensesService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", uid] });
      toast.success("Expense deleted");
    },
  });

  const currencySymbols = { GBP: "£", USD: "$", EUR: "€", CAD: "CA$", AUD: "A$" };

  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalByCurrency = expenses.reduce((acc, e) => {
    const cur = e.currency || "GBP";
    acc[cur] = (acc[cur] || 0) + (e.amount || 0);
    return acc;
  }, {});

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-display font-bold">Expenses</h1>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}
          className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
          <Plus className="w-4 h-4" />Log
        </Button>
      </div>

      {/* Totals */}
      {Object.keys(totalByCurrency).length > 0 && (
        <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 mb-5">
          <p className="text-xs font-heading font-semibold text-accent uppercase tracking-wider mb-2">Total Spend</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(totalByCurrency).map(([cur, amt]) => (
              <div key={cur}>
                <span className="text-xl font-display font-bold">{currencySymbols[cur] || cur}{amt.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground ml-1">{cur}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Expense Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-card border border-border mb-5 space-y-3">
            <h3 className="text-sm font-heading font-semibold">New Expense</h3>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Description (e.g. Hotel, lunch, taxi)" className="rounded-xl" autoFocus />
            <div className="flex gap-2">
              <div className="flex rounded-xl overflow-hidden border border-border flex-1">
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                  className="bg-muted px-3 text-sm border-r border-border focus:outline-none">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <Input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00" type="number" step="0.01" min="0"
                  className="border-0 rounded-none flex-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm" disabled={!form.description.trim() || !form.amount}
                onClick={() => createMutation.mutate({ ...form, amount: parseFloat(form.amount) })}
                className="flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16">
          <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold mb-1">No expenses yet</h3>
          <p className="text-sm text-muted-foreground">Expenses are extracted from recordings or logged manually.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <motion.div key={exp.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{exp.description}</p>
                <p className="text-xs text-muted-foreground">
                  {exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "MMM d, yyyy") : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display font-bold text-sm">{currencySymbols[exp.currency] || exp.currency}{(exp.amount || 0).toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">{exp.currency}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(exp.id)} className="text-muted-foreground hover:text-destructive ml-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
