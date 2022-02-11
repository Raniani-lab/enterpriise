/** @odoo-module **/

import { ComponentAdapter } from 'web.OwlCompatibility';
import FieldHtml from 'web_editor.field.html';
import { useService } from "@web/core/utils/hooks";
import { session } from '@web/session';

const { Component, onMounted, onPatched, onWillUnmount, useState } = owl;

class PayrollDashboardTodoAdapter extends ComponentAdapter {
    setup() {
        // Legacy environment is required for the web editor
        this.env = owl.Component.env;
        super.setup();
        onMounted(() => this.props.setWidget(this.widget));
    }

    /**
     * @override
     */
    renderWidget() {
        // Explicitely remove everything before render as it is not always done.
        this.widget.$el.empty();
        this.widget._render();
    }

    /**
     * @override
     * @param {object} nextProps
     */
    updateWidget(nextProps) {
        const record = nextProps.widgetArgs[1];
        this.widget._reset(record);
        this.widget.mode = nextProps.widgetArgs[2].mode || 'readonly';
        if (this.widget.wysiwyg) {
            // Explicitely destroy the editor as it otherwise would not be
            // due to the adapter keeping the legacy widget alive.
            this.widget.wysiwyg.destroy();
        }
        // Destroy routine from html field as not all resources are cleared properly upon rerendering
        delete window.top[this.widget._onUpdateIframeId];
        if (this.widget.$iframe) {
            this.widget.$iframe.destroy();
        }
        if (this.widget._qwebPlugin) {
            this.widget._qwebPlugin.destroy();
        }
    }
}

export class PayrollDashboardTodo extends Component {
    setup() {
        this.actionService = useService("action");
        this.FieldHtml = FieldHtml;
        this.state = useState({
            activeNoteId: this.props.notes.length ? this.props.notes[0]['id'] : -1,
            mode: this.props.notes.length ? 'readonly' : '',
        });
        onWillUnmount(() => {
            if (this.state.mode === 'edit') {
                this.saveNote()
            }
        });
        onPatched(() => {
            if (this.state.mode === '' && this.props.notes.length > 0) {
                this.state.mode = 'readonly';
                this.state.activeNoteId = this.props.notes[0]['id'];
            }
        });
    }

    /**
     * @returns {Object} Returns the current note data
     */
    get activeNoteData() {
        return this.props.notes.find((note) => note.id === this.state.activeNoteId);
    }

    /**
     * @returns {number} ID of the tag used to fetch the notes on the dashboard
     */
    get payrollTagId() {
        return this.props.tagId;
    }

    /**
     * @returns {Array} The widgetargs to start the html field with
     */
    get noteWidgetArgs() {
        return [
            'memo',
            this.generateRecord(),
            {
                mode: this.state.mode,
                attrs: {
                    options: {
                        collaborative: true,
                        height: 400,
                    },
                },
            },
        ]
    }

    /**
     * Opens the form view for either a new or an existing note.
     *
     * @param {number} noteId note's id for editing existing note
     */
    openNoteForm(noteId=false) {
        const options = {
            additionalContext: {
                default_tag_ids: [[4, this.payrollTagId]],
                default_company_id: owl.Component.env.session.user_context.allowed_company_ids[0],
            },
            onClose: () => this.props.reloadNotes(),
        }
        if (noteId) {
            options.props = { resId: noteId };
        }
        this.actionService.doAction('hr_payroll.note_note_hr_payroll_action', options);
    }

    /**
     * Switches to the requested note.
     *
     * @param { Number } noteId ID of the tab's note record
     */
    onClickNoteTab(noteId) {
        if (this.state.mode === 'edit') {
            this.saveNote();
        }
        this.state.mode = 'readonly';
        this.state.activeNoteId = noteId;
    }

    /**
     * Opens the configuration for the clicked note
     * @param { Number } noteId
     */
    onDoubleClickNoteTab(noteId) {
        this.openNoteForm(noteId);
    }

    /**
     * Opens a form view to create a new note.
     */
    onClickCreateNote() {
        if (this.state.mode === 'edit') {
            this.saveNote(false, false);
        }
        this.openNoteForm();
    }

    /**
     * Switches the component to edit mode, creating an editor instead of simply displaying the note.
     */
    onClickEdit() {
        if (this.state.mode === 'edit') {
            return;
        }
        this.state.mode = 'edit';
    }

    /**
     * Saves the local changes onto the database, notes are then reloaded from database and the component is re-rendered.
     */
    async onClickSave() {
        if (this.state.mode === 'readonly') {
            return;
        }
        await this.saveNote(true);
    }

    /**
     * Triggers an update on the parent component to save the local changes to the database.
     * Re-renders if requested.
     *
     * @param {boolean} updateState whether to revert the state back to readonly or not.
     */
    async saveNote(updateState=false) {
        this.fieldHtmlWidget.commitChanges();
        const newValue = this.fieldHtmlWidget._getValue();
        await this.props.updateNoteMemo(this.state.activeNoteId, newValue);
        if (updateState) {
            this.state.mode = 'readonly';
        }
    }

    /**
     * Creates a fake record to start our html editor with.
     * Uses the current active note id.
     */
    generateRecord() {
        // if active note was deleted, set the first note as the active one
        if (!this.activeNoteData) {
            this.state.activeNoteId = this.props.notes[0] && this.props.notes[0].id;
        }
        const activeNote = this.activeNoteData;
        return {
            id: activeNote.id,
            res_id: activeNote.id,
            model: 'note.note',
            data: {
                memo: activeNote.memo,
            },
            fields: {
                memo: {string: '', type: 'html'},
            },
            fieldsInfo: {
                default: {},
            },
            getContext() {
                return session.user_context;
            },
        }
    }

    /**
     * Hack: this component needs to retrieve the instance of the legacy field html
     * widget. Remove this logic when the fields are converted to owl.
     * @param {Widget} widget
     */
    setFieldHtmlWidget(widget) {
        this.fieldHtmlWidget = widget;
    }
}

PayrollDashboardTodo.template = 'hr_payroll.TodoList';
PayrollDashboardTodo.components = {
    PayrollDashboardTodoAdapter,
};
