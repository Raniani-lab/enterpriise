/** @odoo-module */
import { useService } from "@web/core/utils/hooks";
import { _lt } from "@web/core/l10n/translation";
import { renderToMarkup } from "@web/core/utils/render";

const { xml, reactive } = owl;

const missingApprovalsTemplate = xml`
    <ul>
        <li t-foreach="missingApprovals" t-as="approval" t-key="approval_index">
            <t t-esc="approval.message or approval.group_id[1]" />
        </li>
    </ul>
`;
const notificationTitle = _lt("The following approvals are missing:");

function getMissingApprovals(entries, rules) {
    const missingApprovals = [];
    const doneApprovals = entries.filter((e) => e.approved).map((e) => e.rule_id[0]);
    rules.forEach((r) => {
        if (!doneApprovals.includes(r.id)) {
            missingApprovals.push(r);
        }
    });
    return missingApprovals;
}

class StudioApproval {
    constructor() {
        this._data = reactive({});
        this._inits = {};

        // Lazy properties to be set by specialization.
        this.orm = null;
        this.studio = null;
        this.notification = null;
        this.resModel = null;
        this.resId = null;
        this.method = null;
        this.action = null;
    }

    get init() {
        if (this.dataKey in this._inits) {
            return this._inits[this.dataKey];
        }
        const prom = this.fetchApprovals().then(() => {
            this._inits[this.dataKey] = null;
        });
        this._inits[this.dataKey] = prom;
        return prom;
    }

    get dataKey() {
        return `${this.resModel}-${this.resId}-${this.method}-${this.action}`;
    }

    get state() {
        if (!(this.dataKey in this._data)) {
            this._data[this.dataKey] = {};
        }
        return this._data[this.dataKey];
    }

    get inStudio() {
        return !!this.studio.mode;
    }

    displayNotification(data) {
        const missingApprovals = getMissingApprovals(data.entries, data.rules);
        this.notification.add(renderToMarkup(missingApprovalsTemplate, { missingApprovals }), {
            type: "warning",
            title: notificationTitle,
        });
    }

    async checkApproval() {
        const args = [this.resModel, this.resId, this.method, this.action];
        const result = await this.orm.call("studio.approval.rule", "check_approval", args);
        // trigger a refresh of the relevant validation widget since validation
        // could happen server side
        const approved = result.approved;
        delete result.approved;
        if (!approved) {
            this.displayNotification(result);
        }
        this.fetchApprovals(); // don't wait
        return approved;
    }

    async fetchApprovals() {
        const args = [this.resModel, this.method, this.action];
        const kwargs = {
            res_id: !this.studio.mode && this.resId,
        };
        Object.assign(this.state, { syncing: true });
        const spec = await this.orm.silent.call(
            "studio.approval.rule",
            "get_approval_spec",
            args,
            kwargs
        );
        Object.assign(this.state, spec, { syncing: false });
    }

    /**
     * Create or update an approval entry for a specified rule server-side.
     * @private
     * @param {Number} ruleId
     * @param {Boolean} approved
     */
    async setApproval(ruleId, approved) {
        try {
            await this.orm.call("studio.approval.rule", "set_approval", [[ruleId]], {
                res_id: this.resId,
                approved,
            });
        } finally {
            await this.fetchApprovals();
        }
    }

    /**
     * Delete an approval entry for a given rule server-side.
     * @private
     * @param {Number} ruleId
     */
    async cancelApproval(ruleId) {
        try {
            await this.orm.call("studio.approval.rule", "delete_approval", [[ruleId]], {
                res_id: this.resId,
            });
        } finally {
            await this.fetchApprovals();
        }
    }
}

const approvalMap = new WeakMap();

export function useApproval({ record, method, action }) {
    const orm = useService("orm");
    const studio = useService("studio");
    const notification = useService("notification");

    let approval = approvalMap.get(record.model);
    if (!approval) {
        approval = new StudioApproval();
        approvalMap.set(record.model, approval);
    }

    const specialize = {
        resModel: record.resModel,
        resId: record.resId,
        method,
        action,
        orm,
        studio,
        notification,
    };
    return Object.assign(Object.create(approval), specialize);
}
