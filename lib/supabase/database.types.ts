
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "budget_archives": {
                  Row: {
                    "archived": boolean,"budget_id": number,"restaurant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"budget_id": number,"restaurant_id": string
                  }
                  Update: {
                    "archived"?: boolean,"budget_id"?: number,"restaurant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budget_archives_restaurant_id_budget_id_fkey"
      columns: ["restaurant_id","budget_id"]
isOneToOne: false
      referencedRelation: "budgets"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "budget_archives_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"budgets": {
                  Row: {
                    "author_id": string,"created_at": string,"fingerprint": string,"id": number,"number": number,"plan_id": number,"restaurant_id": string,"snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"created_at"?: string,"fingerprint": string,"id"?: never,"number": number,"plan_id": number,"restaurant_id": string,"snapshot": NonNullable<Json>
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"fingerprint"?: string,"id"?: never,"number"?: number,"plan_id"?: number,"restaurant_id"?: string,"snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "budgets_restaurant_id_plan_id_fkey"
      columns: ["restaurant_id","plan_id"]
isOneToOne: false
      referencedRelation: "production_plans"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"catalogo_areas_personal": {
                  Row: {
                    "clasificacion_costo": string,"codigo_area": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clasificacion_costo": string,"codigo_area": string,"nombre": string
                  }
                  Update: {
                    "clasificacion_costo"?: string,"codigo_area"?: string,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalogo_beneficios_personal": {
                  Row: {
                    "accidente_adicional_mes": number,"alimentacion_condicion_mes": number,"bolsa_viveres_mes": number,"bono_remunerativo_mes": number,"canasta_navidad_anual": number,"codigo_contrato": string,"eps_empresa_mes": number,"escolaridad_por_hijo_anual": number,"examenes_capacitacion_anual": number,"horas_extra_25_mes": number,"horas_extra_35_mes": number,"movilidad_condicion_mes": number,"observaciones": string,"reemplazo_vacaciones_anual": number,"sctr_pension_mes_estimada": number,"sctr_salud_mes_estimada": number,"uniformes_epp_anual": number,"utilidades_anual": number,"vida_ley_mes_estimada": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accidente_adicional_mes": number,"alimentacion_condicion_mes": number,"bolsa_viveres_mes": number,"bono_remunerativo_mes": number,"canasta_navidad_anual": number,"codigo_contrato": string,"eps_empresa_mes": number,"escolaridad_por_hijo_anual": number,"examenes_capacitacion_anual": number,"horas_extra_25_mes": number,"horas_extra_35_mes": number,"movilidad_condicion_mes": number,"observaciones": string,"reemplazo_vacaciones_anual": number,"sctr_pension_mes_estimada": number,"sctr_salud_mes_estimada": number,"uniformes_epp_anual": number,"utilidades_anual": number,"vida_ley_mes_estimada": number
                  }
                  Update: {
                    "accidente_adicional_mes"?: number,"alimentacion_condicion_mes"?: number,"bolsa_viveres_mes"?: number,"bono_remunerativo_mes"?: number,"canasta_navidad_anual"?: number,"codigo_contrato"?: string,"eps_empresa_mes"?: number,"escolaridad_por_hijo_anual"?: number,"examenes_capacitacion_anual"?: number,"horas_extra_25_mes"?: number,"horas_extra_35_mes"?: number,"movilidad_condicion_mes"?: number,"observaciones"?: string,"reemplazo_vacaciones_anual"?: number,"sctr_pension_mes_estimada"?: number,"sctr_salud_mes_estimada"?: number,"uniformes_epp_anual"?: number,"utilidades_anual"?: number,"vida_ley_mes_estimada"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_beneficios_personal_codigo_contrato_fkey"
      columns: ["codigo_contrato"]
isOneToOne: true
      referencedRelation: "catalogo_contratos_personal"
      referencedColumns: ["codigo_contrato"]
    }
                  ]
                },"catalogo_calendario_laboral": {
                  Row: {
                    "anio": number,"descripcion": string,"dia_iso": number,"es_feriado": boolean,"fecha": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anio": number,"descripcion": string,"dia_iso": number,"es_feriado": boolean,"fecha": string
                  }
                  Update: {
                    "anio"?: number,"descripcion"?: string,"dia_iso"?: number,"es_feriado"?: boolean,"fecha"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalogo_categorias": {
                  Row: {
                    "id_categoria": number,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id_categoria": number,"nombre": string
                  }
                  Update: {
                    "id_categoria"?: number,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalogo_contratos_personal": {
                  Row: {
                    "activo": boolean,"codigo_contrato": string,"codigo_trabajador": string,"dias_semana": number,"estado_planilla": string,"factor_productivo": number,"fecha_inicio": string,"horas_dia": number,"horas_servicio_mes": number,"id_escenario": number,"modalidad": string,"observaciones": string,"pension": string,"salud": string,"tarifa": number,"tiene_suspension_cuarta": boolean,"tipo_pago": string,"trabaja_feriados": boolean,"vinculo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"codigo_contrato": string,"codigo_trabajador": string,"dias_semana": number,"estado_planilla": string,"factor_productivo": number,"fecha_inicio": string,"horas_dia": number,"horas_servicio_mes": number,"id_escenario": number,"modalidad": string,"observaciones": string,"pension": string,"salud": string,"tarifa": number,"tiene_suspension_cuarta"?: boolean,"tipo_pago": string,"trabaja_feriados": boolean,"vinculo": string
                  }
                  Update: {
                    "activo"?: boolean,"codigo_contrato"?: string,"codigo_trabajador"?: string,"dias_semana"?: number,"estado_planilla"?: string,"factor_productivo"?: number,"fecha_inicio"?: string,"horas_dia"?: number,"horas_servicio_mes"?: number,"id_escenario"?: number,"modalidad"?: string,"observaciones"?: string,"pension"?: string,"salud"?: string,"tarifa"?: number,"tiene_suspension_cuarta"?: boolean,"tipo_pago"?: string,"trabaja_feriados"?: boolean,"vinculo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_contratos_personal_codigo_trabajador_fkey"
      columns: ["codigo_trabajador"]
isOneToOne: false
      referencedRelation: "catalogo_trabajadores"
      referencedColumns: ["codigo_trabajador"]
    },{
      foreignKeyName: "catalogo_contratos_personal_id_escenario_fkey"
      columns: ["id_escenario"]
isOneToOne: false
      referencedRelation: "catalogo_parametros_laborales"
      referencedColumns: ["id_escenario"]
    }
                  ]
                },"catalogo_hijos_personal": {
                  Row: {
                    "acreditado": boolean,"codigo_hijo": string,"codigo_trabajador": string,"cursa_superiores": boolean,"edad_al_corte": number,"escolaridad_simulada": boolean,"observacion": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acreditado": boolean,"codigo_hijo": string,"codigo_trabajador": string,"cursa_superiores": boolean,"edad_al_corte": number,"escolaridad_simulada": boolean,"observacion": string
                  }
                  Update: {
                    "acreditado"?: boolean,"codigo_hijo"?: string,"codigo_trabajador"?: string,"cursa_superiores"?: boolean,"edad_al_corte"?: number,"escolaridad_simulada"?: boolean,"observacion"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_hijos_personal_codigo_trabajador_fkey"
      columns: ["codigo_trabajador"]
isOneToOne: false
      referencedRelation: "catalogo_trabajadores"
      referencedColumns: ["codigo_trabajador"]
    }
                  ]
                },"catalogo_insumos": {
                  Row: {
                    "activo": boolean,"codigo_comercial": string,"criterio_precio": string | null,"fecha_actualizacion": string,"id_categoria": number | null,"id_insumo": number,"id_unidad": number,"nombre": string,"precio_mayorista": number,"referencia_precio": string | null,"stock_inicial": number | null,"variedad": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"codigo_comercial"?: string,"criterio_precio"?: string | null,"fecha_actualizacion"?: string,"id_categoria"?: number | null,"id_insumo": number,"id_unidad": number,"nombre": string,"precio_mayorista": number,"referencia_precio"?: string | null,"stock_inicial"?: number | null,"variedad"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"codigo_comercial"?: string,"criterio_precio"?: string | null,"fecha_actualizacion"?: string,"id_categoria"?: number | null,"id_insumo"?: number,"id_unidad"?: number,"nombre"?: string,"precio_mayorista"?: number,"referencia_precio"?: string | null,"stock_inicial"?: number | null,"variedad"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_insumos_id_categoria_fkey"
      columns: ["id_categoria"]
isOneToOne: false
      referencedRelation: "catalogo_categorias"
      referencedColumns: ["id_categoria"]
    },{
      foreignKeyName: "catalogo_insumos_id_unidad_fkey"
      columns: ["id_unidad"]
isOneToOne: false
      referencedRelation: "catalogo_unidades_medida"
      referencedColumns: ["id_unidad"]
    }
                  ]
                },"catalogo_jornadas_personal": {
                  Row: {
                    "codigo_contrato": string,"dia_iso": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo_contrato": string,"dia_iso": number
                  }
                  Update: {
                    "codigo_contrato"?: string,"dia_iso"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_jornadas_personal_codigo_contrato_fkey"
      columns: ["codigo_contrato"]
isOneToOne: false
      referencedRelation: "catalogo_contratos_personal"
      referencedColumns: ["codigo_contrato"]
    }
                  ]
                },"catalogo_parametros_laborales": {
                  Row: {
                    "afp_referencia": string,"anio_calendario": number,"dias_semana_empresa": number,"fecha_referencia": string,"id_escenario": number,"id_instalacion": string,"id_restaurante": number,"limite_recibo_sin_retencion": number,"nombre": string,"observaciones": string,"regimen": string,"rmv": number,"tasa_afp_aporte": number,"tasa_afp_flujo": number,"tasa_afp_prima": number,"tasa_asignacion": number,"tasa_bonificacion_grati_eps": number,"tasa_bonificacion_grati_essalud": number,"tasa_credito_eps": number,"tasa_cuarta": number,"tasa_essalud": number,"tasa_onp": number,"tope_prima_afp": number,"uit": number
                  }
                  ComputedFields: never
                  Insert: {
                    "afp_referencia": string,"anio_calendario": number,"dias_semana_empresa": number,"fecha_referencia": string,"id_escenario": number,"id_instalacion": string,"id_restaurante": number,"limite_recibo_sin_retencion": number,"nombre": string,"observaciones": string,"regimen": string,"rmv": number,"tasa_afp_aporte": number,"tasa_afp_flujo": number,"tasa_afp_prima": number,"tasa_asignacion": number,"tasa_bonificacion_grati_eps": number,"tasa_bonificacion_grati_essalud": number,"tasa_credito_eps": number,"tasa_cuarta": number,"tasa_essalud": number,"tasa_onp": number,"tope_prima_afp": number,"uit": number
                  }
                  Update: {
                    "afp_referencia"?: string,"anio_calendario"?: number,"dias_semana_empresa"?: number,"fecha_referencia"?: string,"id_escenario"?: number,"id_instalacion"?: string,"id_restaurante"?: number,"limite_recibo_sin_retencion"?: number,"nombre"?: string,"observaciones"?: string,"regimen"?: string,"rmv"?: number,"tasa_afp_aporte"?: number,"tasa_afp_flujo"?: number,"tasa_afp_prima"?: number,"tasa_asignacion"?: number,"tasa_bonificacion_grati_eps"?: number,"tasa_bonificacion_grati_essalud"?: number,"tasa_credito_eps"?: number,"tasa_cuarta"?: number,"tasa_essalud"?: number,"tasa_onp"?: number,"tope_prima_afp"?: number,"uit"?: number
                  }
                  Relationships: [
                    
                  ]
                },"catalogo_platos": {
                  Row: {
                    "categoria_menu": string | null,"descripcion": string | null,"id_plato": number,"moneda": string,"nombre": string,"porciones": number,"unidad_produccion": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria_menu"?: string | null,"descripcion"?: string | null,"id_plato": number,"moneda"?: string,"nombre": string,"porciones": number,"unidad_produccion"?: string
                  }
                  Update: {
                    "categoria_menu"?: string | null,"descripcion"?: string | null,"id_plato"?: number,"moneda"?: string,"nombre"?: string,"porciones"?: number,"unidad_produccion"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalogo_receta_detalles": {
                  Row: {
                    "cantidad": number,"cantidad_base": number | null,"factor_a_unidad_base": number,"id_insumo": number,"id_plato": number,"merma_pct": number,"notas": string | null,"orden": number,"unidad_receta": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"cantidad_base"?: never,"factor_a_unidad_base": number,"id_insumo": number,"id_plato": number,"merma_pct"?: number,"notas"?: string | null,"orden"?: number,"unidad_receta": string
                  }
                  Update: {
                    "cantidad"?: number,"cantidad_base"?: never,"factor_a_unidad_base"?: number,"id_insumo"?: number,"id_plato"?: number,"merma_pct"?: number,"notas"?: string | null,"orden"?: number,"unidad_receta"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_receta_detalles_id_insumo_fkey"
      columns: ["id_insumo"]
isOneToOne: false
      referencedRelation: "catalogo_insumos"
      referencedColumns: ["id_insumo"]
    },{
      foreignKeyName: "catalogo_receta_detalles_id_plato_fkey"
      columns: ["id_plato"]
isOneToOne: false
      referencedRelation: "catalogo_platos"
      referencedColumns: ["id_plato"]
    }
                  ]
                },"catalogo_trabajadores": {
                  Row: {
                    "activo": boolean,"apellidos": string,"cargo": string,"codigo_area": string,"codigo_trabajador": string,"es_simulado": boolean,"nombres": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"apellidos": string,"cargo": string,"codigo_area": string,"codigo_trabajador": string,"es_simulado"?: boolean,"nombres": string
                  }
                  Update: {
                    "activo"?: boolean,"apellidos"?: string,"cargo"?: string,"codigo_area"?: string,"codigo_trabajador"?: string,"es_simulado"?: boolean,"nombres"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_trabajadores_codigo_area_fkey"
      columns: ["codigo_area"]
isOneToOne: false
      referencedRelation: "catalogo_areas_personal"
      referencedColumns: ["codigo_area"]
    }
                  ]
                },"catalogo_unidades_medida": {
                  Row: {
                    "codigo": string,"descripcion": string | null,"id_unidad": number
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo": string,"descripcion"?: string | null,"id_unidad": number
                  }
                  Update: {
                    "codigo"?: string,"descripcion"?: string | null,"id_unidad"?: number
                  }
                  Relationships: [
                    
                  ]
                },"catalogo_vacaciones_personal": {
                  Row: {
                    "anio": number,"codigo_contrato": string,"fecha_fin": string,"fecha_inicio": string,"observacion": string,"tipo_dias": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anio": number,"codigo_contrato": string,"fecha_fin": string,"fecha_inicio": string,"observacion": string,"tipo_dias": string
                  }
                  Update: {
                    "anio"?: number,"codigo_contrato"?: string,"fecha_fin"?: string,"fecha_inicio"?: string,"observacion"?: string,"tipo_dias"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalogo_vacaciones_personal_codigo_contrato_fkey"
      columns: ["codigo_contrato"]
isOneToOne: false
      referencedRelation: "catalogo_contratos_personal"
      referencedColumns: ["codigo_contrato"]
    }
                  ]
                },"cost_concepts": {
                  Row: {
                    "active": boolean,"amount": number,"basis": string,"behavior": string,"created_at": string,"id": number,"justification": string,"kind": string,"name": string,"period_id": number,"reference_key": string | null,"restaurant_id": string,"targets": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"amount": number,"basis": string,"behavior": string,"created_at"?: string,"id"?: never,"justification": string,"kind": string,"name": string,"period_id": number,"reference_key"?: string | null,"restaurant_id": string,"targets"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"amount"?: number,"basis"?: string,"behavior"?: string,"created_at"?: string,"id"?: never,"justification"?: string,"kind"?: string,"name"?: string,"period_id"?: number,"reference_key"?: string | null,"restaurant_id"?: string,"targets"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cost_concepts_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cost_concepts_restaurant_id_period_id_fkey"
      columns: ["restaurant_id","period_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"employee_period_costs": {
                  Row: {
                    "breakdown": Json | null,"created_at": string,"data": NonNullable<Json>,"employee_id": number,"id": number,"period_id": number,"restaurant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "breakdown"?: Json | null,"created_at"?: string,"data": NonNullable<Json>,"employee_id": number,"id"?: never,"period_id": number,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "breakdown"?: Json | null,"created_at"?: string,"data"?: NonNullable<Json>,"employee_id"?: number,"id"?: never,"period_id"?: number,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_period_costs_restaurant_id_employee_id_fkey"
      columns: ["restaurant_id","employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "employee_period_costs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employee_period_costs_restaurant_id_period_id_fkey"
      columns: ["restaurant_id","period_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "active": boolean,"created_at": string,"document": string | null,"id": number,"name": string,"restaurant_id": string,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"document"?: string | null,"id"?: never,"name": string,"restaurant_id": string,"role": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"document"?: string | null,"id"?: never,"name"?: string,"restaurant_id"?: string,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_locks": {
                  Row: {
                    "restaurant_id": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "restaurant_id": string,"revision"?: number
                  }
                  Update: {
                    "restaurant_id"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_locks_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"material_id": number,"movement_on": string,"plan_id": number | null,"quantity": number,"reference": string,"restaurant_id": string,"sale_id": number | null,"unit_cost": number,"updated_at": string,"voided": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"material_id": number,"movement_on": string,"plan_id"?: number | null,"quantity": number,"reference": string,"restaurant_id": string,"sale_id"?: number | null,"unit_cost": number,"updated_at"?: string,"voided"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"material_id"?: number,"movement_on"?: string,"plan_id"?: number | null,"quantity"?: number,"reference"?: string,"restaurant_id"?: string,"sale_id"?: number | null,"unit_cost"?: number,"updated_at"?: string,"voided"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_restaurant_id_material_id_fkey"
      columns: ["restaurant_id","material_id"]
isOneToOne: false
      referencedRelation: "materials"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "inventory_movements_restaurant_id_plan_id_fkey"
      columns: ["restaurant_id","plan_id"]
isOneToOne: false
      referencedRelation: "production_plans"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "inventory_movements_restaurant_id_sale_id_fkey"
      columns: ["restaurant_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"material_conversions": {
                  Row: {
                    "created_at": string,"evidence": string,"factor": number,"id": number,"label": string,"material_id": number,"restaurant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evidence": string,"factor": number,"id"?: never,"label": string,"material_id": number,"restaurant_id": string
                  }
                  Update: {
                    "created_at"?: string,"evidence"?: string,"factor"?: number,"id"?: never,"label"?: string,"material_id"?: number,"restaurant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_conversions_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_conversions_restaurant_id_material_id_fkey"
      columns: ["restaurant_id","material_id"]
isOneToOne: false
      referencedRelation: "materials"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"material_cost_versions": {
                  Row: {
                    "attributable_cost": number | null,"author_id": string,"conversion_evidence": string | null,"created_at": string,"currency": string,"effective_on": string,"factor": number | null,"id": number,"material_id": number,"mode": string,"net_amount": number | null,"nonrecoverable_tax": number | null,"purchase_unit": string | null,"quantity": number | null,"recoverable_tax": number | null,"restaurant_id": string,"source": string,"unit_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attributable_cost"?: number | null,"author_id"?: string,"conversion_evidence"?: string | null,"created_at"?: string,"currency": string,"effective_on": string,"factor"?: number | null,"id"?: never,"material_id": number,"mode": string,"net_amount"?: number | null,"nonrecoverable_tax"?: number | null,"purchase_unit"?: string | null,"quantity"?: number | null,"recoverable_tax"?: number | null,"restaurant_id": string,"source": string,"unit_cost"?: number | null
                  }
                  Update: {
                    "attributable_cost"?: number | null,"author_id"?: string,"conversion_evidence"?: string | null,"created_at"?: string,"currency"?: string,"effective_on"?: string,"factor"?: number | null,"id"?: never,"material_id"?: number,"mode"?: string,"net_amount"?: number | null,"nonrecoverable_tax"?: number | null,"purchase_unit"?: string | null,"quantity"?: number | null,"recoverable_tax"?: number | null,"restaurant_id"?: string,"source"?: string,"unit_cost"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_cost_versions_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_cost_versions_restaurant_id_material_id_fkey"
      columns: ["restaurant_id","material_id"]
isOneToOne: false
      referencedRelation: "materials"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"materials": {
                  Row: {
                    "active": boolean,"base_unit_code": string,"catalog_material_id": number | null,"category": string,"code": string,"created_at": string,"id": number,"name": string,"restaurant_id": string,"supplier": string | null,"updated_at": string,"variety": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"base_unit_code": string,"catalog_material_id"?: number | null,"category": string,"code": string,"created_at"?: string,"id"?: never,"name": string,"restaurant_id": string,"supplier"?: string | null,"updated_at"?: string,"variety"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"base_unit_code"?: string,"catalog_material_id"?: number | null,"category"?: string,"code"?: string,"created_at"?: string,"id"?: never,"name"?: string,"restaurant_id"?: string,"supplier"?: string | null,"updated_at"?: string,"variety"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "materials_base_unit_code_fkey"
      columns: ["base_unit_code"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "materials_catalog_material_id_fkey"
      columns: ["catalog_material_id"]
isOneToOne: false
      referencedRelation: "catalogo_insumos"
      referencedColumns: ["id_insumo"]
    },{
      foreignKeyName: "materials_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"periods": {
                  Row: {
                    "created_at": string,"id": number,"month": number,"restaurant_id": string,"tax_rate": number | null,"updated_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"month": number,"restaurant_id": string,"tax_rate"?: number | null,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"month"?: number,"restaurant_id"?: string,"tax_rate"?: number | null,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "periods_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_lines": {
                  Row: {
                    "adopted_price": number | null,"created_at": string,"equivalent_factor": number,"id": number,"plan_id": number,"pricing_mode": string,"pricing_value": number,"product_id": number,"quantity": number,"recipe_id": number,"reference_price": number,"restaurant_id": string,"tax_rate": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adopted_price"?: number | null,"created_at"?: string,"equivalent_factor": number,"id"?: never,"plan_id": number,"pricing_mode": string,"pricing_value": number,"product_id": number,"quantity": number,"recipe_id": number,"reference_price": number,"restaurant_id": string,"tax_rate"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "adopted_price"?: number | null,"created_at"?: string,"equivalent_factor"?: number,"id"?: never,"plan_id"?: number,"pricing_mode"?: string,"pricing_value"?: number,"product_id"?: number,"quantity"?: number,"recipe_id"?: number,"reference_price"?: number,"restaurant_id"?: string,"tax_rate"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_lines_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_lines_restaurant_id_plan_id_fkey"
      columns: ["restaurant_id","plan_id"]
isOneToOne: false
      referencedRelation: "production_plans"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "plan_lines_restaurant_id_product_id_fkey"
      columns: ["restaurant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "plan_lines_restaurant_id_recipe_id_fkey"
      columns: ["restaurant_id","recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"product_prices": {
                  Row: {
                    "amount": number,"created_at": string,"product_id": number,"restaurant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"product_id": number,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"product_id"?: number,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_prices_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_prices_restaurant_id_product_id_fkey"
      columns: ["restaurant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"production_plans": {
                  Row: {
                    "active": boolean,"calculation_hash": string | null,"created_at": string,"id": number,"name": string,"no_cif": boolean,"no_expenses": boolean,"period_id": number,"price_date": string,"restaurant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"calculation_hash"?: string | null,"created_at"?: string,"id"?: never,"name": string,"no_cif"?: boolean,"no_expenses"?: boolean,"period_id": number,"price_date": string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"calculation_hash"?: string | null,"created_at"?: string,"id"?: never,"name"?: string,"no_cif"?: boolean,"no_expenses"?: boolean,"period_id"?: number,"price_date"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "production_plans_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "production_plans_restaurant_id_period_id_fkey"
      columns: ["restaurant_id","period_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"description": string | null,"id": number,"menu_category": string | null,"name": string,"restaurant_id": string,"revision": number,"source_key": string | null,"source_version": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"description"?: string | null,"id"?: never,"menu_category"?: string | null,"name": string,"restaurant_id": string,"revision"?: number,"source_key"?: string | null,"source_version"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"description"?: string | null,"id"?: never,"menu_category"?: string | null,"name"?: string,"restaurant_id"?: string,"revision"?: number,"source_key"?: string | null,"source_version"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"name"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_lines": {
                  Row: {
                    "conversion_evidence": string,"cost_version_id": number,"factor": number,"id": number,"material_id": number,"material_name": string,"mode": string,"position": number,"quantity": number,"rate": number,"recipe_id": number,"restaurant_id": string,"unit_key": string,"unit_label": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversion_evidence": string,"cost_version_id": number,"factor": number,"id"?: never,"material_id": number,"material_name": string,"mode": string,"position": number,"quantity": number,"rate": number,"recipe_id": number,"restaurant_id": string,"unit_key": string,"unit_label": string
                  }
                  Update: {
                    "conversion_evidence"?: string,"cost_version_id"?: number,"factor"?: number,"id"?: never,"material_id"?: number,"material_name"?: string,"mode"?: string,"position"?: number,"quantity"?: number,"rate"?: number,"recipe_id"?: number,"restaurant_id"?: string,"unit_key"?: string,"unit_label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_lines_restaurant_id_cost_version_id_fkey"
      columns: ["restaurant_id","cost_version_id"]
isOneToOne: false
      referencedRelation: "material_cost_versions"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "recipe_lines_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_lines_restaurant_id_material_id_fkey"
      columns: ["restaurant_id","material_id"]
isOneToOne: false
      referencedRelation: "materials"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "recipe_lines_restaurant_id_recipe_id_fkey"
      columns: ["restaurant_id","recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"recipe_versions": {
                  Row: {
                    "author_id": string,"created_at": string,"currency": string,"id": number,"number": number,"output_quantity": number,"output_unit_code": string,"product_id": number,"product_name": string,"restaurant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"created_at"?: string,"currency": string,"id"?: never,"number": number,"output_quantity": number,"output_unit_code": string,"product_id": number,"product_name": string,"restaurant_id": string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"currency"?: string,"id"?: never,"number"?: number,"output_quantity"?: number,"output_unit_code"?: string,"product_id"?: number,"product_name"?: string,"restaurant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_versions_output_unit_code_fkey"
      columns: ["output_unit_code"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "recipe_versions_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_restaurant_id_product_id_fkey"
      columns: ["restaurant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"recipe_work": {
                  Row: {
                    "created_at": string,"id": number,"no_labor": boolean,"no_materials": boolean,"operations": NonNullable<Json>,"recipe_id": number,"restaurant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"no_labor"?: boolean,"no_materials"?: boolean,"operations"?: NonNullable<Json>,"recipe_id": number,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"no_labor"?: boolean,"no_materials"?: boolean,"operations"?: NonNullable<Json>,"recipe_id"?: number,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_work_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_work_restaurant_id_recipe_id_fkey"
      columns: ["restaurant_id","recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"restaurant_labor_profiles": {
                  Row: {
                    "base_scenario_id": number,"base_worker_code": string,"created_at": string,"deleted": boolean,"id": number,"local_scenario_id": number | null,"local_worker_code": string | null,"refs": NonNullable<Json>,"restaurant_id": string,"revision": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_scenario_id": number,"base_worker_code": string,"created_at"?: string,"deleted"?: boolean,"id"?: never,"local_scenario_id"?: number | null,"local_worker_code"?: string | null,"refs"?: NonNullable<Json>,"restaurant_id": string,"revision"?: number,"updated_at"?: string
                  }
                  Update: {
                    "base_scenario_id"?: number,"base_worker_code"?: string,"created_at"?: string,"deleted"?: boolean,"id"?: never,"local_scenario_id"?: number | null,"local_worker_code"?: string | null,"refs"?: NonNullable<Json>,"restaurant_id"?: string,"revision"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurant_labor_profiles_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"restaurant_members": {
                  Row: {
                    "created_at": string,"restaurant_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"restaurant_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"restaurant_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurant_members_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"restaurant_units": {
                  Row: {
                    "enabled": boolean,"restaurant_id": string,"unit_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"restaurant_id": string,"unit_code": string
                  }
                  Update: {
                    "enabled"?: boolean,"restaurant_id"?: string,"unit_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurant_units_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restaurant_units_unit_code_fkey"
      columns: ["unit_code"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["code"]
    }
                  ]
                },"restaurants": {
                  Row: {
                    "active": boolean,"created_at": string,"currency": string,"default_tax_rate": number | null,"id": string,"legal_name": string,"owner_id": string,"tax_id": string | null,"tax_id_kind": string,"trade_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"currency"?: string,"default_tax_rate"?: number | null,"id"?: string,"legal_name": string,"owner_id"?: string,"tax_id"?: string | null,"tax_id_kind"?: string,"trade_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"currency"?: string,"default_tax_rate"?: number | null,"id"?: string,"legal_name"?: string,"owner_id"?: string,"tax_id"?: string | null,"tax_id_kind"?: string,"trade_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sales": {
                  Row: {
                    "created_at": string,"id": number,"product_id": number,"quantity": number,"recipe_id": number,"restaurant_id": string,"sold_on": string,"unit_cost": number,"unit_price": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"product_id": number,"quantity": number,"recipe_id": number,"restaurant_id": string,"sold_on": string,"unit_cost": number,"unit_price": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"product_id"?: number,"quantity"?: number,"recipe_id"?: number,"restaurant_id"?: string,"sold_on"?: string,"unit_cost"?: number,"unit_price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_restaurant_id_product_id_fkey"
      columns: ["restaurant_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "sales_restaurant_id_recipe_id_fkey"
      columns: ["restaurant_id","recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"units": {
                  Row: {
                    "code": string,"denominator": number,"dimension": string,"name": string,"numerator": number,"symbol": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"denominator": number,"dimension": string,"name": string,"numerator": number,"symbol": string
                  }
                  Update: {
                    "code"?: string,"denominator"?: number,"dimension"?: string,"name"?: string,"numerator"?: number,"symbol"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_edit":
{ Args: { "rid": string }; Returns: boolean
                           },
"is_member":
{ Args: { "rid": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "rid": string }; Returns: boolean
                           },
"lima_today":
{ Args: never; Returns: string
                           },
"create_restaurant":
{ Args: { "p_legal_name": string; "p_trade_name"?: string | null; "p_tax_id_kind"?: string; "p_tax_id"?: string | null; "p_currency"?: string; "p_year"?: number | null; "p_month"?: number | null }; Returns: string
                           },
"restaurant_money_data":
{ Args: { "rid": string }; Returns: boolean
                           },
"category_prefix":
{ Args: { "category": string }; Returns: string
                           },
"add_catalog_material":
{ Args: { "p_restaurant": string; "p_catalog_id": number }; Returns: number
                           },
"create_material":
{ Args: { "p_restaurant": string; "p_name": string; "p_variety": string | null; "p_category": string; "p_unit": string; "p_unit_cost": string; "p_effective_on": string; "p_supplier"?: string | null }; Returns: number
                           },
"register_purchase":
{ Args: { "p_material": number; "p_quantity": string; "p_unit": string; "p_unit_price": string; "p_date": string; "p_token": string }; Returns: number
                           },
"material_available":
{ Args: { "p_material": number; "p_on": string }; Returns: number
                           },
"create_product":
{ Args: { "p_restaurant": string; "p_name": string; "p_description"?: string | null; "p_menu_category"?: string | null; "p_output_quantity"?: string }; Returns: number
                           },
"save_recipe":
{ Args: { "p_product": number; "p_revision": number; "p_lines": Json }; Returns: number
                           },
"update_product":
{ Args: { "p_product": number; "p_revision": number; "p_name": string; "p_description": string | null; "p_menu_category": string | null; "p_output_quantity": string }; Returns: number
                           },
"scale_recipe":
{ Args: { "p_product": number; "p_revision": number; "p_output_quantity": string }; Returns: number
                           },
"personalize_dish":
{ Args: { "p_restaurant": string; "p_dish": number }; Returns: number
                           },
"delete_product":
{ Args: { "p_product": number; "p_revision": number }; Returns: undefined
                           },
"add_operation":
{ Args: { "p_recipe": number; "p_employee": number; "p_activity": string; "p_minutes": string }; Returns: undefined
                           },
"remove_operation":
{ Args: { "p_recipe": number; "p_position": number }; Returns: undefined
                           },
"set_recipe_work":
{ Args: { "p_recipe": number; "p_no_materials": boolean; "p_no_labor": boolean }; Returns: undefined
                           },
"delete_employee":
{ Args: { "p_employee": number }; Returns: undefined
                           },
"create_plan":
{ Args: { "p_restaurant": string; "p_period": number; "p_name": string; "p_price_date": string; "p_no_cif": boolean; "p_no_expenses": boolean; "p_lines": Json }; Returns: number
                           },
"save_plan_line":
{ Args: { "p_plan": number; "p_product": number; "p_quantity": string; "p_reference_price": string; "p_equivalent_factor": string; "p_pricing_mode": string; "p_pricing_value": string; "p_adopted_price": string | null; "p_use_latest"?: boolean }; Returns: number
                           },
"remove_plan_line":
{ Args: { "p_line": number }; Returns: undefined
                           },
"activate_plan":
{ Args: { "p_plan": number }; Returns: undefined
                           },
"publish_budget":
{ Args: { "p_plan": number; "p_fingerprint": string; "p_snapshot": Json }; Returns: number
                           },
"register_sale":
{ Args: { "p_period": number; "p_product": number; "p_sold_on": string; "p_quantity": string; "p_unit_cost": string }; Returns: number
                           },
"delete_sale":
{ Args: { "p_sale": number }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
