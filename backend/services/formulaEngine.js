/**
 * formulaEngine.js
 * -------------------------------------------------------------------
 * The core calculation engine.
 *
 * Input parameters (isInput=true) are user-provided values seeded
 * directly into the scope. Formula parameters are evaluated in
 * topological order using mathjs.evaluate.
 *
 * IMPORTANT: Uses mathjs.evaluate — NOT eval().
 * -------------------------------------------------------------------
 */

const { create, all } = require('mathjs');
const { topologicalSort } = require('./dependencyResolver');

const math = create(all);

/**
 * Run the formula engine.
 *
 * @param {Array} parameters  All parameters for the category.
 *   Each has: { key, formula, name, isInput }
 *
 * @param {Object} inputs
 *   User-supplied values keyed by parameter.key or raw variable name.
 *   e.g. { length: 10, width: 5, density: 2.5, rate: 150 }
 *   Must include values for ALL isInput parameters AND any raw formula variables.
 *
 * @returns {{ scope: Object, order: string[] }}
 */
async function runEngine(parameters, inputs) {
  if (!parameters || parameters.length === 0) {
    return { scope: { ...inputs }, order: [] };
  }

  // ── Step 1: Separate input params from formula params ─────────────────────
  const inputParams = parameters.filter((p) => p.isInput);
  const formulaParams = parameters.filter((p) => !p.isInput);

  // ── Step 2: Validate that all required values are provided ────────────────
  const missingInputs = [];

  // Check user-provided (isInput=true) parameter values
  for (const p of inputParams) {
    if (inputs[p.key] === undefined || inputs[p.key] === null || inputs[p.key] === '') {
      missingInputs.push(`"${p.name}" (${p.key})`);
    }
  }

  // Check raw formula variables (auto-extracted, not any parameter key)
  const allParamKeys = new Set(parameters.map((p) => p.key));
  const { extractVariables } = require('./dependencyResolver');
  for (const p of formulaParams) {
    if (p.formula) {
      const vars = extractVariables(p.formula);
      for (const v of vars) {
        if (!allParamKeys.has(v) && (inputs[v] === undefined || inputs[v] === null || inputs[v] === '')) {
          missingInputs.push(`"${v}"`);
        }
      }
    }
  }

  if (missingInputs.length > 0) {
    // Deduplicate
    const unique = [...new Set(missingInputs)];
    throw new Error(`Missing required input values: ${unique.join(', ')}`);
  }

  // ── Step 3: Build scope — start with all user inputs ─────────────────────
  const scope = {};

  // Seed raw inputs (existing user values) as numbers
  for (const [key, value] of Object.entries(inputs)) {
    const numVal = Number(value);
    if (isNaN(numVal)) {
      throw new Error(`Input "${key}" must be a number, got: "${value}"`);
    }
    scope[key] = numVal;
  }

  // Input parameters are already in scope via the inputs object above.
  // Just make sure each isInput param's key is in scope.
  for (const p of inputParams) {
    if (scope[p.key] === undefined) {
      throw new Error(`Input parameter "${p.name}" (${p.key}) was not provided`);
    }
  }

  // ── Step 4: Topological sort formula params ───────────────────────────────
  const order = [];

  if (formulaParams.length > 0) {
    const sortedParams = topologicalSort(formulaParams);

    // ── Step 5: Evaluate formulas in order ───────────────────────────────────
    for (const param of sortedParams) {
      try {
        const result = math.evaluate(param.formula, scope);

        if (typeof result === 'object' && result !== null && result.toNumber) {
          scope[param.key] = result.toNumber();
        } else if (typeof result !== 'number') {
          throw new Error(`Formula "${param.formula}" did not evaluate to a number`);
        } else {
          scope[param.key] = result;
        }

        order.push(param.key);
      } catch (err) {
        throw new Error(
          `Error evaluating "${param.name}" (${param.key} = ${param.formula}): ${err.message}`
        );
      }
    }
  }

  return { scope, order };
}

/**
 * Validate a formula string without evaluating it.
 */
function validateFormula(formula) {
  try {
    const { parse } = require('mathjs');
    parse(formula);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { runEngine, validateFormula };
