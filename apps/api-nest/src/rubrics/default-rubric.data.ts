export const DEFAULT_RUBRIC_NAME = 'Rúbrica base Gustavo';
export const DEFAULT_PASS_THRESHOLD = 24;

export const DEFAULT_RUBRIC_LEVELS = [
  { value: 1, label: 'No logrado', sort_order: 1 },
  { value: 2, label: 'Parcialmente logrado', sort_order: 2 },
  { value: 3, label: 'Logrado', sort_order: 3 },
  { value: 4, label: 'Sobresaliente', sort_order: 4 },
] as const;

export interface DefaultRubricCriterion {
  code: string;
  label: string;
  sort_order: number;
  descriptors: [string, string, string, string];
}

/** 8 criteria × 4 levels from rubrica.txt (root). */
export const DEFAULT_RUBRIC_CRITERIA: DefaultRubricCriterion[] = [
  {
    code: 'COMPRENSION',
    label: 'Comprensión de la consigna',
    sort_order: 1,
    descriptors: [
      'No comprende la consigna o responde fuera de tema.',
      'Comprende solo una parte de la consigna.',
      'Comprende la consigna y responde de manera adecuada.',
      'Comprende plenamente la consigna y responde con precisión, profundidad y foco.',
    ],
  },
  {
    code: 'PERTINENCIA',
    label: 'Pertinencia de la respuesta',
    sort_order: 2,
    descriptors: [
      'La respuesta no se relaciona con el objetivo de la unidad.',
      'La respuesta se relaciona de forma incompleta o débil.',
      'La respuesta es pertinente y responde al objetivo planteado.',
      'La respuesta es altamente pertinente, completa y muy bien ajustada al objetivo.',
    ],
  },
  {
    code: 'APLICACION',
    label: 'Aplicación de contenidos',
    sort_order: 3,
    descriptors: [
      'No aplica los contenidos trabajados.',
      'Aplica los contenidos de forma superficial o con errores.',
      'Aplica correctamente los contenidos de la unidad.',
      'Aplica los contenidos con solvencia, integración y criterio profesional.',
    ],
  },
  {
    code: 'DECISIONES',
    label: 'Toma de decisiones',
    sort_order: 4,
    descriptors: [
      'Las decisiones son inadecuadas o arbitrarias.',
      'Las decisiones son parcialmente correctas, pero poco justificadas.',
      'Las decisiones son adecuadas y coherentes con la situación.',
      'Las decisiones son óptimas, justificadas y estratégicamente fundamentadas.',
    ],
  },
  {
    code: 'RESOLUCION',
    label: 'Resolución de problemas',
    sort_order: 5,
    descriptors: [
      'No resuelve la situación o lo hace de forma incorrecta.',
      'Resuelve parcialmente, con errores importantes.',
      'Resuelve la situación de manera correcta.',
      'Resuelve la situación con eficacia, creatividad y criterio analítico.',
    ],
  },
  {
    code: 'ARGUMENTACION',
    label: 'Argumentación',
    sort_order: 6,
    descriptors: [
      'No fundamenta sus respuestas o lo hace de forma incorrecta.',
      'Fundamenta de manera débil o incompleta.',
      'Fundamenta con coherencia y respaldo conceptual.',
      'Fundamenta con solidez, claridad y alto nivel de reflexión.',
    ],
  },
  {
    code: 'CUMPLIMIENTO',
    label: 'Cumplimiento de objetivos de la unidad',
    sort_order: 7,
    descriptors: [
      'No alcanza los objetivos.',
      'Alcanza algunos objetivos de manera parcial.',
      'Alcanza la mayoría de los objetivos de la unidad.',
      'Supera los objetivos de la unidad con alto nivel de dominio.',
    ],
  },
  {
    code: 'AUTONOMIA',
    label: 'Autonomía y consistencia',
    sort_order: 8,
    descriptors: [
      'Depende totalmente de ayudas o responde de forma inconsistente.',
      'Presenta autonomía limitada e inconsistencias frecuentes.',
      'Responde con autonomía y consistencia aceptable.',
      'Responde con total autonomía, consistencia y seguridad.',
    ],
  },
];
