// Безопасный вычислитель для bind.computed/visibleWhen — без eval()/Function().
// Поддерживает: + - * / ( ) < > <= >= == != && || идентификаторы числа/строки.
// НЕ поддерживает: вызовы функций, точечный доступ к свойствам.

const TOKEN_RE = /\s*(?:(\d+\.?\d*)|([A-Za-z_][A-Za-z0-9_]*)|("(?:[^"\\]|\\.)*")|(<=|>=|==|!=|&&|\|\||[+\-*\/()<>]))/g;

export function extractIdentifiers(expression) {
  const ids = new Set();
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(expression))) {
    if (m[2]) ids.add(m[2]);
  }
  return [...ids];
}

function tokenize(expression) {
  const tokens = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  let lastIndex = 0;
  while ((m = TOKEN_RE.exec(expression))) {
    if (m.index !== lastIndex) throw new Error(`Недопустимый символ рядом с позицией ${lastIndex}`);
    if (m[1] !== undefined) tokens.push({ type: 'num', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'id', value: m[2] });
    else if (m[3] !== undefined) tokens.push({ type: 'str', value: m[3].slice(1, -1) });
    else tokens.push({ type: 'op', value: m[4] });
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex !== expression.length) throw new Error('Недопустимый символ в выражении');
  return tokens;
}

function parse(tokens, scope) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek()?.value === '||') { next(); left = left || parseAnd(); }
    return left;
  }
  function parseAnd() {
    let left = parseCompare();
    while (peek()?.value === '&&') { next(); left = left && parseCompare(); }
    return left;
  }
  function parseCompare() {
    let left = parseAdd();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek()?.value)) {
      const op = next().value;
      const right = parseAdd();
      if (op === '<') left = left < right;
      else if (op === '>') left = left > right;
      else if (op === '<=') left = left <= right;
      else if (op === '>=') left = left >= right;
      else if (op === '==') left = left === right;
      else left = left !== right;
    }
    return left;
  }
  function parseAdd() {
    let left = parseMul();
    while (peek()?.value === '+' || peek()?.value === '-') {
      const op = next().value;
      const right = parseMul();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    while (peek()?.value === '*' || peek()?.value === '/') {
      const op = next().value;
      const right = parseUnary();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }
  function parseUnary() {
    if (peek()?.value === '-') { next(); return -parseUnary(); }
    return parseAtom();
  }
  function parseAtom() {
    const tok = next();
    if (!tok) throw new Error('Неожиданный конец выражения');
    if (tok.type === 'num' || tok.type === 'str') return tok.value;
    if (tok.type === 'id') {
      if (tok.value === 'true') return true;
      if (tok.value === 'false') return false;
      if (!(tok.value in scope)) throw new Error(`Неизвестный идентификатор "${tok.value}"`);
      return scope[tok.value];
    }
    if (tok.value === '(') {
      const inner = parseOr();
      if (next()?.value !== ')') throw new Error('Ожидалась закрывающая скобка');
      return inner;
    }
    throw new Error(`Неожиданный токен "${tok.value}"`);
  }

  const result = parseOr();
  if (pos !== tokens.length) throw new Error('Лишние символы в конце выражения');
  return result;
}

export function evaluateSafeExpression(expression, scope) {
  const tokens = tokenize(expression);
  return parse(tokens, scope);
}
