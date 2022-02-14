/** @odoo-module alias=documents_spreadsheet.pivot_actions default=0 **/

import { _t } from "@web/core/l10n/translation";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { SpreadsheetPivotModel } from "./pivot_model";
import { PivotDialog } from "./spreadsheet_pivot_dialog";

const { createFullMenuItem } = spreadsheet.helpers;

export const REINSERT_PIVOT_CHILDREN = (env) =>
  env.model.getters.getPivotIds().map((pivotId, index) =>
    createFullMenuItem(`reinsert_pivot_${pivotId}`, {
      name: env.model.getters.getPivotDisplayName(pivotId),
      sequence: index,
      action: async (env) => {
        const dataSource = env.model.getters.getSpreadsheetPivotDataSource(pivotId);
        const definition = dataSource.definition;
        const model = env.model.config.odooViewsModels.createModel(SpreadsheetPivotModel, definition);
        await model.load(definition.searchParams);
        const table = model.getSpreadsheetStructure().export();
        const zone = env.model.getters.getSelectedZone();
        env.model.dispatch("RE_INSERT_PIVOT", {
          id: pivotId,
          col: zone.left,
          row: zone.top,
          sheetId: env.model.getters.getActiveSheetId(),
          table,
        });
        env.model.dispatch("REFRESH_PIVOT", { id: pivotId });
      },
    })
  );

export const INSERT_PIVOT_CELL_CHILDREN = (env) =>
  env.model.getters.getPivotIds().map((pivotId, index) =>
    createFullMenuItem(`insert_pivot_cell_${pivotId}`, {
      name: env.model.getters.getPivotDisplayName(pivotId),
      sequence: index,
      action: async (env) => {
        env.model.dispatch("REFRESH_PIVOT", { id: pivotId });
        const sheetId = env.model.getters.getActiveSheetId();
        await env.model.getters.getAsyncSpreadsheetPivotModel(pivotId);
        env.model.dispatch("EVALUATE_CELLS", { sheetId });
        const [col, row] = env.model.getters.getMainCell(
          sheetId,
          ...env.model.getters.getPosition()
        );
        const insertPivotValueCallback = (formula) => {
          env.model.dispatch("UPDATE_CELL", {
            sheetId,
            col,
            row,
            content: formula,
          });
        };

        const getMissingValueDialogTitle = () => {
          const title = _t("Insert pivot cell");
          const pivotTitle = getPivotTitle();
          if (pivotTitle) {
            return `${title} - ${pivotTitle}`;
          }
          return title;
        }

        const getPivotTitle = () => {
          if (pivotId) {
            return env.model.getters.getPivotDisplayName(pivotId);
          }
          return "";
        }

        env.services.dialog.add(
          PivotDialog,
          {
            title: getMissingValueDialogTitle(),
            pivotId,
            insertPivotValueCallback,
            getters: env.model.getters,
          },
        );
      },
    })
  );
