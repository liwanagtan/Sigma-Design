// Bounded arithmetic for inspector fields. No JavaScript compilation or property access.
export function parseNumberExpression(input) {
  const text=String(input).trim().replace(/,/g,'.');
  if(!text||text.length>1024)return null;
  const tokens=[];let offset=0,previousValue=false;
  while(offset<text.length){
    const rest=text.slice(offset);
    const whitespace=/^\s+/.exec(rest);if(whitespace){offset+=whitespace[0].length;continue;}
    const unit=/^(?:px|%|°)/i.exec(rest);
    if(unit){if(!previousValue)return null;offset+=unit[0].length;previousValue=false;continue;}
    const match=/^(?:\d+(?:\.\d*)?|\.\d+|\*\*|[-+*/()])/.exec(rest);
    if(!match)return null;
    const token=match[0];tokens.push(token);offset+=token.length;previousValue=/[\d.)]$/.test(token);
    if(tokens.length>256)return null;
  }
  let at=0,depth=0;
  const take=()=>tokens[at++],peek=()=>tokens[at];
  function primary(){
    if(++depth>32)throw Error('Too deeply nested');
    let value;
    if(peek()==='('){take();value=expression();if(take()!==')')throw Error('Missing closing parenthesis');}
    else{const token=take();if(!token||!/^\d*\.?\d+$|^\d+\.$/.test(token))throw Error('Expected number');value=Number(token);}
    depth--;return value;
  }
  function power(){const base=primary();return peek()==='**'?(take(),base**signed()):base;}
  function signed(){if(++depth>32)throw Error('Too deeply nested');const sign=peek();let value;if(sign==='+'||sign==='-'){take();value=(sign==='-'?-1:1)*signed();}else value=power();depth--;return value;}
  function term(){let value=signed();while(peek()==='*'||peek()==='/'){const op=take(),right=signed();value=op==='*'?value*right:value/right;}return value;}
  function expression(){let value=term();while(peek()==='+'||peek()==='-'){const op=take(),right=term();value=op==='+'?value+right:value-right;}return value;}
  try{const result=expression();return at===tokens.length&&Number.isFinite(result)?result:null;}catch{return null;}
}
