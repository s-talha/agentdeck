import { describe, expect, it } from "vitest";
import { CalculatorError, evaluate, formatNumber } from "@/lib/agent/calculator";

describe("calculator", () => {
  it.each([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["12 * (3 + 4)", 84],
    ["2 ^ 3 ^ 2", 512],
    ["-2 ^ 2", -4],
    ["2 ^ -1", 0.5],
    ["10 % 4", 2],
    ["sqrt(81) + abs(-3)", 12],
    ["1,250 * 1.25", 1562.5],
    ["2e3 / 4", 500],
    [".5 + .25", 0.75],
  ])("evaluates %s", (expression, expected) => {
    expect(evaluate(expression)).toBeCloseTo(expected, 10);
  });

  it("knows pi and e", () => {
    expect(evaluate("2 * pi")).toBeCloseTo(2 * Math.PI);
    expect(evaluate("ln(e)")).toBe(1);
  });

  it.each([
    ["", "empty"],
    ["1 / 0", "Division by zero"],
    ["2 +", "Unexpected end"],
    ["(1 + 2", 'Expected ")"'],
    ["foo(1)", 'Unknown name "foo"'],
    ["1 2", 'Unexpected "2"'],
    ["exit(1)", 'Unknown name "exit"'],
    ["1; drop", 'Unexpected character ";"'],
  ])("rejects %j", (expression, message) => {
    expect(() => evaluate(expression)).toThrow(CalculatorError);
    expect(() => evaluate(expression)).toThrow(message);
  });

  it("limits nesting depth", () => {
    expect(() => evaluate("(".repeat(60) + "1" + ")".repeat(60))).toThrow("nested too deeply");
  });

  it("formats without floating point noise", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(45718.75)).toBe("45718.75");
  });
});
