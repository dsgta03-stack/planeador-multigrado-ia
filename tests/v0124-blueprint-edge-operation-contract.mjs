import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyShadowOperation
} from '../supabase/functions/plan-project-blueprint-v1-shadow/operation-contract.mjs';

const valid=value=>
  classifyShadowOperation(value).valid;

test('blueprint operation contract preserves certified tasks',()=>{
  for(const task of ['GENERATE','REPAIR','REVIEW']){
    assert.equal(
      valid({
        task,
        prompt_version:'PROJECT_BLUEPRINT_SHADOW_V1_R2',
        model:'gemini-3.5-flash-lite'
      }),
      true
    );
  }
});

test('project composition has its own prompt contract and locked model',()=>{
  assert.equal(
    valid({
      task:'PROJECT_COMPOSITION',
      prompt_version:'PROJECT_COMPOSITION_PROMPT_V1',
      model:'gemini-3.5-flash-lite'
    }),
    true
  );

  assert.equal(
    valid({
      task:'PROJECT_COMPOSITION',
      prompt_version:'PROJECT_BLUEPRINT_SHADOW_V1_R2',
      model:'gemini-3.5-flash-lite'
    }),
    false
  );

  assert.equal(
    valid({
      task:'PROJECT_COMPOSITION',
      prompt_version:'PROJECT_COMPOSITION_PROMPT_V1',
      model:'gemini-3.1-flash-lite'
    }),
    false
  );
});

test('prompt versions cannot cross operation families',()=>{
  assert.equal(
    valid({
      task:'GENERATE',
      prompt_version:'PROJECT_COMPOSITION_PROMPT_V1',
      model:'gemini-3.5-flash-lite'
    }),
    false
  );

  assert.equal(
    valid({
      task:'UNKNOWN',
      prompt_version:'PROJECT_BLUEPRINT_SHADOW_V1_R2',
      model:'gemini-3.5-flash-lite'
    }),
    false
  );
});
