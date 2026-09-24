# Auditoría de tamaño del Blueprint

Observed prefix only. Incomplete node lengths are lower bounds. Containers overlap their children; do not sum all nodes. No partial Blueprint reconstructed.

Fuente: construction-positive-1790208014571.json. Texto total reportado: 137608; prefijo disponible: 100000 caracteres.

| Ruta | Caracteres observados | Completo | Clase |
|---|---:|---|---|
| $.grade_contributions[0].support_need | 89698 | False | MODEL_OWNED |
| $.pda_analysis[1].cognitive_interpretation.official_text_basis | 185 | True | MODEL_OWNED |
| $.final_outcome.description | 178 | True | MODEL_OWNED |
| $.problem_frame.original_problem | 158 | True | REFERENCE_ONLY |
| $.problem_frame.pedagogical_focus | 149 | True | MODEL_OWNED |
| $.problem_frame.context_relevance | 147 | True | MODEL_OWNED |
| $.pda_analysis[0].cognitive_interpretation.official_text_basis | 147 | True | MODEL_OWNED |
| $.problem_frame.why_project_is_needed | 145 | True | MODEL_OWNED |
| $.grade_contributions[0].learning_role | 121 | True | MODEL_OWNED |
| $.pda_analysis[0].cognitive_interpretation.reasoning | 118 | True | MODEL_OWNED |
| $.guiding_question.product_link | 111 | True | MODEL_OWNED |
| $.guiding_question.question | 109 | True | MODEL_OWNED |
| $.pda_analysis[1].cognitive_interpretation.reasoning | 106 | True | MODEL_OWNED |
| $.final_outcome.purpose | 100 | True | MODEL_OWNED |
| $.pda_analysis[0].possible_project_contribution | 95 | True | MODEL_OWNED |
| $.pda_analysis[1].possible_project_contribution | 89 | True | MODEL_OWNED |
| $.pda_analysis[1].integration_reason | 85 | True | MODEL_OWNED |
| $.guiding_question.problem_link | 82 | True | MODEL_OWNED |
| $.pda_analysis[0].integration_reason | 82 | True | MODEL_OWNED |
| $.final_outcome.use_or_destination | 81 | True | MODEL_OWNED |

Arrays (tamaños inclusivos; no sumar con sus hijos):

- $.grade_contributions: 90129 caracteres.
- $.final_outcome.functional_requirements: 2943 caracteres.
- $.pda_analysis: 2429 caracteres.
- $.final_outcome.required_resources: 869 caracteres.
- $.methodology.required_operations: 256 caracteres.
- $.final_outcome.authenticity_conditions: 174 caracteres.
- $.problem_frame.scope: 163 caracteres.
- $.pda_analysis[0].cognitive_interpretation.performance_indicators: 154 caracteres.
- $.pda_analysis[1].cognitive_interpretation.performance_indicators: 148 caracteres.
- $.problem_frame.out_of_scope: 137 caracteres.
- $.final_outcome.completion_evidence: 132 caracteres.
- $.pda_analysis[1].observable_evidence_conditions: 124 caracteres.
- $.pda_analysis[0].observable_evidence_conditions: 118 caracteres.
- $.final_outcome.functional_profiles: 41 caracteres.
- $.final_outcome.functional_requirements[3].stage_ids: 16 caracteres.

Repetición exacta/normalizada, presencia de texto oficial/PDA/operaciones, metadatos de artefactos y todas las rutas observadas están en blueprint-size-audit.json. Campos no presentes en el prefijo no pueden medirse. Los estados antes/después expresan progresión conceptual y no se eliminarán automáticamente aunque sus nombres sean similares.

Repetición dentro de campos (secuencias superpuestas; no sumar):

[
  {
    "path": "$.grade_contributions[0].support_need",
    "word_count_observed": 11679,
    "top_repeated_12_word_sequences": [
      {
        "text": "correspondiente en la república mexicana formalmente establecida para los fines pedagógicos pertinentes",
        "occurrences": 88
      },
      {
        "text": "en la república mexicana formalmente establecida para los fines pedagógicos pertinentes a",
        "occurrences": 88
      },
      {
        "text": "la república mexicana formalmente establecida para los fines pedagógicos pertinentes a la",
        "occurrences": 88
      },
      {
        "text": "república mexicana formalmente establecida para los fines pedagógicos pertinentes a la propuesta",
        "occurrences": 88
      },
      {
        "text": "mexicana formalmente establecida para los fines pedagógicos pertinentes a la propuesta curricular",
        "occurrences": 87
      },
      {
        "text": "formalmente establecida para los fines pedagógicos pertinentes a la propuesta curricular oficial",
        "occurrences": 87
      },
      {
        "text": "establecida para los fines pedagógicos pertinentes a la propuesta curricular oficial vigente",
        "occurrences": 87
      },
      {
        "text": "para los fines pedagógicos pertinentes a la propuesta curricular oficial vigente del",
        "occurrences": 87
      }
    ]
  }
]
