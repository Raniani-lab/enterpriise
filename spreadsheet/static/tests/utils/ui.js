/** @odoo-module */

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { registerCleanup } from "@web/../tests/helpers/cleanup";
import { getFixture } from "@web/../tests/helpers/utils";
import { loadJS } from "@web/core/assets";

const { App } = owl;
const { Spreadsheet } = spreadsheet

/** @typedef {import("@spreadsheet/o_spreadsheet/o_spreadsheet").Model} Model */

/**
 * Mount o-spreadsheet component with the given spreadsheet model
 * @param {Model} model
 * @returns {Promise<HTMLElement>}
 */
export async function mountSpreadsheet(model) {
  await loadJS("/web/static/lib/Chart/Chart.js");
  const app = new App(Spreadsheet, {
      props: { model },
      templates: window.__OWL_TEMPLATES__,
      env: model.config.evalContext.env,
      test: true,
  });
  registerCleanup(() => app.destroy());
  const fixture = getFixture()
  await app.mount(fixture);
  return fixture
}
