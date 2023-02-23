/** @odoo-module **/

import { Component, onWillUnmount, useEffect, useRef } from "@odoo/owl";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { FormViewDialog } from "@web/views/view_dialogs/form_view_dialog";
import { Layout } from "@web/search/layout";
import { standardViewProps } from "@web/views/standard_view_props";
import { useModel } from "@web/views/model";
import { useService } from "@web/core/utils/hooks";
import { ViewScaleSelector } from "@web/views/view_components/view_scale_selector";

import { useSetupView } from "@web/views/view_hook";

const { DateTime } = luxon;

export class GanttController extends Component {
    static components = {
        Dropdown,
        DropdownItem,
        Layout,
        ViewScaleSelector,
    };
    static props = {
        ...standardViewProps,
        Model: Function,
        Renderer: Function,
        buttonTemplate: String,
        modelParams: Object,
        scrollPosition: { type: Object, optional: true },
    };
    static template = "web_gantt.GanttController";

    setup() {
        this.actionService = useService("action");
        this.dialogService = useService("dialog");
        this.orm = useService("orm");

        this.model = useModel(this.props.Model, this.props.modelParams);
        useSetupView({
            rootRef: useRef("root"),
            getLocalState: () => {
                return { metaData: this.model.metaData };
            },
        });

        onWillUnmount(() => this.closeDialog?.());

        const rootRef = useRef("root");
        useEffect(
            (showNoContentHelp) => {
                if (showNoContentHelp) {
                    const realRows = [
                        ...rootRef.el.querySelectorAll(
                            ".o_gantt_row_header:not(.o_sample_data_disabled)"
                        ),
                    ];
                    // interactive rows created in extensions (fromServer undefined)
                    const headerContainerWidth =
                        rootRef.el.querySelector(".o_gantt_header").clientHeight;

                    const offset = realRows.reduce(
                        (current, el) => current + el.clientHeight,
                        headerContainerWidth
                    );

                    const noContentHelperEl = rootRef.el.querySelector(".o_view_nocontent");
                    noContentHelperEl.style.top = `${offset}px`;
                }
            },
            () => [this.showNoContentHelp]
        );
    }

    get className() {
        if (this.env.isSmall) {
            const classList = (this.props.className || "").split(" ");
            classList.push("o_action_delegate_scroll");
            return classList.join(" ");
        }
        return this.props.className;
    }

    get displayExpandCollapseButtons() {
        return this.model.data.rows[0]?.isGroup; // all rows on same level have same type
    }

    get showNoContentHelp() {
        return this.model.useSampleModel;
    }

    /**
     * @param {Record<string, any>} [context]
     */
    create(context) {
        const { createAction } = this.model.metaData;
        if (createAction) {
            this.actionService.doAction(createAction, {
                additionalContext: context,
                onClose: () => {
                    this.model.fetchData();
                },
            });
        } else {
            this.openDialog({ context });
        }
    }

    getTodayDay() {
        return DateTime.local().day;
    }

    /**
     * Opens dialog to add/edit/view a record
     *
     * @param {Record<string, any>} props FormViewDialog props
     * @param {Record<string, any>} [options={}]
     */
    openDialog(props, options = {}) {
        const { canDelete, canEdit, resModel, formViewId: viewId } = this.model.metaData;

        const title = props.title || (props.resId ? this.env._t("Open") : this.env._t("Create"));

        let removeRecord;
        if (canDelete && props.resId) {
            removeRecord = () => {
                return new Promise((resolve) => {
                    this.dialogService.add(ConfirmationDialog, {
                        body: this.env._t("Are you sure to delete this record?"),
                        confirm: async () => {
                            await this.orm.unlink(resModel, [props.resId]);
                            resolve();
                        },
                        cancel: () => {},
                    });
                });
            };
        }

        this.closeDialog = this.dialogService.add(
            FormViewDialog,
            {
                title,
                resModel,
                viewId,
                resId: props.resId,
                mode: canEdit ? "edit" : "readonly",
                context: props.context,
                removeRecord,
            },
            {
                ...options,
                onClose: () => {
                    this.closeDialog = null;
                    this.model.fetchData();
                },
            }
        );
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    onAddClicked() {
        const { focusDate, scale } = this.model.metaData;
        const start = focusDate.startOf(scale.id);
        const stop = focusDate.endOf(scale.id);
        const context = this.model.getDialogContext({ start, stop, withDefault: true });
        this.create(context);
    }

    onCollapseClicked() {
        this.model.collapseRows();
    }

    onExpandClicked() {
        this.model.expandRows();
    }

    onNextPeriodClicked() {
        this.model.setFocusDate("next");
    }

    onPreviousPeriodClicked() {
        this.model.setFocusDate("previous");
    }

    onTodayClicked() {
        this.model.setFocusDate();
    }
}
