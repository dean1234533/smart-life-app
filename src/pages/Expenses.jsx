import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Minus,
  ChevronDown, Download, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { expensesService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";
import { format, getYear, getMonth } from "date-fns";

const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD"];
const CURRENCY_SYMBOLS = { GBP: "£", USD: "$", EUR: "€", CAD: "CA$", AUD: "A$" };

const EXPENSE_CATEGORIES = [
  "General", "Travel", "Meals & Entertainment", "Office & Admin",
  "Equipment & Hardware", "Software & Subscriptions", "Marketing",
  "Professional Services", "Utilities", "Rent", "Other",
];
const INCOME_CATEGORIES = [
  "Freelance / Contract", "Client Payment", "Invoice", "Salary",
  "Bonus", "Investment", "Refund", "Other",
];

// UK tax year: April 6 – April 5. Returns the starting year, e.g. 2025 for 2025/26.
function ukTaxYear(date) {
  const y = getYear(date);
  const m = getMonth(date); // 0-indexed
  const d = date.getDate();
  return (m > 3 || (m === 3 && d >= 6)) ? y : y - 1;
}

function formatAmt(currency, amount) {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${Math.abs(amount).toFixed(2)}`;
}

// Export transactions to CSV
function exportCSV(items) {
  const header = "Date,Type,Category,Description,Amount,Currency\n";
  const rows = items.map((e) => {
    const date = e.date || (e.createdAt?.toDate ? format(e.createdAt.toDate(), "yyyy-MM-dd") : "");
    return `${date},${e.type || "expense"},"${e.category || ""}","${e.description || ""}",${e.amount || 0},${e.currency || "GBP"}`;
  }).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "finances.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function Expenses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();

  const [tab, setTab] = useState("all"); // all | income | expenses
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("expense");
  const [form, setForm] = useState({
    description: "", amount: "", currency: "GBP",
    category: "General", date: format(new Date(), "yyyy-MM-dd"),
  });

  // UK tax year filter — default to current tax year
  const currentTaxYear = ukTaxYear(new Date());
  const [taxYear, setTaxYear] = useState(currentTaxYear);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["expenses", uid],
    queryFn: () => expensesService.list(uid),
    enabled: !!uid,
  });

  const createMutation = useMutation({
    mutationFn: (data) => expensesService.create(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", uid] });
      setShowForm(false);
      setForm({ description: "", amount: "", currency: "GBP", category: formType === "expense" ? "General" : "Freelance / Contract", date: format(new Date(), "yyyy-MM-dd") });
      toast.success(formType === "income" ? "Income logged" : "Expense logged");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => expensesService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", uid] });
    },
  });

  const openForm = (type) => {
    setFormType(type);
    setForm((f) => ({ ...f, category: type === "expense" ? "General" : "Freelance / Contract" }));
    setShowForm(true);
  };

  // Filter by selected tax year
  const yearItems = useMemo(() => allItems.filter((e) => {
    const rawDate = e.date ? new Date(e.date) : e.createdAt?.toDate?.();
    if (!rawDate) return taxYear === currentTaxYear;
    return ukTaxYear(rawDate) === taxYear;
  }), [allItems, taxYear, currentTaxYear]);

  // Further filter by tab
  const displayed = useMemo(() => {
    if (tab === "income") return yearItems.filter((e) => e.type === "income");
    if (tab === "expenses") return yearItems.filter((e) => e.type !== "income");
    return yearItems;
  }, [yearItems, tab]);

  // Totals per currency for income and expenses in this tax year
  const { incomeByCur, expensesByCur } = useMemo(() => {
    const incomeByCur = {};
    const expensesByCur = {};
    yearItems.forEach((e) => {
      const cur = e.currency || "GBP";
      if (e.type === "income") incomeByCur[cur] = (incomeByCur[cur] || 0) + (e.amount || 0);
      else expensesByCur[cur] = (expensesByCur[cur] || 0) + (e.amount || 0);
    });
    return { incomeByCur, expensesByCur };
  }, [yearItems]);

  // Net per currency
  const netByCur = useMemo(() => {
    const all = new Set([...Object.keys(incomeByCur), ...Object.keys(expensesByCur)]);
    const net = {};
    all.forEach((c) => { net[c] = (incomeByCur[c] || 0) - (expensesByCur[c] || 0); });
    return net;
  }, [incomeByCur, expensesByCur]);

  // Available tax years from data
  const taxYears = useMemo(() => {
    const years = new Set([currentTaxYear]);
    allItems.forEach((e) => {
      const rawDate = e.date ? new Date(e.date) : e.createdAt?.toDate?.();
      if (rawDate) years.add(ukTaxYear(rawDate));
    });
    return [...years].sort((a, b) => b - a);
  }, [allItems, currentTaxYear]);

  const categories = formType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-display font-bold">Finances</h1>
        </div>
        <div className="flex gap-2">
          {yearItems.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => exportCSV(yearItems)}
              className="rounded-xl border-border gap-1.5 text-muted-foreground hover:text-foreground">
              <Download className="w-3.5 h-3.5" />CSV
            </Button>
          )}
          <div className="flex gap-1">
            <Button size="sm" onClick={() => openForm("expense")}
              className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white gap-1">
              <Plus className="w-3.5 h-3.5" />Expense
            </Button>
            <Button size="sm" onClick={() => openForm("income")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
              <Plus className="w-3.5 h-3.5" />Income
            </Button>
          </div>
        </div>
      </div>

      {/* Tax year selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Tax year:</span>
        <div className="relative">
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="appearance-none bg-card border border-border rounded-xl pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            {taxYears.map((y) => (
              <option key={y} value={y}>{y}/{String(y + 1).slice(2)} (UK)</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Summary cards */}
      {yearItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {/* Income */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-heading font-semibold text-emerald-400 uppercase tracking-wider">Income</span>
            </div>
            {Object.entries(incomeByCur).length === 0 ? (
              <p className="text-sm font-display font-bold text-muted-foreground">—</p>
            ) : Object.entries(incomeByCur).map(([cur, amt]) => (
              <p key={cur} className="text-sm font-display font-bold text-emerald-400">{formatAmt(cur, amt)}</p>
            ))}
          </div>

          {/* Expenses */}
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] font-heading font-semibold text-rose-400 uppercase tracking-wider">Expenses</span>
            </div>
            {Object.entries(expensesByCur).length === 0 ? (
              <p className="text-sm font-display font-bold text-muted-foreground">—</p>
            ) : Object.entries(expensesByCur).map(([cur, amt]) => (
              <p key={cur} className="text-sm font-display font-bold text-rose-400">{formatAmt(cur, amt)}</p>
            ))}
          </div>

          {/* Net */}
          <div className="p-3 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-1 mb-1">
              <Minus className="w-3 h-3 text-accent" />
              <span className="text-[10px] font-heading font-semibold text-accent uppercase tracking-wider">Net</span>
            </div>
            {Object.entries(netByCur).length === 0 ? (
              <p className="text-sm font-display font-bold text-muted-foreground">—</p>
            ) : Object.entries(netByCur).map(([cur, amt]) => (
              <p key={cur} className={`text-sm font-display font-bold ${amt >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {amt >= 0 ? "" : "-"}{formatAmt(cur, amt)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tab filter */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/50 mb-4">
        {[["all", "All"], ["income", "Income"], ["expenses", "Expenses"]].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${tab === val ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl bg-card border mb-5 space-y-3 ${formType === "income" ? "border-emerald-500/30" : "border-rose-500/30"}`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-heading font-semibold ${formType === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                {formType === "income" ? "Log Income" : "Log Expense"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={formType === "income" ? "Description (e.g. Client invoice, project fee)" : "Description (e.g. Hotel, lunch, software)"}
              className="rounded-xl" autoFocus />

            <div className="flex gap-2">
              <div className="flex rounded-xl overflow-hidden border border-border flex-1">
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="bg-muted px-3 text-sm border-r border-border focus:outline-none">
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00" type="number" step="0.01" min="0"
                  className="border-0 rounded-none flex-1" />
              </div>
            </div>

            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>

            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="rounded-xl" />

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button size="sm"
                disabled={!form.description.trim() || !form.amount || createMutation.isPending}
                onClick={() => createMutation.mutate({ ...form, amount: parseFloat(form.amount), type: formType })}
                className={`flex-1 rounded-xl text-white ${formType === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-500 hover:bg-rose-600"}`}>
                Save
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            {tab === "income" ? <TrendingUp className="w-6 h-6 text-muted-foreground" /> : <TrendingDown className="w-6 h-6 text-muted-foreground" />}
          </div>
          <h3 className="font-heading font-semibold mb-1">Nothing here yet</h3>
          <p className="text-sm text-muted-foreground">
            {tab === "income" ? "Log your first income entry above." : "Log an expense or let recordings extract them automatically."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((item) => {
            const isIncome = item.type === "income";
            const rawDate = item.date ? new Date(item.date) : item.createdAt?.toDate?.();
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                  {isIncome
                    ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                    : <TrendingDown className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.category && <span className="mr-1.5">{item.category}</span>}
                    {rawDate ? format(rawDate, "MMM d, yyyy") : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-display font-bold text-sm ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                    {isIncome ? "+" : "-"}{formatAmt(item.currency || "GBP", item.amount || 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{item.currency || "GBP"}</p>
                </div>
                <button onClick={() => deleteMutation.mutate(item.id)}
                  className="text-muted-foreground hover:text-destructive ml-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
