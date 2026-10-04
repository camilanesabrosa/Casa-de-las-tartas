"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProductCategories, getProductCategoryCodes, nextProductCategoryCode, type Business } from "@/lib/business";
import { Field, Form, Modal, type Save } from "./components";

type Screen = { type: "list" | "new" } | { type: "edit" | "delete"; name: string };

export function ProductCategories({ data, save, close }: { data: Business; save: Save; close: () => void }) {
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const names = getProductCategories(data);
  const codes = getProductCategoryCodes(data);
  const back = () => setScreen({ type: "list" });
  const selected = "name" in screen ? screen.name : "";
  const products = data.products.filter((product) => product.category === selected);
  const targets = names.filter((name) => name !== selected);
  const title = screen.type === "new" ? "Nueva categoría" : screen.type === "edit" ? "Editar categoría" : screen.type === "delete" ? "Eliminar categoría" : "Categorías de productos";

  return (
    <Modal title={title} description={screen.type === "list" ? "Creá, editá o eliminá las categorías de tus productos." : selected || "Elegí un nombre para agrupar tus productos."} close={close}>
      {screen.type === "list" ? (
        <>
          <div className="category-toolbar">
            <Button className="btn primary" onClick={() => setScreen({ type: "new" })}><Plus aria-hidden="true" />Nueva categoría</Button>
          </div>
          {names.length ? (
            <TooltipProvider delayDuration={250}>
              <ul className="category-list" aria-label="Categorías de productos">
                {names.map((name) => {
                  const count = data.products.filter((product) => product.category === name).length;
                  return (
                    <li key={name} className="category-row">
                      <span className="product-code">{codes[name]}</span>
                      <div className="category-details"><strong>{name}</strong><small>{count} {count === 1 ? "producto" : "productos"}</small></div>
                      <div className="row-actions product-actions">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="icon-button product-action-button" aria-label={`Editar categoría ${name}`} onClick={() => setScreen({ type: "edit", name })}><Pencil size={20} strokeWidth={1.5} aria-hidden="true" /></button>
                          </TooltipTrigger>
                          <TooltipContent className="product-action-tooltip" sideOffset={8}>Editar categoría</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="icon-button product-action-button category-delete-button" aria-label={`Eliminar categoría ${name}`} onClick={() => setScreen({ type: "delete", name })}><Trash2 size={20} strokeWidth={1.5} aria-hidden="true" /></button>
                          </TooltipTrigger>
                          <TooltipContent className="product-action-tooltip" sideOffset={8}>Eliminar categoría</TooltipContent>
                        </Tooltip>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </TooltipProvider>
          ) : <p className="muted">Todavía no hay categorías. Creá la primera para organizar tus productos.</p>}
          <div className="form-actions"><Button className="btn" onClick={close}>Cerrar</Button></div>
        </>
      ) : screen.type === "delete" ? (
        products.length && !targets.length ? (
          <>
            <p>Esta es la única categoría y tiene productos. Creá otra categoría antes de eliminarla, para poder moverlos sin perder datos.</p>
            <div className="form-actions"><Button className="btn" onClick={back}>Volver a categorías</Button><Button className="btn primary" onClick={() => setScreen({ type: "new" })}>Nueva categoría</Button></div>
          </>
        ) : (
          <Form key={`delete-${selected}`} close={back} label="Eliminar categoría" destructive submit={(form) => save({ type: "deleteProductCategory", name: selected, ...(products.length ? { targetCategory: String(form.get("targetCategory")) } : {}) })}>
            <p>{products.length ? `Los ${products.length} productos se moverán a la categoría que elijas. No se eliminará ningún producto ni se cambiarán sus precios o stock.` : "Esta categoría no tiene productos y se quitará del listado."}</p>
            {products.length ? (
              <>
                <label className="field"><span>Mover productos a</span>
                  <select className="field-input choice" name="targetCategory" defaultValue="" required>
                    <option value="" disabled>Elegí una categoría</option>
                    {targets.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <p className="muted">Los códigos usarán la letra de la categoría elegida. Si un número de cartel ya está ocupado, se asignará uno libre. Revisá los carteles después de moverlos.</p>
              </>
            ) : null}
            <p className="muted">Las ventas anteriores conservarán sus productos e importes.</p>
          </Form>
        )
      ) : (
        <Form key={`${screen.type}-${selected}`} close={back} label={screen.type === "new" ? "Crear categoría" : "Guardar cambios"} submit={(form) => save(screen.type === "new" ? { type: "productCategory", name: String(form.get("name")), code: String(form.get("code")) } : { type: "renameProductCategory", name: selected, newName: String(form.get("name")), code: String(form.get("code")) })}>
          <Field label="Nombre de la categoría" name="name" defaultValue={selected} />
          <label className="field">
            <span>Letra de la categoría</span>
            <Input className="field-input category-code-input" name="code" defaultValue={screen.type === "edit" ? codes[selected] : nextProductCategoryCode(codes)} required maxLength={3} pattern="[a-zA-Z]{1,3}" autoCapitalize="characters" aria-describedby="category-code-hint" />
            <small id="category-code-hint">Usá entre 1 y 3 letras, como A o AB. No puede estar usada en otra categoría.</small>
          </label>
          {screen.type === "edit" ? <p className="muted">Si cambiás la letra, los códigos de sus {products.length} productos usarán la nueva. Los números de cartel, precios, stock y ventas anteriores se conservan.</p> : null}
        </Form>
      )}
    </Modal>
  );
}
