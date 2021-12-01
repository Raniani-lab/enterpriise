/** @odoo-module **/
import { registry } from "@web/core/registry";
import { download } from "@web/core/network/download";
import { useService } from "@web/core/utils/hooks";

import { AbstractSpreadsheetAction } from "./abstract_spreadsheet_action";

import SpreadsheetComponent from "./spreadsheet_component";
import { SpreadsheetControlPanel } from "./control_panel/spreadsheet_control_panel";
import { SpreadsheetName } from "./control_panel/spreadsheet_name";

import { UNTITLED_SPREADSHEET_NAME } from "../o_spreadsheet/constants";

const { useState, useRef } = owl.hooks;

export class SpreadsheetAction extends AbstractSpreadsheetAction {
  setup() {
    super.setup();
    this.orm = useService("orm");
    this.actionService = useService("action");
    this.spreadsheetRef = useRef("spreadsheet");
    this.notificationMessage = this.env._t(
      "New spreadsheet created in Documents"
    );

    this.state = useState({
      numberOfConnectedUsers: 1,
      isSynced: true,
      isFavorited: false,
      spreadsheetName: UNTITLED_SPREADSHEET_NAME,
    });
  }

  async willStart() {
    await super.willStart();
    this.transportService = useService("spreadsheet_collaborative").getCollaborativeChannel(owl.Component.env, this.resId);
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
   * @param {OdooEvent} ev
   */
  async _onDownload(ev) {
    await download({
      url: "/documents/xlsx",
      data: {
        zip_name: `${ev.detail.name}.xlsx`,
        files: JSON.stringify(ev.detail.files),
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
   * @param {OdooEvent} ev
   */
  _onSpreadsheetSyncStatus(ev) {
    this.state.isSynced = ev.detail.synced;
    this.state.numberOfConnectedUsers = ev.detail.numberOfConnectedUsers;
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
  async _onMakeCopy(ev) {
    const { data, thumbnail } = ev.detail;
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
    const data = {
      name: UNTITLED_SPREADSHEET_NAME,
      mimetype: "application/o-spreadsheet",
      raw: "{}",
      handler: "spreadsheet",
    };
    const id = await this.orm.create("documents.document", data);
    this._openSpreadsheet(id);
  }

  async _onSpreadsheetSaved(ev) {
    const { data, thumbnail } = ev.detail;

    await this.orm.write("documents.document", [this.resId], {
      thumbnail,
      raw: JSON.stringify(data),
      mimetype: "application/o-spreadsheet",
    });
  }

  /**
   * Saves the spreadsheet name change.
   * @param {OdooEvent} ev
   * @returns {Promise}
   */
  async _onSpreadSheetNameChanged(ev) {
    const { name } = ev.detail;
    this.state.spreadsheetName = name;
    this.trigger("controller-title-updated", this.state.spreadsheetName);
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
