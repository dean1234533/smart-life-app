import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, CheckCircle2, Circle, Clock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tasksService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

const priorityConfig = {
  low: { color: "text-muted-foreground", bg: "bg-muted" },
  medium: { color: "text-accent", bg: "bg-accent/10" },
  high: { color: "text-chart-1", bg: "bg-chart-1/10" },
  urgent: { color: "text-destructive", bg: "bg-destructive/10" },
};

export default function Tasks() {
  const uid = useCurrentUid();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", priority: "medium", due_date: "" });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", uid],
    queryFn: () => tasksService.list(uid),
    enabled: !!uid,
    initialData: [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => tasksService.create(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", uid] });
      setShowNew(false);
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) =>
      tasksService.update(uid, id, { status: status === "completed" ? "pending" : "completed" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", uid] }),
  });

  const filtered = tasks.filter((t) => filter === "all" ? true : t.status === filter);

  const filters = [
    { value: "pending", label: "To Do" },
    { value: "completed", label: "Done" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-display font-bold">Tasks</h1>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5">
              <Plus className="w-4 h-4" />New
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-heading">New Task</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="What needs to be done?" value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="rounded-xl" />
              <Textarea placeholder="Add details..." value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="rounded-xl resize-none" rows={3} />
              <div className="flex gap-3">
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger className="rounded-xl flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} className="rounded-xl flex-1" />
              </div>
              <Button onClick={() => createMutation.mutate({ ...newTask, status: "pending", source_type: "manual" })}
                disabled={!newTask.title.trim() || createMutation.isPending}
                className="w-full rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-5">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === f.value ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}>{f.label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold mb-1">
            {filter === "completed" ? "No completed tasks" : "No pending tasks"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filter === "completed" ? "Complete some tasks to see them here" : "You're all caught up!"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((task, i) => {
              const config = priorityConfig[task.priority || "medium"];
              return (
                <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                  <button onClick={() => toggleMutation.mutate({ id: task.id, status: task.status })} className="shrink-0">
                    {task.status === "completed"
                      ? <CheckCircle2 className="w-5 h-5 text-success" />
                      : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-[10px] px-1.5 py-0 ${config.bg} ${config.color} border-0`}>
                        {task.priority || "medium"}
                      </Badge>
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                      {task.source_type === "ai_suggested" && <Sparkles className="w-3 h-3 text-accent" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
