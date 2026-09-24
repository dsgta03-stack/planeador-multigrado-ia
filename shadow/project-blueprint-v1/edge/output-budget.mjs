// Shadow-only diagnostic switch, never the default production/output policy.
export const FLASH35_CONFIRMED_OUTPUT_MAX=65536;
export function outputBudget(task,model,diagnostic=false){
 if(diagnostic&&model==='gemini-3.5-flash-lite'&&['GENERATE','REPAIR'].includes(task))return FLASH35_CONFIRMED_OUTPUT_MAX;
 return 22000;
}
