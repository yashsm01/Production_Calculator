/**
 * formulaEngine.js
 * -------------------------------------------------------------------
 * The core calculation engine.
 *
 * Given a list of parameters (with key & formula) and a map of
 * user-supplied input values, this engine:
 *
 *   1. Topologically sorts parameters by dependency
 *   2. Builds a scope object seeded with inputs
 *   3. Evaluates each formula in order using mathjs.evaluate
 *   4. Returns the full scope (inputs + all calculated values)
 *
 * IMPORTANT: Uses mathjs.evaluate — NOT eval().
 * -------------------------------------------------------------------
 */

const { create, all } = require('mathjs');
const { topologicalSort, collectAllInputVariables } = require('./dependencyResolver');

// Create a mathjs instance with all functions available
const math = create(all);

/**
 * Run the formula engine.
 *
 * @param {Array<{key:string, formula:string, name:string}>} parameters
 *   All parameters belonging to the selected category.
 *
 * @param {Object} inputs
 *   User-supplied values, e.g. { length: 10, width: 5, rate: 200 }
 *
 * @returns {{ scope: Object, order: string[] }}
 *   scope  — full scope object with all inputs + calculated values
 *   order  — parameter keys in evaluation order (for debugging)
 *
 * @throws Error if formula is invalid, input is missing, or circular dep found
 */
async function runEngine(parameters, inputs) {
  if (!parameters || parameters.length === 0) {
    return { scope: { ...inputs }, order: [] };
  }

  // ── Step 1: Topological sort ────────────────────────────────────────────────
  const sortedParams = topologicalSort(parameters);

  // ── Step 2: Check for missing inputs ───────────────────────────────────────
  const requiredInputs = collectAllInputVariables(parameters);
  const missingInputs = requiredInputs.filter(
    (v) => inputs[v] === undefined || inputs[v] === null || inputs[v] === ''
  );
  if (missingInputs.length > 0) {
    throw new Error(`Missing required input values: ${missingInputs.join(', ')}`);
  }

  // ── Step 3: Build scope with validated numeric inputs ──────────────────────
  const scope = {};
  for (const [key, value] of Object.entries(inputs)) {
    const numVal = Number(value);
    if (isNaN(numVal)) {
      throw new Error(`Input "${key}" must be a number, got: "${value}"`);
    }
    scope[key] = numVal;
  }

  // ── Step 4: Evaluate parameters in topological order ──────────────────────
  const order = [];
  for (const param of sortedParams) {
    try {
      const result = math.evaluate(param.formula, scope);

      // Ensure result is a plain number (not a mathjs Unit or Complex)
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
        `Error evaluating parameter "${param.name}" (key: "${param.key}"): ${err.message}`
      );
    }
  }

  return { scope, order };
}

/**
 * Validate a formula string without evaluating it.
 * Returns { valid: true } or { valid: false, error: string }
 *
 * @param {string} formula
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
