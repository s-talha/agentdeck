/**
 * A small arithmetic evaluator. Recursive descent, no eval().
 *
 * Grammar:
 *   expr   = term (("+" | "-") term)*
 *   term   = unary (("*" | "/" | "%") unary)*
 *   unary  = ("-" | "+") unary | power   // so -2^2 = -(2^2) = -4
 *   power  = call ("^" unary)?           // right-associative: 2^3^2 = 2^9
 *   call   = IDENT "(" expr ")" | primary
 *   primary = NUMBER | "(" expr ")" | CONST
 */

type Token =
  | { kind: "num"; value: number }
  | { kind: "op"; value: string }
  | { kind: "ident"; value: string };

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log10: Math.log10,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export class CalculatorError extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      // Accepts 1250, 1,250 (grouped thousands), 1.5, .5 and 2e3.
      const match = /^(?:\d{1,3}(?:,\d{3})+(?:\.\d*)?|\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(source.slice(i));
      if (!match) throw new CalculatorError(`Invalid number at position ${i + 1}.`);
      tokens.push({ kind: "num", value: Number(match[0].replace(/,/g, "")) });
      i += match[0].length;
    } else if (/[a-z]/i.test(ch)) {
      const match = /^[a-z][a-z0-9]*/i.exec(source.slice(i))!;
      tokens.push({ kind: "ident", value: match[0].toLowerCase() });
      i += match[0].length;
    } else if ("+-*/%^()".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
    } else {
      throw new CalculatorError(`Unexpected character "${ch}" at position ${i + 1}.`);
    }
  }
  return tokens;
}

export function evaluate(source: string): number {
  if (source.length > 500) throw new CalculatorError("Expression is too long.");
  const tokens = tokenize(source);
  if (tokens.length === 0) throw new CalculatorError("Expression is empty.");
  let pos = 0;
  let depth = 0;

  const peek = () => tokens[pos];
  const isOp = (value: string) => {
    const t = peek();
    return t?.kind === "op" && t.value === value;
  };
  const expectOp = (value: string) => {
    if (!isOp(value)) throw new CalculatorError(`Expected "${value}".`);
    pos++;
  };

  function expr(): number {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = term();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function term(): number {
    let left = unary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = unary();
      if ((op === "/" || op === "%") && right === 0) throw new CalculatorError("Division by zero.");
      left = op === "*" ? left * right : op === "/" ? left / right : left % right;
    }
    return left;
  }

  function unary(): number {
    if (isOp("-")) {
      pos++;
      return -unary();
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }

  function power(): number {
    const base = call();
    if (isOp("^")) {
      pos++;
      return base ** unary();
    }
    return base;
  }

  function call(): number {
    const t = peek();
    if (t?.kind === "ident" && t.value in FUNCTIONS) {
      pos++;
      expectOp("(");
      const arg = nested();
      expectOp(")");
      return FUNCTIONS[t.value]!(arg);
    }
    return primary();
  }

  function primary(): number {
    const t = peek();
    if (!t) throw new CalculatorError("Unexpected end of expression.");
    if (t.kind === "num") {
      pos++;
      return t.value;
    }
    if (t.kind === "ident") {
      if (t.value in CONSTANTS) {
        pos++;
        return CONSTANTS[t.value]!;
      }
      throw new CalculatorError(`Unknown name "${t.value}".`);
    }
    if (t.value === "(") {
      pos++;
      const value = nested();
      expectOp(")");
      return value;
    }
    throw new CalculatorError(`Unexpected "${t.value}".`);
  }

  function nested(): number {
    if (++depth > 50) throw new CalculatorError("Expression is nested too deeply.");
    const value = expr();
    depth--;
    return value;
  }

  const result = expr();
  if (pos < tokens.length) {
    const t = tokens[pos]!;
    throw new CalculatorError(`Unexpected "${t.value}" after the end of the expression.`);
  }
  if (!Number.isFinite(result)) throw new CalculatorError("Result is not a finite number.");
  return result;
}

/** Formats results without float noise: 0.1 + 0.2 -> "0.3". */
export function formatNumber(value: number): string {
  return Number.parseFloat(value.toPrecision(12)).toString();
}
