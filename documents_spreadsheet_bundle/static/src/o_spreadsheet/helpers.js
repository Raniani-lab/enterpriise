/** @odoo-module */

import  spreadsheet  from "./o_spreadsheet_extended";
import { DataSources } from "./data_sources/data_sources";

const Model = spreadsheet.Model;

/**
 * Get the intersection of two arrays
 *
 * @param {Array} a
 * @param {Array} b
 *
 * @private
 * @returns {Array} intersection between a and b
 */
export function intersect(a, b) {
  return a.filter((x) => b.includes(x));
}

/**
 * Given an object of form {"1": {...}, "2": {...}, ...} get the maximum ID used
 * in this object
 * If the object has no keys, return 0
 *
 * @param {Object} o an object for which the keys are an ID
 *
 * @returns {number}
 */
export function getMaxObjectId(o) {
  const keys = Object.keys(o);
  if (!keys.length) {
    return 0;
  }
  const nums = keys.map((id) => parseInt(id, 10));
  const max = Math.max(...nums);
  return max;
}


/**
 * see https://stackoverflow.com/a/30106551
 * @param {string} string
 * @returns {string}
 */
function utf8ToBase64(str) {
  // first we use encodeURIComponent to get percent-encoded UTF-8,
  // then we convert the percent encodings into raw bytes which
  // can be fed into btoa.
  return btoa(
    encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      function toSolidBytes(match, p1) {
        return String.fromCharCode("0x" + p1);
      }
    )
  );
}

/**
 * see https://stackoverflow.com/a/30106551
 * @param {string} string
 * @returns {string}
 */
function base64ToUtf8(str) {
  // Going backwards: from bytestream, to percent-encoding, to original string.
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

/**
 * Encode a json to a base64 string
 * @param {object} json
 */
export function jsonToBase64(json) {
  return utf8ToBase64(JSON.stringify(json));
}

/**
 * Decode a base64 encoded json
 * @param {string} string
 */
export function base64ToJson(string) {
  return JSON.parse(base64ToUtf8(string));
}

/**
 * Takes a template id as input, will convert the formulas
 * from relative to absolute in a way that they can be used to create a sheet.
 *
 * @param {Function} rpc
 * @param {number} templateId
 * @returns {Promise<Object>} spreadsheetData
 */
export async function getDataFromTemplate(env, orm, templateId) {
  let [{ data }] = await orm.read(
    "spreadsheet.template",
    [templateId],
    ["data"]
  );
  data = base64ToJson(data);

  const model = new Model(data, {
    mode: "headless",
    dataSources: new DataSources(orm),
  });
  await model.config.dataSources.waitForAllLoaded();
  const proms = [];
  for (const pivotId of model.getters.getPivotIds()) {
    proms.push(model.getters.getSpreadsheetPivotModel(pivotId).prepareForTemplateGeneration());
  }
  await Promise.all(proms);
  model.dispatch("CONVERT_PIVOT_FROM_TEMPLATE");
  return model.exportData();
}
