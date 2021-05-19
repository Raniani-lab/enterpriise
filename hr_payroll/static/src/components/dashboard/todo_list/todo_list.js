/** @odoo-module **/

import { ComponentAdapter } from 'web.OwlCompatibility';
import FieldHtml from 'web_editor.field.html';
import { session } from '@web/session';

const { Component } = owl;
const { useDispatch, useGetters, useRef, useState, useStore } = owl.hooks;

export class PayrollDashboardTodoAdapter extends ComponentAdapter {

    //Public

    /**
     * @override
     */
    setup() {
        // Legacy environment is required for the web editor
        this.env = owl.Component.env;
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

    //Public

    /**
     * @override
     */
    setup() {
        this.FieldHtml = FieldHtml;
        this.notes = useStore((state) => state.notes);
        this.state = useState({
            activeNoteId: this.notes.length ? this.notes[0]['id'] : -1,
            mode: this.notes.length ? 'readonly' : '',
        });
        this.memoDisplayRef = useRef("memo_display");
        this.dispatch = useDispatch();
        this.getters = useGetters();
    }

    /**
     * @override
     */
    willUnmount() {
        if (this.state.mode === 'edit') {
            this._saveNote()
        }
    }

    /**
     * @override
     */
    patched() {
        if (this.state.mode === '' && this.notes.length > 0) {
            this.state.mode = 'readonly';
            this.state.activeNoteId = this.notes[0]['id'];
        }
    }

    // Public

    /**
     * @return {object} Returns the current note data
     */
    get activeNoteData() {
        return this.getters.getNote(this.state.activeNoteId);
    }

    /**
     * @return {int} ID of the tag used to fetch the notes on the dashboard
     */
    get payrollTagId() {
        return this.props.tagId;
    }

    /**
     * @return The widgetargs to start the html field with
     */
    get noteWidgetArgs() {
        return [
            'memo',
            this._generateRecord(),
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

    // Private

    /**
     * Opens the form view for either a new or an existing note.
     *
     * @private
     * @param {int} noteId note's id for editing existing note
     */
    _openNoteForm(noteId=false) {
        const self = this;
        const options = {
            additional_context: {
                default_tag_ids: [[4, this.payrollTagId]],
            },
            on_close: () => {
                self.trigger('reload-memo');
            }
        }
        if (noteId) {
            Object.assign(options, {
                res_id: noteId,
            });
        }
        this.trigger('do-action', {
            action: 'hr_payroll.note_note_hr_payroll_action',
            options: options,
        });
    }

    /**
     * Switches to the requested note or opens the configuration for the current note depending on the state.
     *
     * @private
     * @param {int} noteId ID of the tab's note record
     */
    _onClickNoteTab(noteId) {
        if (this.state.activeNoteId == noteId) {
            this._openNoteForm(this.state.activeNoteId);
            return;
        }
        if (this.state.mode === 'edit') {
            this._saveNote();
        }
        this.state.mode = 'readonly';
        this.state.activeNoteId = noteId;
    }

    /**
     * Opens a form view to create a new note. 
     *
     * @private
     */
    _onClickCreateNote() {
        if (this.state.mode === 'edit') {
            this._saveNote(false, false);
        }
        this._openNoteForm();
    }

    /**
     * Switches the component to edit mode, creating an editor instead of simply displaying the note.
     *
     * @private
     */
    _onClickEdit() {
        if (this.state.mode === 'edit') {
            return;
        }
        this.state.mode = 'edit';
    }

    /**
     * Saves the local changes onto the database, notes are then reloaded from database and the component is re-rendered.
     *
     * @private
     */
    async _onClickSave() {
        if (this.state.mode === 'readonly') {
            return;
        }
        await this._saveNote(true);
    }

    /**
     * Triggers an update on the parent component to save the local changes to the database.
     * Re-renders if requested.
     *
     * @private
     * @param {bool} updateState whether to revert the state back to readonly or not.
     * @param {bool} render whether to still do a re-render in case we do not wish to change the current mode.
     */
    async _saveNote(updateState=false) {
        const fieldHtmlWidget = this.memoDisplayRef.comp.widget;
        fieldHtmlWidget.commitChanges();
        const newValue = fieldHtmlWidget._getValue();
        await this.dispatch('updateNote',
            this.state.activeNoteId, Object.assign({}, this.activeNoteData, {memo: newValue}));
        await this.trigger('update-memo', {
            id: this.activeNoteData['id'],
            memo: newValue,
        });
        if (updateState) {
            this.state.mode = 'readonly';
        }
    }

    /**
     * Creates a fake record to start our html editor with.
     * Uses the current active note id.
     */
    _generateRecord() {
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

}

PayrollDashboardTodo.template = 'hr_payroll.TodoList';
PayrollDashboardTodo.components = {
    PayrollDashboardTodoAdapter,
};
