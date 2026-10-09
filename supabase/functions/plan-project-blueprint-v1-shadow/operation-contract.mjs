export const BLUEPRINT_PROMPT_VERSION='PROJECT_BLUEPRINT_SHADOW_V1_R2';
export const COMPOSITION_PROMPT_VERSION='PROJECT_COMPOSITION_PROMPT_V1';
export const COMPOSITION_MODEL='gemini-3.5-flash-lite';

export const BLUEPRINT_TASKS=Object.freeze([
  'GENERATE',
  'REPAIR',
  'REVIEW'
]);

export const BLUEPRINT_MODELS=Object.freeze([
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview'
]);

export function classifyShadowOperation({
  task,
  prompt_version,
  model
}={}){
  const blueprintTask=
    BLUEPRINT_TASKS.includes(task);

  const compositionTask=
    task==='PROJECT_COMPOSITION';

  const validPromptVersion=
    blueprintTask
      ? prompt_version===BLUEPRINT_PROMPT_VERSION
      : compositionTask
        ? prompt_version===COMPOSITION_PROMPT_VERSION
        : false;

  const validModel=
    blueprintTask
      ? BLUEPRINT_MODELS.includes(model)
      : compositionTask
        ? model===COMPOSITION_MODEL
        : false;

  return Object.freeze({
    blueprintTask,
    compositionTask,
    valid:
      (blueprintTask||compositionTask) &&
      validPromptVersion &&
      validModel
  });
}
