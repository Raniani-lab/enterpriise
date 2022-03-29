/** @odoo-module **/
import { registry } from "@web/core/registry";
import { download } from "@web/core/network/download";
import { useService } from "@web/core/utils/hooks";

import { AbstractSpreadsheetAction } from "./abstract_spreadsheet_action";

import SpreadsheetComponent from "./spreadsheet_component";
import { SpreadsheetControlPanel } from "./control_panel/spreadsheet_control_panel";
import { SpreadsheetName } from "./control_panel/spreadsheet_name";

import { UNTITLED_SPREADSHEET_NAME } from "../o_spreadsheet/constants";
import { createEmptySpreadsheet } from "../o_spreadsheet/helpers";

const { Component, useState } = owl;

export class SpreadsheetAction extends AbstractSpreadsheetAction {
  setup() {
    super.setup();
    this.orm = useService("orm");
    this.actionService = useService("action");
    this.notificationMessage = this.env._t(
      "New spreadsheet created in Documents"
    );

    this.state = useState({
      numberOfConnectedUsers: 1,
      isSynced: true,
      isFavorited: false,
      spreadsheetName: UNTITLED_SPREADSHEET_NAME,
    });

    this.spreadsheetCollaborative = useService("spreadsheet_collaborative");
  }

  exposeSpreadsheet(spreadsheet) {
    this.spreadsheet = spreadsheet;
  }

  async onWillStart() {
    await super.onWillStart();
    this.transportService = this.spreadsheetCollaborative.getCollaborativeChannel(Component.env, this.resId);
  }

  async _fetchData() {
    const record = await this.orm.call(
      "documents.document",
      "join_spreadsheet_session",
      [this.resId]
    );
    return record;
  }

  /**
   * @override
   */
  _initializeWith(record) {
    this.state.isFavorited = record.is_favorited;
    this.spreadsheetData = JSON.parse(record.raw);
    this.stateUpdateMessages = record.revisions;
    this.snapshotRequested = record.snapshot_requested;
    this.state.spreadsheetName = record.name;
    this.isReadonly = record.isReadonly;
  }

  /**
   * @private
   * @param {Object}
   */
  async _onDownload({ name, files }) {
    await download({
      url: "/documents/xlsx",
      data: {
        zip_name: `${name}.xlsx`,
        files: JSON.stringify(files),
      },
    });
  }

  /**
   * @param {OdooEvent} ev
   * @returns {Promise}
   */
  async _onSpreadSheetFavoriteToggled(ev) {
    this.state.isFavorited = !this.state.isFavorited;
    return await this.orm.call("documents.document", "toggle_favorited", [
      [this.resId],
    ]);
  }

  /**
   * Updates the control panel with the sync status of spreadsheet
   *
   * @param {Object}
   */
  _onSpreadsheetSyncStatus({ synced, numberOfConnectedUsers }) {
    this.state.isSynced = synced;
    this.state.numberOfConnectedUsers = numberOfConnectedUsers;
  }

  /**
   * Reload the spreadsheet if an unexpected revision id is triggered.
   */
  _onUnexpectedRevisionId() {
    this.actionService.doAction("reload_context");
  }

  /**
   * Create a copy of the given spreadsheet and display it
   */
  async _onMakeCopy({ data, thumbnail }) {
    const defaultValues = {
      mimetype: "application/o-spreadsheet",
      raw: JSON.stringify(data),
      spreadsheet_snapshot: false,
      thumbnail,
    };
    const id = await this.orm.call("documents.document", "copy", [this.resId], {
      default: defaultValues,
    });
    this._openSpreadsheet(id);
  }

  /**
   * Create a new sheet and display it
   */
  async _onNewSpreadsheet() {
    const id = await createEmptySpreadsheet(this.orm);
    this._openSpreadsheet(id);
  }

  async _onSpreadsheetSaved({ data, thumbnail }) {
    await this.orm.write("documents.document", [this.resId], {
      thumbnail,
      raw: JSON.stringify(data),
      mimetype: "application/o-spreadsheet",
    });
  }

  /**
   * Saves the spreadsheet name change.
   * @param {Object} detail
   * @returns {Promise}
   */
  async _onSpreadSheetNameChanged(detail) {
    const { name } = detail;
    this.state.spreadsheetName = name;
    this.env.config.setDisplayName(this.state.spreadsheetName);
    return await this.orm.write("documents.document", [this.resId], { name });
  }
}

SpreadsheetAction.template = "documents_spreadsheet.SpreadsheetAction";
SpreadsheetAction.components = {
  SpreadsheetComponent,
  SpreadsheetControlPanel,
  SpreadsheetName,
};

registry
  .category("actions")
  .add("action_open_spreadsheet", SpreadsheetAction, { force: true });
