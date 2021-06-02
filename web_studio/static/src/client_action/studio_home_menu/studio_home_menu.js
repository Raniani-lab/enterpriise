/** @odoo-module **/
import { HomeMenu } from "@web_enterprise/webclient/home_menu/home_menu";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/service_hook";
import { IconCreator } from "../icon_creator/icon_creator";
import { NotEditableActionError } from "../../studio_service";
import { _lt } from "@web/core/l10n/translation";

const NEW_APP_BUTTON = {
    isNewAppButton: true,
    label: "New App",
    webIconData: "/web_studio/static/src/img/default_icon_app.png",
};

class StudioHomeMenuDialog extends Dialog {}
StudioHomeMenuDialog.title = _lt("Edit Application Icon");
StudioHomeMenuDialog.contentClass = "o_web_studio_edit_menu_icon_modal";
StudioHomeMenuDialog.size = "modal-md";
StudioHomeMenuDialog.bodyTemplate = "web_studio.StudioHomeMenuDialogBody";
StudioHomeMenuDialog.footerTemplate = "web_studio.StudioHomeMenuDialogFooter";
StudioHomeMenuDialog.components = Object.assign({}, Dialog.components, { IconCreator });
/**
 * Studio home menu
 *
 * Studio version of the standard enterprise home menu. It has roughly the same
 * implementation, with the exception of the app icon edition and the app creator.
 * @extends HomeMenu
 */
export class StudioHomeMenu extends HomeMenu {
    /**
     * @param {Object} props
     * @param {Object[]} props.apps application icons
     * @param {string} props.apps[].action
     * @param {number} props.apps[].id
     * @param {string} props.apps[].label
     * @param {string} props.apps[].parents
     * @param {(boolean|string|Object)} props.apps[].webIcon either:
     *      - boolean: false (no webIcon)
     *      - string: path to Odoo icon file
     *      - Object: customized icon (background, class and color)
     * @param {string} [props.apps[].webIconData]
     * @param {string} props.apps[].xmlid
     */
    constructor() {
        super(...arguments);

        this.user = useService("user");
        this.studio = useService("studio");
        this.notifications = useService("notification");
        this.dialog = useService("dialog");
        this.dialogId = null;

        this.state.editedAppData = {};
        this.closeDialog = this.closeDialog.bind(this);
        this.onSave = this.onSave.bind(this);
        this.onIconChanged = this.onIconChanged.bind(this);
    }

    mounted() {
        super.mounted();
        this.canEditIcons = true;
        this.el.classList.add("o_studio_home_menu");
    }

    async willUpdateProps(nextProps) {
        this.availableApps = this.state.query.length
            ? this._filter(nextProps.apps)
            : nextProps.apps;
    }

    //--------------------------------------------------------------------------
    // Getters
    //--------------------------------------------------------------------------

    get displayedApps() {
        return super.displayedApps.concat([NEW_APP_BUTTON]);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    closeDialog() {
        this.dialog.close(this.dialogId);
        delete this.initialAppData;
    }

    /**
     * @override
     * @private
     */
    async _openMenu(menu) {
        if (menu.isNewAppButton) {
            this.canEditIcons = false;
            return this.studio.open(this.studio.MODES.APP_CREATOR);
        } else {
            try {
                await this.studio.open(this.studio.MODES.EDITOR, menu.actionID);
                this.menus.setCurrentMenu(menu);
            } catch (e) {
                if (e instanceof NotEditableActionError) {
                    const options = { type: "danger" };
                    this.notifications.add(
                        this.env._t("This action is not editable by Studio"),
                        options
                    );
                    return;
                }
                throw e;
            }
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async onSave() {
        const { appId, type } = this.initialAppData;
        let iconValue;
        if (this.state.editedAppData.type !== type) {
            // different type
            if (this.state.editedAppData.type === "base64") {
                iconValue = this.state.editedAppData.uploaded_attachment_id;
            } else {
                const { iconClass, color, backgroundColor } = this.state.editedAppData;
                iconValue = [iconClass, color, backgroundColor];
            }
        } else if (this.state.editedAppData.type === "custom_icon") {
            // custom icon changed
            const { iconClass, color, backgroundColor } = this.state.editedAppData;
            if (
                this.initialAppData.iconClass !== iconClass ||
                this.initialAppData.color !== color ||
                this.initialAppData.backgroundColor !== backgroundColor
            ) {
                iconValue = [iconClass, color, backgroundColor];
            }
        } else if (this.state.editedAppData.uploaded_attachment_id) {
            // new attachment
            iconValue = this.state.editedAppData.uploaded_attachment_id;
        }

        if (iconValue) {
            await this.rpc("/web_studio/edit_menu_icon", {
                context: this.user.context,
                icon: iconValue,
                menu_id: appId,
            });
            await this.menus.reload();
        }
        this.closeDialog();
    }

    /**
     * @private
     * @param {Object} app
     */
    onEditIconClick(app) {
        if (!this.canEditIcons) {
            return;
        }
        if (app.webIconData) {
            this.state.editedAppData = {
                webIconData: app.webIconData,
                type: "base64",
            };
        } else {
            this.state.editedAppData = {
                backgroundColor: app.webIcon.backgroundColor,
                color: app.webIcon.color,
                iconClass: app.webIcon.iconClass,
                type: "custom_icon",
            };
        }
        this.initialAppData = Object.assign(
            {
                appId: app.id,
            },
            this.state.editedAppData
        );
        const dialogProps = {
            onSave: this.onSave,
            closeDialog: this.closeDialog,
            onIconChanged: this.onIconChanged,
            editedAppData: this.state.editedAppData,
        };
        this.dialogId = this.dialog.open(StudioHomeMenuDialog, dialogProps, {
            onCloseCallback: () => {
                delete this.initialAppData;
            },
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    onIconChanged(ev) {
        for (const key in this.state.editedAppData) {
            delete this.state.editedAppData[key];
        }
        for (const key in ev.detail) {
            this.state.editedAppData[key] = ev.detail[key];
        }
    }

    // AAB: i think it's no longer useful
    // /**
    //  * @private
    //  */
    // _onNewAppClick() {
    //     this.canEditIcons = false;
    // }
}

StudioHomeMenu.components = Object.assign({}, HomeMenu.components, {
    StudioHomeMenuDialog,
});
StudioHomeMenu.props = { apps: HomeMenu.props.apps };
StudioHomeMenu.template = "web_studio.StudioHomeMenu";
