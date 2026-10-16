import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNumberExpression as parse} from '../../src/number-expression.js';
test('inspector arithmetic: precedence, parentheses, unary signs, decimal separators and suffixes',()=>{
  for(const [text,value]of [['12',12],['2 + 3 * 4',14],['(2 + 3) * 4',20],['-5 + 2',-3],['2*-3',-6],['2**3**2',512],['2**-2',.25],['1,5 + .5',2],['24px / 2',12],['50% + 10',60],['180° / 2',90],['1.',1],['(4+2)px',6]])assert.equal(parse(text),value,text);
});
test('inspector arithmetic: incomplete, nonfinite, ambiguous and executable inputs fail without evaluation',()=>{
  for(const text of ['', '1 2','1..2','2+','(2+3','2/0','0/0','NaN','Infinity','alert(1)','globalThis.x=1','this.constructor','1;2','Math.PI','2pxpx','px2','2^3','(' .repeat(40)+'1'+')'.repeat(40),'1+'.repeat(200)+'1'])assert.equal(parse(text),null,text);
});
