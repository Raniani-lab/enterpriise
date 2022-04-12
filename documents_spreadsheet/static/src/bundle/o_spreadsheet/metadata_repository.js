/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
const { EventBus } = owl;

/**
 * This class is used to provide facilities to fetch some common data. It's
 * used in the data sources to obtain the fields (fields_get) and the display
 * name of the models (search_read on ir.model).
 *
 * It also manages the labels of all the spreadsheet models (labels of basic
 * fields or display name of relational fields).
 *
 * All the results are cached in order to avoid useless rpc calls, basically
 * for different entities that are defined on the same model.
 *
 * Implementation note:
 * For the labels, when someone is asking for a label which is not loaded yet,
 * the proxy returns directly (undefined) and a request for a name_get will
 * be triggered. All the requests created are batched and send, with only one
 * request per model, after a clock cycle.
 * At the end of this process, an event is triggered (labels-fetched)
 */
 export class MetadataRepository extends EventBus {
  constructor(orm) {
      super();
      this.orm = orm.silent;
      /**
       * Contains the labels of records. It's organized in the following way:
       * {
       *     "crm.lead": {
       *         "city": {
       *             "bruxelles": "Bruxelles",
       *         }
       *     },
       * }
       */
      this._labels = {};

      /**
       * Contains the display name of many2one records. It's organized in the
       * following way:
       * {
       *     "partner": {
       *         "10": "Raoul"
       *     },
       * }
       */
      this._recordsDisplayName = {};

      /**
       * Cache for the fields_get requests, with technical name as key
       */
      this._fieldsGet = {};

      /**
       * Cache for the display name of the ir.models, with technical name as key
       */
      this._modelNameGet = {};

      /**
       * Fetching stuff, their roles is to collect the models-ids to fetch
       * in the next clock cycle.
       */
      this._fetchingPromise = undefined;
      this._pending = {};
  }

  /**
   * Get the display name of the given model
   *
   * @param {string} model Technical name
   * @returns {Promise<string>} Display name of the model
   */
  async modelDisplayName(model) {
      if (!(model in this._modelNameGet)) {
          const result = await this.orm.searchRead("ir.model", [["model", "=", model]], ["name"]);
          this._modelNameGet[model] = (result && result[0] && result[0].name) || "";
      }
      return this._modelNameGet[model];
  }

  /**
   * Get the list of fields for the given model
   *
   * @param {string} model Technical name
   * @returns {Promise<Object>} List of fields (result of fields_get)
   */
  async fieldsGet(model) {
      if (!(model in this._fieldsGet)) {
          this._fieldsGet[model] = await this.orm.call(model, "fields_get");
      }
      return this._fieldsGet[model];
  }

  /**
   * Add a label to the cache
   *
   * @param {string} model
   * @param {string} field
   * @param {any} value
   * @param {string} label
   */
  registerLabel(model, field, value, label) {
      if (!this._labels[model]) {
          this._labels[model] = {};
      }
      if (!this._labels[model][field]) {
          this._labels[model][field] = {};
      }
      this._labels[model][field][value] = label;
  }

  /**
   * Get the label associated with the given arguments
   *
   * @param {string} model
   * @param {string} field
   * @param {any} value
   * @returns {string}
   */
  getLabel(model, field, value) {
      return (
          this._labels[model] && this._labels[model][field] && this._labels[model][field][value]
      );
  }

  /**
   * Add a display name to the cache
   *
   * @param {string} model
   * @param {number} id
   * @param {string|Error} displayName
   */
  addRecordDisplayName(model, id, displayName) {
      if (!this._recordsDisplayName[model]) {
          this._recordsDisplayName[model] = {};
      }
      this._recordsDisplayName[model][id] = displayName;
  }

  /**
   * Get the display name associated to the given model-id
   * If the name is not yet loaded, a rpc will be triggered in the next clock
   * cycle.
   *
   * @param {string} model
   * @param {number} id
   * @returns {string}
   */
  getRecordDisplayName(model, id) {
      if (!this._recordsDisplayName[model]) {
          this._recordsDisplayName[model] = {};
      }
      if (!(id in this._recordsDisplayName[model])) {
          if (!(model in this._pending)) {
              this._pending[model] = [];
          }
          this._pending[model].push(id);
          this._triggerFetching();
          return undefined;
      }
      const label = this._recordsDisplayName[model] && this._recordsDisplayName[model][id];
      if (label instanceof Error) {
          throw label;
      }
      return label;
  }

  /**
   * Trigger a fetching for the next clock cycle
   *
   * @private
   */
  _triggerFetching() {
      if (this._fetchingPromise) {
          return;
      }
      this._fetchingPromise = Promise.resolve().then(
          () =>
              new Promise(async (resolve, reject) => {
                  try {
                      const promises = [];
                      for (const [model, ids] of Object.entries(this._pending)) {
                          if (!ids.length) {
                              continue;
                          }
                          const prom = this.orm
                              .call(model, "name_get", [Array.from(new Set(ids))])
                              .then((result) => {
                                  for (const value of result) {
                                      this.addRecordDisplayName(model, value[0], value[1]);
                                  }
                                  return result;
                              })
                              .catch((e) => {
                                  const proms = [];
                                  for (const id of ids) {
                                      const prom = this.orm
                                          .call(model, "name_get", [[id]])
                                          .then((result) => {
                                              for (const value of result) {
                                                  this.addRecordDisplayName(model, value[0], value[1]);
                                              }
                                              return result;
                                          })
                                          .catch(() => {
                                              const error = new Error(
                                                  _.str.sprintf(
                                                      _t(
                                                          "Unable to fetch the label of %s of model %s"
                                                      ),
                                                      id,
                                                      model
                                                  )
                                              );
                                              this.addRecordDisplayName(model, id, error);
                                              return true;
                                          });
                                      proms.push(prom);
                                  }
                                  return Promise.allSettled(proms);
                              });
                          promises.push(prom);
                      }
                      this._pending = {};
                      await Promise.allSettled(promises);
                      this.trigger("labels-fetched");
                      resolve();
                  } catch (e) {
                      reject(e);
                  } finally {
                      this._fetchingPromise = undefined;
                  }
              })
      );
  }
}
