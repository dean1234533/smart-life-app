import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChefHat, ArrowLeft, Trash2, ChevronDown, ChevronRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { recipesService, shoppingListsService } from "@/lib/firestoreService";
import { useCurrentUid } from "@/hooks/useCurrentUid";

export default function Recipes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = useCurrentUid();
  const [expanded, setExpanded] = useState({});

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", uid],
    queryFn: () => recipesService.list(uid),
    enabled: !!uid,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => recipesService.delete(uid, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", uid] });
      toast.success("Recipe deleted");
    },
  });

  const addToShoppingList = async (recipe) => {
    if (!uid) return;
    await shoppingListsService.create(uid, {
      title: `Ingredients: ${recipe.title}`,
      items: (recipe.ingredients || []).map(ing => ({ name: ing, checked: false })),
      generatedFrom: recipe.id,
    });
    toast.success("Ingredients added to shopping list!");
    queryClient.invalidateQueries({ queryKey: ["shoppingLists", uid] });
  };

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-display font-bold">Recipes</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16">
          <ChefHat className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold mb-1">No recipes yet</h3>
          <p className="text-sm text-muted-foreground">Recipes are generated automatically from meal plan notes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => {
            const isOpen = expanded[recipe.id];
            return (
              <div key={recipe.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <button
                  onClick={() => setExpanded(e => ({ ...e, [recipe.id]: !e[recipe.id] }))}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                    <ChefHat className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-sm truncate">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(recipe.ingredients || []).length} ingredients
                      {recipe.mealPlanDays?.length ? ` · ${recipe.mealPlanDays.join(", ")}` : ""}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(recipe.id); }}
                    className="text-muted-foreground hover:text-destructive ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-4">
                        {recipe.ingredients?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ingredients</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {recipe.ingredients.map((ing, i) => (
                                <Badge key={i} variant="secondary" className="text-xs rounded-lg">{ing}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {recipe.instructions && (
                          <div>
                            <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Instructions</h4>
                            <p className="text-sm leading-relaxed text-muted-foreground">{recipe.instructions}</p>
                          </div>
                        )}
                        <Button size="sm" variant="outline"
                          onClick={() => addToShoppingList(recipe)}
                          className="w-full rounded-xl gap-1.5 border-accent/30 hover:bg-accent/5">
                          <ShoppingCart className="w-3.5 h-3.5 text-accent" />
                          Add ingredients to shopping list
                        </Button>
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
