"""Sector vocabulary only: all four industries share the same costing engine."""

SECTORS = {
    "restaurantes": {
        "plural": "Platos y recetas",
        "singular": "plato",
        "create": "Nuevo plato",
        "name": "Nombre del plato",
        "recipe": "Receta",
        "yield_label": "Porciones que rinde esta receta",
        "output_label": "porción",
        "example": "Registra el nombre y el rendimiento de tu propia receta.",
        "inputs": "Ingredientes e insumos",
    },
    "textil": {
        "plural": "Prendas y productos",
        "singular": "producto",
        "create": "Nuevo producto",
        "name": "Nombre de la prenda o producto",
        "recipe": "Ficha de materiales",
        "yield_label": "Unidades buenas que produce el lote",
        "output_label": "unidad",
        "example": "Ejemplo: Polo de algodón",
        "inputs": "Materiales y avíos",
    },
    "muebles": {
        "plural": "Muebles y productos",
        "singular": "producto",
        "create": "Nuevo producto",
        "name": "Nombre del mueble o producto",
        "recipe": "Ficha de materiales",
        "yield_label": "Unidades buenas que produce el lote",
        "output_label": "unidad",
        "example": "Ejemplo: Escritorio de madera",
        "inputs": "Materiales y componentes",
    },
    "imprenta": {
        "plural": "Impresos y productos",
        "singular": "producto",
        "create": "Nuevo producto",
        "name": "Nombre del impreso o producto",
        "recipe": "Ficha del tiraje",
        "yield_label": "Unidades buenas que produce el tiraje",
        "output_label": "unidad",
        "example": "Ejemplo: Volante A5",
        "inputs": "Materiales de impresión",
    },
}


def sector_terms(company):
    return SECTORS["restaurantes"]
