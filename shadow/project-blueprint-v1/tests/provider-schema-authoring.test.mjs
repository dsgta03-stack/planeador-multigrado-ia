import test from 'node:test';
import assert from 'node:assert/strict';

import {
  providerAuthoringShapeSchema
} from '../provider-schema.mjs';

test('authoring schema projects nullable enum scalar to nullable type array',()=>{
  const local={
    type:'object',
    additionalProperties:false,
    required:['project_id'],
    properties:{
      project_id:{
        anyOf:[
          {
            type:'string',
            enum:['p1','p2']
          },
          {
            type:'null'
          }
        ]
      }
    }
  };

  const projected=
    providerAuthoringShapeSchema(local);

  assert.deepEqual(
    projected.schema,
    {
      type:'object',
      properties:{
        project_id:{
          type:['string','null']
        }
      },
      required:['project_id']
    }
  );

  assert.equal(
    projected.schema.properties.project_id.enum,
    undefined
  );

  assert.ok(
    projected.removed.some(
      item=>
        item.keyword==='anyOf' &&
        item.replacement==='nullable_type_array'
    )
  );
});