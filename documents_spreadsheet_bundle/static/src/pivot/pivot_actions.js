/** @odoo-module alias=documents_spreadsheet.pivot_actions default=0 **/

import { _t } from "@web/core/l10n/translation";
import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import { PivotDialog } from "./spreadsheet_pivot_dialog";

const { createFullMenuItem } = spreadsheet.helpers;

export const REINSERT_PIVOT_CHILDREN = (env) =>
  env.model.getters.getPivotIds().map((pivotId, index) =>
    createFullMenuItem(`reinsert_pivot_${pivotId}`, {
      name: env.model.getters.getPivotDisplayName(pivotId),
      sequence: index,
      action: async (env) => {
        // We need to fetch the cache without the global filters,
        // to get the full pivot structure.
        await env.model.getters.waitForPivotDataReady(pivotId, {
          initialDomain: true,
          force: true,
        });
        const zone = env.model.getters.getSelectedZone();
        env.model.dispatch("REBUILD_PIVOT", {
          id: pivotId,
          anchor: [zone.left, zone.top],
        });
        if (env.model.getters.getActiveFilterCount()) {
          await env.model.getters.waitForPivotDataReady(pivotId, {
            initialDomain: false,
            force: true,
          });
        }
        env.model.dispatch("EVALUATE_CELLS", {
          sheetId: env.model.getters.getActiveSheetId(),
        });
      },
    })
  );

export const INSERT_PIVOT_CELL_CHILDREN = (env) =>
  env.model.getters.getPivotIds().map((pivotId, index) =>
    createFullMenuItem(`insert_pivot_cell_${pivotId}`, {
      name: env.model.getters.getPivotDisplayName(pivotId),
      sequence: index,
      action: async (env) => {
        const sheetId = env.model.getters.getActiveSheetId();
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
        await env.model.getters.waitForPivotDataReady(pivotId, { force: true });
        env.model.dispatch("EVALUATE_CELLS", {
          sheetId: env.model.getters.getActiveSheetId(),
        });


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
